import logging
import os
import shutil
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.gateways.base import GenerateRequest
from app.gateways.image_gateway import image_gateway
from app.gateways.video_gateway import video_gateway
from app.models.pipeline_run import PipelineRun
from app.models.project import Project
from app.models.scene import Scene

logger = logging.getLogger(__name__)


async def approve_scenes(project_id: str, db: AsyncSession):
    """씬 승인 → 이미지 생성 시작"""
    project = await db.get(Project, project_id)
    if not project:
        raise ValueError("Project not found")

    project.status = "image_generating"

    run = await _get_or_create_run(project_id, db, "image_generating")
    await db.commit()
    await generate_all_images(project_id, db)


async def generate_all_images(project_id: str, db: AsyncSession):
    result = await db.execute(
        select(Scene).where(Scene.project_id == project_id).order_by(Scene.order_index)
    )
    scenes = result.scalars().all()
    project = await db.get(Project, project_id)

    for scene in scenes:
        scene.status = "generating_image"
    await db.commit()

    for scene in scenes:
        try:
            response = await image_gateway.generate(
                GenerateRequest(
                    prompt=scene.prompt,
                    model_id=project.image_model,
                    params={"scene_index": scene.order_index},
                )
            )
            scene.key_image_url = response.content
            scene.image_model_used = response.model_id
            scene.status = "image_ready"
        except Exception as e:
            logger.error(f"Image generation failed for scene {scene.id}: {e}")
            scene.status = "image_failed"
        await db.commit()

    project.status = "images_review"
    run = await _get_active_run(project_id, db)
    if run:
        run.status = "paused_for_approval"
        run.current_stage = "images_review"
    await db.commit()


async def regenerate_scene_image(scene_id: str, db: AsyncSession, reference_urls: list[str] | None = None):
    scene = await db.get(Scene, scene_id)
    if not scene:
        raise ValueError("Scene not found")

    project = await db.get(Project, scene.project_id)
    scene.status = "generating_image"
    await db.commit()

    # Apply harness prompt_prefix
    prompt = scene.prompt
    if project.harness:
        import json as _json
        try:
            harness = _json.loads(project.harness)
            prefix = harness.get("prompt_prefix", "")
            if prefix and prefix not in prompt:
                prompt = f"{prefix}, {prompt}"
        except _json.JSONDecodeError:
            pass

    try:
        response = await image_gateway.generate(
            GenerateRequest(
                prompt=prompt,
                model_id=project.image_model,
                params={
                    "scene_index": scene.order_index,
                    "reference_urls": reference_urls or [],
                },
            )
        )
        scene.key_image_url = response.content
        scene.image_model_used = response.model_id
        scene.status = "image_ready"
        scene.error_message = None
    except Exception as e:
        logger.error(f"Image regeneration failed: {e}")
        scene.status = "image_failed"
        scene.error_message = str(e)
    await db.commit()


async def approve_scene_image(scene_id: str, db: AsyncSession):
    scene = await db.get(Scene, scene_id)
    if not scene:
        raise ValueError("Scene not found")
    scene.status = "image_approved"
    await db.commit()


async def start_video_generation(project_id: str, db: AsyncSession):
    """이미지 전체 승인 → 영상 생성 시작"""
    project = await db.get(Project, project_id)
    if not project:
        raise ValueError("Project not found")

    project.status = "video_generating"
    run = await _get_active_run(project_id, db)
    if run:
        run.status = "running"
        run.current_stage = "video_generating"

    result = await db.execute(
        select(Scene).where(Scene.project_id == project_id).order_by(Scene.order_index)
    )
    scenes = result.scalars().all()

    for scene in scenes:
        scene.status = "generating_video"
    await db.commit()

    for scene in scenes:
        try:
            response = await video_gateway.generate(
                GenerateRequest(
                    prompt=scene.prompt,
                    model_id=project.video_model,
                    params={
                        "scene_index": scene.order_index,
                        "image_url": scene.key_image_url,
                        "duration_sec": scene.duration_sec,
                    },
                )
            )
            scene.video_url = response.content
            scene.video_model_used = response.model_id
            scene.status = "video_ready"
            scene.error_message = None
        except Exception as e:
            logger.error(f"Video generation failed for scene {scene.id}: {e}")
            scene.status = "video_failed"
            scene.error_message = str(e)
        await db.commit()

    project.status = "videos_review"
    run = await _get_active_run(project_id, db)
    if run:
        run.status = "paused_for_approval"
        run.current_stage = "videos_review"
    await db.commit()


