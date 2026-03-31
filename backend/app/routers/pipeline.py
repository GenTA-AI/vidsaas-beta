import os
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings

from app.database import async_session, get_db
from app.models.project import Project
from app.models.scene import Scene
from app.schemas.scene import PipelineStatusOut, SceneStatusOut
from app.services import pipeline_service


class RegenerateRequest(BaseModel):
    reference_urls: list[str] = []

router = APIRouter(prefix="/api/v1/projects/{project_id}", tags=["pipeline"])


@router.post("/scenes/approve")
async def approve_scenes(
    project_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """씬 구조 승인 → 이미지 생성 시작"""

    async def _run():
        async with async_session() as session:
            await pipeline_service.approve_scenes(project_id, session)

    background_tasks.add_task(_run)
    return {"message": "씬 승인 완료, 이미지 생성을 시작합니다..."}


@router.post("/scenes/{scene_id}/approve")
async def approve_scene(
    project_id: str,
    scene_id: str,
    db: AsyncSession = Depends(get_db),
):
    scene = await db.get(Scene, scene_id)
    if not scene:
        raise HTTPException(404, "Scene not found")

    if scene.status == "image_ready":
        await pipeline_service.approve_scene_image(scene_id, db)
    elif scene.status == "video_ready":
        await pipeline_service.approve_scene_video(scene_id, db)
    else:
        raise HTTPException(400, f"Scene is in '{scene.status}' state, cannot approve")

    return {"message": f"Scene approved (status: {scene.status})"}


@router.post("/scenes/{scene_id}/regenerate-image")
async def regenerate_image(
    project_id: str,
    scene_id: str,
    background_tasks: BackgroundTasks,
    data: RegenerateRequest | None = None,
    db: AsyncSession = Depends(get_db),
):
    ref_urls = data.reference_urls if data else []

    async def _regen():
        async with async_session() as session:
            await pipeline_service.regenerate_scene_image(scene_id, session, reference_urls=ref_urls)

    background_tasks.add_task(_regen)
    return {"message": "이미지 재생성 중..."}


@router.post("/scenes/{scene_id}/regenerate-video")
async def regenerate_video(
    project_id: str,
    scene_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    async def _regen():
        async with async_session() as session:
            await pipeline_service.regenerate_scene_video(scene_id, session)

    background_tasks.add_task(_regen)
    return {"message": "영상 재생성 중..."}


@router.post("/scenes/{scene_id}/save")
async def save_scene_clip(
    project_id: str,
    scene_id: str,
    db: AsyncSession = Depends(get_db),
):
    """개별 클립을 로컬 폴더에 저장"""
    try:
        output_dir = await pipeline_service.save_scene_clip(scene_id, project_id, db)
        return {"message": "클립 저장 완료", "output_dir": output_dir}
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/images/approve")
async def approve_all_images(
    project_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """이미지 전체 승인 → 영상 생성 시작"""

    async def _run():
        async with async_session() as session:
            await pipeline_service.start_video_generation(project_id, session)

    background_tasks.add_task(_run)
    return {"message": "이미지 승인 완료, 영상 생성을 시작합니다..."}


@router.post("/complete")
async def complete_project(project_id: str, db: AsyncSession = Depends(get_db)):
    """프로젝트 완료 — 모든 클립을 순서대로 로컬에 저장"""
    try:
        output_dir = await pipeline_service.complete_project(project_id, db)
        return {"message": "프로젝트 완료! 모든 클립이 저장되었습니다.", "output_dir": output_dir}
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/pipeline/status", response_model=PipelineStatusOut)
async def get_pipeline_status(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    from app.models.pipeline_run import PipelineRun

    result = await db.execute(
        select(PipelineRun)
        .where(PipelineRun.project_id == project_id)
        .order_by(PipelineRun.started_at.desc())
    )
    run = result.scalars().first()

    scenes_result = await db.execute(
        select(Scene).where(Scene.project_id == project_id).order_by(Scene.order_index)
    )
    scenes = [SceneStatusOut.model_validate(s) for s in scenes_result.scalars().all()]

    return PipelineStatusOut(
        project_id=project_id,
        project_status=project.status,
        run_id=run.id if run else None,
        run_status=run.status if run else None,
        current_stage=run.current_stage if run else None,
        scenes=scenes,
    )


@router.post("/upload-image")
async def upload_image(project_id: str, file: UploadFile = File(...)):
    """외부 이미지를 업로드하여 레퍼런스로 사용"""
    ext = os.path.splitext(file.filename or "image.png")[1] or ".png"
    filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join(settings.UPLOAD_DIR, filename)
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    return {"url": f"/uploads/{filename}", "filename": filename}


class OpenFolderRequest(BaseModel):
    path: str


@router.post("/open-folder")
async def open_folder(project_id: str, data: OpenFolderRequest):
    """로컬 폴더를 Finder/탐색기로 열기"""
    import subprocess
    import sys

    folder = data.path
    if not os.path.isdir(folder):
        raise HTTPException(404, "폴더를 찾을 수 없습니다")

    if sys.platform == "darwin":
        subprocess.Popen(["open", folder])
    elif sys.platform == "win32":
        subprocess.Popen(["explorer", folder])
    else:
        subprocess.Popen(["xdg-open", folder])

    return {"message": "폴더를 열었습니다", "path": folder}