async def regenerate_scene_video(scene_id: str, db: AsyncSession):
    scene = await db.get(Scene, scene_id)
    if not scene:
        raise ValueError("Scene not found")

    project = await db.get(Project, scene.project_id)
    scene.status = "generating_video"
    await db.commit()

    try:
        response = await video_gateway.generate(
            GenerateRequest(
                prompt=scene.prompt,
                model_id=project.video_model,
                params={
                    "scene_index": scene.order_index,
                    "image_url": scene.key_image_url,
                    "duration_sec": scene.duration_sec,
                },
            )
        )
        scene.video_url = response.content
        scene.video_model_used = response.model_id
        scene.status = "video_ready"
        scene.error_message = None
    except Exception as e:
        logger.error(f"Video regeneration failed: {e}")
        scene.status = "video_failed"
        scene.error_message = str(e)
    await db.commit()


async def approve_scene_video(scene_id: str, db: AsyncSession):
    scene = await db.get(Scene, scene_id)
    if not scene:
        raise ValueError("Scene not found")
    scene.status = "video_approved"
    await db.commit()


async def save_scene_clip(scene_id: str, project_id: str, db: AsyncSession) -> str:
    """개별 클립을 로컬 프로젝트 폴더에 저장"""
    scene = await db.get(Scene, scene_id)
    if not scene:
        raise ValueError("Scene not found")

    project = await db.get(Project, project_id)
    if not project:
        raise ValueError("Project not found")

    # Create project output directory (absolute path)
    safe_title = "".join(c if c.isalnum() or c in (" ", "-", "_") else "_" for c in project.title)
    output_dir = os.path.abspath(os.path.join(settings.UPLOAD_DIR, "output", f"{project_id}_{safe_title}"))
    os.makedirs(output_dir, exist_ok=True)

    saved_files = []

    # Save image if exists
    if scene.key_image_url and scene.key_image_url.startswith("/uploads/"):
        src = os.path.join(settings.UPLOAD_DIR, os.path.basename(scene.key_image_url))
        if os.path.exists(src):
            ext = os.path.splitext(src)[1]
            dst = os.path.join(output_dir, f"scene_{scene.order_index + 1:02d}_image{ext}")
            shutil.copy2(src, dst)
            saved_files.append(dst)

    # Save video if exists
    if scene.video_url and scene.video_url.startswith("/uploads/"):
        src = os.path.join(settings.UPLOAD_DIR, os.path.basename(scene.video_url))
        if os.path.exists(src):
            ext = os.path.splitext(src)[1]
            dst = os.path.join(output_dir, f"scene_{scene.order_index + 1:02d}_video{ext}")
            shutil.copy2(src, dst)
            saved_files.append(dst)

    scene.status = "saved"
    await db.commit()

    return output_dir


async def complete_project(project_id: str, db: AsyncSession) -> str:
    """프로젝트 완료 — 클립 + 메타데이터 + FFmpeg 최종본 내보내기"""
    import json
    import subprocess

    project = await db.get(Project, project_id)
    if not project:
        raise ValueError("Project not found")

    safe_title = "".join(c if c.isalnum() or c in (" ", "-", "_") else "_" for c in project.title)
    output_dir = os.path.abspath(os.path.join(settings.UPLOAD_DIR, "output", f"{project_id}_{safe_title}"))
    clips_dir = os.path.join(output_dir, "clips")
    os.makedirs(clips_dir, exist_ok=True)

    result = await db.execute(
        select(Scene).where(Scene.project_id == project_id).order_by(Scene.order_index)
    )
    scenes = result.scalars().all()

    # 1) Export individual clips + collect metadata
    video_files = []
    project_meta = {
        "title": project.title,
        "brief": project.brief,
        "total_scenes": len(scenes),
        "scenes": [],
    }

    for scene in scenes:
        scene_num = f"scene_{scene.order_index + 1:02d}"
        scene_meta: dict = {
            "index": scene.order_index + 1,
            "title": scene.title,
            "description": scene.description,
            "script": scene.script_formatted,
            "duration_sec": scene.duration_sec,
            "transition": scene.transition,
            "subtitles_json": scene.subtitles_json,
        }

        # Copy image
        if scene.key_image_url and scene.key_image_url.startswith("/uploads/"):
            src = os.path.join(settings.UPLOAD_DIR, os.path.basename(scene.key_image_url))
            if os.path.exists(src):
                ext = os.path.splitext(src)[1]
                dst = os.path.join(clips_dir, f"{scene_num}_image{ext}")
                shutil.copy2(src, dst)
                scene_meta["image_file"] = f"clips/{scene_num}_image{ext}"

        # Copy video or generate black frame
        if scene.video_url and scene.video_url.startswith("/uploads/"):
            src = os.path.join(settings.UPLOAD_DIR, os.path.basename(scene.video_url))
            if os.path.exists(src):
                ext = os.path.splitext(src)[1]
                dst = os.path.join(clips_dir, f"{scene_num}_video{ext}")
                shutil.copy2(src, dst)
                scene_meta["video_file"] = f"clips/{scene_num}_video{ext}"
                video_files.append((dst, scene))
            else:
                video_files.append(("__black__", scene))
        else:
            # No video — will generate black frame in FFmpeg
            video_files.append(("__black__", scene))

        project_meta["scenes"].append(scene_meta)
        scene.status = "completed"

    # 2) Save project metadata JSON
    meta_path = os.path.join(output_dir, "project.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(project_meta, f, ensure_ascii=False, indent=2)

    # 3) FFmpeg: combine clips into final video with transitions + subtitles
    if len(video_files) >= 1:
        try:
            await _render_final_video(output_dir, clips_dir, video_files)
        except Exception as e:
            logger.error(f"FFmpeg rendering failed: {e}")
            # Not fatal — clips are still exported

    project.status = "completed"
    run = await _get_active_run(project_id, db)
    if run:
        run.status = "completed"
        run.current_stage = "completed"
        run.completed_at = datetime.utcnow()

    await db.commit()
    return output_dir


async def _render_final_video(output_dir: str, clips_dir: str, video_files: list):
    """FFmpeg로 최종 영상 합성 (자막 + AI 워터마크 + 클립 연결)"""
    import asyncio

    FONT = "/Library/Fonts/NotoSansKR-SemiBold.ttf"
    FONT_MEDIUM = "/Library/Fonts/NotoSansKR-Medium.ttf"

    def get_style(style_name: str, size: int) -> str:
        styles = {
            "default": f"fontfile={FONT}:fontsize={size}:fontcolor=white:borderw=2:bordercolor=black@0.7",
            "bold": f"fontfile={FONT}:fontsize={size}:fontcolor=white:borderw=3:bordercolor=black",
            "minimal": f"fontfile={FONT_MEDIUM}:fontsize={size}:fontcolor=white@0.9:borderw=1:bordercolor=black@0.5",
            "cinematic": f"fontfile={FONT}:fontsize={size}:fontcolor=white:borderw=2:bordercolor=black@0.6",
            "news": f"fontfile={FONT_MEDIUM}:fontsize={size}:fontcolor=white:box=1:boxcolor=black@0.5:boxborderw=10",
        }
        return styles.get(style_name, styles["default"])

    # Step 1: Add subtitles + watermark to each clip
    processed = []
    for clip_path, scene in video_files:
        out_path = os.path.join(clips_dir, f"_proc_{scene.order_index:02d}.mp4")

        # Generate black frame if no video
        if clip_path == "__black__":
            dur = scene.duration_sec or 4
            black_path = os.path.join(clips_dir, f"_black_{scene.order_index:02d}.mp4")
            black_cmd = [
                "ffmpeg", "-y", "-f", "lavfi",
                "-i", f"color=c=black:s=1920x1080:d={dur}:r=30",
                "-f", "lavfi", "-i", f"anullsrc=r=44100:cl=stereo",
                "-t", str(dur), "-shortest",
                "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac",
                black_path,
            ]
            proc = await asyncio.create_subprocess_exec(
                *black_cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
            )
            try:
                await asyncio.wait_for(proc.communicate(), timeout=30)
            except asyncio.TimeoutError:
                proc.kill()
                logger.error(f"Black frame generation timed out for scene {scene.order_index}")
                continue
            clip_path = black_path

        filters = []

        # Parse subtitles + speed from JSON
        import json as _json
        speed = 1.0
        try:
            raw_data = _json.loads(scene.subtitles_json) if scene.subtitles_json else []
            if isinstance(raw_data, list):
                subs = raw_data
            elif isinstance(raw_data, dict):
                subs = raw_data.get("subs", [])
                speed = raw_data.get("speed", 1.0)
            else:
                subs = []
        except _json.JSONDecodeError:
            subs = []

        for sub in subs:
            raw_text = sub.get("text", "")
            if not raw_text:
                continue
            sub_size = sub.get("size", 42)
            style = get_style(sub.get("style", "default"), sub_size)
            start = sub.get("start", 0)
            end = sub.get("end", scene.duration_sec)
            position = sub.get("position", "center")
            fade_in = sub.get("fadeIn", 0.3)
            fade_out = sub.get("fadeOut", 0.3)
            lines = raw_text.split("\n")
            line_height = int(sub_size * 1.4)
            total_height = line_height * len(lines)

            # Build alpha expression for fade in/out
            alpha_parts = []
            if fade_in > 0:
                alpha_parts.append(f"if(lt(t-{start},{fade_in}),(t-{start})/{fade_in},1)")
            if fade_out > 0:
                alpha_parts.append(f"if(gt(t,{end}-{fade_out}),({end}-t)/{fade_out},1)")
            if alpha_parts:
                alpha_expr = "*".join(alpha_parts)
            else:
                alpha_expr = ""

            for li, line in enumerate(lines):
                if not line.strip():
                    continue
                escaped = line.replace("'", "'\\''").replace(":", "\\:")
                if position == "top":
                    y_offset = f"40+{li * line_height}"
                elif position == "bottom":
                    y_offset = f"h-{total_height}-60+{li * line_height}"
                else:
                    y_offset = f"(h-{total_height})/2+{li * line_height}"
                alpha_part = f":alpha='{alpha_expr}'" if alpha_expr else ""
                filters.append(
                    f"drawtext=text='{escaped}':{style}:x=(w-tw)/2:y={y_offset}"
                    f"{alpha_part}:enable='between(t,{start},{end})'"
                )

        # AI 영상 클립에만 워터마크 (검정 화면에는 안 넣음)
        is_black = clip_path.endswith(f"_black_{scene.order_index:02d}.mp4")
        if not is_black and scene.video_url:
            wm = "AI로 생성된 영상입니다.".replace("'", "'\\''").replace(":", "\\:")
            filters.append(
                f"drawtext=text='{wm}':fontfile={FONT_MEDIUM}:fontsize=16:fontcolor=white@0.5:x=w-tw-20:y=h-30"
            )

        # Apply speed change via setpts
        if speed != 1.0 and speed > 0:
            filters.insert(0, f"setpts={1/speed}*PTS")

        # Build command
        if not filters:
            # No processing needed — just copy
            import shutil as _shutil
            _shutil.copy2(clip_path, out_path)
            if os.path.exists(out_path):
                processed.append(out_path)
            else:
                processed.append(clip_path)
            continue

        cmd = [
            "ffmpeg", "-y", "-i", clip_path,
            "-vf", ",".join(filters),
            "-c:v", "libx264", "-preset", "fast", "-crf", "18",
        ]
        if speed != 1.0 and speed > 0:
            if 0.5 <= speed <= 2.0:
                cmd += ["-af", f"atempo={speed}"]
            else:
                cmd += ["-an"]
        else:
            cmd += ["-c:a", "copy"]
        cmd.append(out_path)

        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
        )
        try:
            _, stderr = await asyncio.wait_for(proc.communicate(), timeout=120)
        except asyncio.TimeoutError:
            proc.kill()
            logger.error(f"FFmpeg timed out for scene {scene.order_index}")
            processed.append(clip_path)
            continue

        if os.path.exists(out_path) and os.path.getsize(out_path) > 0:
            processed.append(out_path)
        else:
            logger.warning(f"FFmpeg clip failed: {stderr.decode()[-200:]}")
            processed.append(clip_path)

    if not processed:
        return

    # Step 2: Normalize all clips to same format (1920x1080, 30fps, h264+aac)
    normalized = []
    for i, p in enumerate(processed):
        norm_path = os.path.join(clips_dir, f"_norm_{i:02d}.mp4")
        norm_cmd = [
            "ffmpeg", "-y", "-i", p,
            "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black",
            "-r", "30", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "22",
            "-c:a", "aac", "-ar", "44100", "-ac", "2", "-shortest",
            norm_path,
        ]
        proc = await asyncio.create_subprocess_exec(
            *norm_cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
        )
        try:
            await asyncio.wait_for(proc.communicate(), timeout=300)
        except asyncio.TimeoutError:
            proc.kill()
            logger.error(f"Normalize timed out for clip {i}, using original")
            normalized.append(p)  # fallback to original
            continue
        if os.path.exists(norm_path) and os.path.getsize(norm_path) > 0:
            normalized.append(norm_path)
        else:
            normalized.append(p)  # fallback

    if not normalized:
        return

    # Step 3: Concatenate normalized clips
    concat_list = os.path.join(clips_dir, "_concat.txt")
    with open(concat_list, "w") as f:
        for p in normalized:
            f.write(f"file '{p}'\n")

    final_path = os.path.join(output_dir, "final_output.mp4")
    cmd = [
        "ffmpeg", "-y", "-f", "concat", "-safe", "0",
        "-i", concat_list, "-c", "copy", final_path,
    ]
    proc = await asyncio.create_subprocess_exec(
        *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
    )
    try:
        await asyncio.wait_for(proc.communicate(), timeout=120)
    except asyncio.TimeoutError:
        proc.kill()
        logger.error("Final concat timed out")

    # Cleanup temp files
    for p in processed + normalized:
        base = os.path.basename(p)
        if (base.startswith("_proc_") or base.startswith("_norm_") or base.startswith("_black_")) and os.path.exists(p):
            os.remove(p)
    if os.path.exists(concat_list):
        os.remove(concat_list)

    if os.path.exists(final_path):
        logger.info(f"Final video rendered: {final_path} ({os.path.getsize(final_path) / 1024:.0f} KB)")
    else:
        logger.warning("Final video rendering failed")


async def _get_active_run(project_id: str, db: AsyncSession) -> PipelineRun | None:
    result = await db.execute(
        select(PipelineRun)
        .where(PipelineRun.project_id == project_id)
        .where(PipelineRun.status.in_(["running", "paused_for_approval", "queued"]))
        .order_by(PipelineRun.started_at.desc())
    )
    return result.scalars().first()


async def _get_or_create_run(project_id: str, db: AsyncSession, stage: str) -> PipelineRun:
    run = await _get_active_run(project_id, db)
    if not run:
        run = PipelineRun(project_id=project_id, status="running", current_stage=stage)
        db.add(run)
    else:
        run.status = "running"
        run.current_stage = stage
    return run
