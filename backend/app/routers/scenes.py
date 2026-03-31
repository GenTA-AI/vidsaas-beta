import json

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.gateways.llm_gateway import llm_gateway
from app.models.project import Project
from app.models.scene import Scene
from app.schemas.project import SceneOut
from app.schemas.scene import SceneUpdate

router = APIRouter(prefix="/api/v1/projects/{project_id}/scenes", tags=["scenes"])

REFINE_PROMPT = """당신은 영상 시나리오 작가입니다. 사용자가 작성한 씬 설명을 전문적인 영상 대본 형식으로 정리해주세요.

## 입력 정보
- 프로젝트: {project_title}
- 씬 번호: {scene_number}
- 씬 제목: {scene_title}
- 사용자 설명: {description}

## 출력 형식
반드시 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):

```json
{{
  "script_formatted": "전문적인 영상 대본 형식으로 정리된 텍스트. 장면 설명(지문), 나레이션, 카메라 지시, 자막 등을 포함. 한국어로 작성.",
  "prompt": "이 씬의 키 이미지를 생성하기 위한 상세한 영어 프롬프트. 구도, 조명, 색감, 피사체, 분위기, 카메라 앵글을 구체적으로 서술. 반드시 영어로.",
  "title": "씬 제목 (한국어, 간결하게)"
}}
```

## 대본 작성 가이드
- 장면 묘사(지문)는 현재형으로, 구체적인 시각 요소를 포함
- 나레이션이 있다면 N: 으로 표시
- 자막이 있다면 SUPER: 로 표시
- 카메라 워킹은 [ ] 안에 표시 (예: [클로즈업], [와이드 샷])
- 전문적이고 실제 촬영 가능한 수준으로 작성"""

MOCK_REFINE = json.dumps({
    "script_formatted": "[와이드 샷] 깔끔한 스튜디오 공간. 은은한 블루 조명이 공간을 감싼다.\n\n제품이 턴테이블 위에 놓여 천천히 회전한다.\n\n[클로즈업] 제품의 세밀한 디테일이 드러난다. 메탈릭한 질감이 조명을 받아 빛난다.\n\nN: \"완벽한 디자인, 놀라운 성능.\"\n\nSUPER: 제품명 로고 페이드인",
    "prompt": "A sleek modern product rotating slowly on a turntable in a minimalist studio, deep blue accent lighting, cinematic close-up showing metallic details and reflections, premium product photography, shallow depth of field, 4K quality",
    "title": "제품 클로즈업"
}, ensure_ascii=False)


class RefineRequest(BaseModel):
    description: str


class RefineResponse(BaseModel):
    script_formatted: str
    prompt: str
    title: str


@router.get("", response_model=list[SceneOut])
async def list_scenes(project_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Scene).where(Scene.project_id == project_id).order_by(Scene.order_index)
    )
    return result.scalars().all()


class ReorderRequest(BaseModel):
    scene_ids: list[str]  # 새 순서대로 씬 ID 배열


@router.put("/reorder")
async def reorder_scenes(project_id: str, data: ReorderRequest, db: AsyncSession = Depends(get_db)):
    """씬 순서 변경"""
    result = await db.execute(select(Scene).where(Scene.project_id == project_id))
    scenes_map = {s.id: s for s in result.scalars().all()}
    for i, sid in enumerate(data.scene_ids):
        if sid in scenes_map:
            scenes_map[sid].order_index = i
    await db.commit()
    return {"message": f"{len(data.scene_ids)}개 씬 순서 변경"}


class SceneCreate(BaseModel):
    title: str = "새 씬"
    after_index: int = -1  # -1이면 맨 뒤, 0이면 첫 번째 뒤에 삽입


@router.post("", response_model=SceneOut, status_code=201)
async def add_scene(project_id: str, data: SceneCreate, db: AsyncSession = Depends(get_db)):
    """씬 추가 (after_index 뒤에 삽입)"""
    result = await db.execute(
        select(Scene).where(Scene.project_id == project_id).order_by(Scene.order_index)
    )
    scenes = result.scalars().all()

    if data.after_index < 0 or data.after_index >= len(scenes):
        new_index = len(scenes)
    else:
        new_index = data.after_index + 1
        # Shift subsequent scenes
        for s in scenes:
            if s.order_index >= new_index:
                s.order_index += 1

    scene = Scene(
        project_id=project_id,
        order_index=new_index,
        title=data.title,
        duration_sec=4.0,
        status="pending",
    )
    db.add(scene)
    await db.commit()
    await db.refresh(scene)
    return scene


@router.delete("/{scene_id}", status_code=204)
async def delete_scene(project_id: str, scene_id: str, db: AsyncSession = Depends(get_db)):
    """씬 삭제"""
    scene = await db.get(Scene, scene_id)
    if not scene:
        raise HTTPException(404, "Scene not found")
    deleted_index = scene.order_index
    await db.delete(scene)

    # Re-index subsequent scenes
    result = await db.execute(
        select(Scene).where(Scene.project_id == project_id).order_by(Scene.order_index)
    )
    for s in result.scalars().all():
        if s.order_index > deleted_index:
            s.order_index -= 1
    await db.commit()


@router.put("/{scene_id}", response_model=SceneOut)
async def update_scene(scene_id: str, data: SceneUpdate, db: AsyncSession = Depends(get_db)):
    scene = await db.get(Scene, scene_id)
    if not scene:
        raise HTTPException(404, "Scene not found")
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(scene, key, val)
    await db.commit()
    await db.refresh(scene)
    return scene


@router.post("/{scene_id}/refine", response_model=RefineResponse)
async def refine_scene(
    project_id: str,
    scene_id: str,
    data: RefineRequest,
    db: AsyncSession = Depends(get_db),
):
    """자연어 설명을 AI가 전문 대본 형식 + 영어 프롬프트로 변환"""
    scene = await db.get(Scene, scene_id)
    if not scene:
        raise HTTPException(404, "Scene not found")
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    # Save raw description
    scene.description = data.description
    await db.commit()

    # Call Claude to refine
    from app.config import settings

    if settings.AI_MODE == "mock":
        raw = MOCK_REFINE
    else:
        prompt_text = REFINE_PROMPT.format(
            project_title=project.title,
            scene_number=scene.order_index + 1,
            scene_title=scene.title,
            description=data.description,
        )
        raw = await llm_gateway.chat(
            [{"role": "user", "content": prompt_text}],
            system="당신은 전문 영상 시나리오 작가입니다. 반드시 JSON 형식으로만 응답하세요.",
        )

    # Parse JSON (robust extraction)
    text = raw.strip()
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0].strip()
    elif "```" in text:
        parts = text.split("```")
        for part in parts[1::2]:
            stripped = part.strip()
            if stripped.startswith("{"):
                text = stripped
                break
    if not text.startswith("{"):
        start = text.find("{")
        if start != -1:
            depth = 0
            for i in range(start, len(text)):
                if text[i] == "{":
                    depth += 1
                elif text[i] == "}":
                    depth -= 1
                    if depth == 0:
                        text = text[start : i + 1]
                        break

    try:
        result = json.loads(text)
    except json.JSONDecodeError:
        raise HTTPException(500, "AI 응답을 파싱할 수 없습니다. 다시 시도해주세요.")

    # Update scene
    scene.script_formatted = result["script_formatted"]
    scene.prompt = result["prompt"]
    scene.title = result.get("title", scene.title)
    await db.commit()
    await db.refresh(scene)

    return RefineResponse(
        script_formatted=result["script_formatted"],
        prompt=result["prompt"],
        title=result.get("title", scene.title),
    )


PROMPT_GEN_TEMPLATE = """현재 씬의 이미지 프롬프트를 수정해주세요.

## 프로젝트 하네스 (전체 스타일 지침)
{harness_context}

## 현재 씬 정보
- 제목: {title}
- 설명: {description}
- 현재 프롬프트: {current_prompt}

## 사용자 요청
{user_request}

## 출력
반드시 JSON만 출력 (다른 텍스트 금지):
{{"prompt": "수정된 영어 이미지 프롬프트. 하네스 스타일 지침을 반영. 구도, 조명, 색감, 피사체, 카메라앵글, 분위기 구체적 서술. 영어만."}}"""


class PromptGenRequest(BaseModel):
    request: str  # 사용자 자연어 요청 (한국어)


class PromptGenResponse(BaseModel):
    prompt: str


@router.post("/{scene_id}/generate-prompt", response_model=PromptGenResponse)
async def generate_prompt(
    project_id: str,
    scene_id: str,
    data: PromptGenRequest,
    db: AsyncSession = Depends(get_db),
):
    """자연어 요청으로 이미지/영상 프롬프트를 AI가 작성"""
    scene = await db.get(Scene, scene_id)
    if not scene:
        raise HTTPException(404, "Scene not found")
    project = await db.get(Project, project_id)

    # Load harness context
    harness_context = "(하네스 없음)"
    if project and project.harness:
        try:
            h = json.loads(project.harness)
            harness_context = f"- 비주얼: {h.get('visual_style', '')}\n- 색감: {h.get('color_palette', '')}\n- 카메라: {h.get('camera_style', '')}\n- 톤: {h.get('tone', '')}\n- 프롬프트 프리픽스: {h.get('prompt_prefix', '')}"
        except json.JSONDecodeError:
            pass

    from app.config import settings

    if settings.AI_MODE == "mock":
        new_prompt = f"A cinematic scene: {data.request}, high quality, 4K, professional photography"
    else:
        text_input = PROMPT_GEN_TEMPLATE.format(
            harness_context=harness_context,
            title=scene.title,
            description=scene.description or scene.title,
            current_prompt=scene.prompt or "(없음)",
            user_request=data.request,
        )
        raw = await llm_gateway.chat(
            [{"role": "user", "content": text_input}],
            system="반드시 JSON만 출력. 다른 텍스트 금지.",
        )
        text = raw.strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif not text.startswith("{"):
            start = text.find("{")
            if start != -1:
                end = text.rfind("}")
                if end != -1:
                    text = text[start : end + 1]
        try:
            result = json.loads(text)
            new_prompt = result["prompt"]
        except (json.JSONDecodeError, KeyError):
            new_prompt = text  # fallback

    scene.prompt = new_prompt
    await db.commit()

    return PromptGenResponse(prompt=new_prompt)


@router.post("/{scene_id}/generate-image-with-request")
async def generate_image_with_request(
    project_id: str,
    scene_id: str,
    data: PromptGenRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """원클릭: 자연어 → 프롬프트 수정 → 이미지 생성까지 한 번에"""
    from app.database import async_session
    from app.services import pipeline_service

    scene = await db.get(Scene, scene_id)
    if not scene:
        raise HTTPException(404, "Scene not found")
    project = await db.get(Project, project_id)

    # 1. Generate prompt from natural language
    harness_context = "(하네스 없음)"
    if project and project.harness:
        try:
            h = json.loads(project.harness)
            harness_context = f"- 비주얼: {h.get('visual_style', '')}\n- 색감: {h.get('color_palette', '')}\n- 프롬프트 프리픽스: {h.get('prompt_prefix', '')}"
        except json.JSONDecodeError:
            pass

    from app.config import settings
    if settings.AI_MODE == "mock":
        new_prompt = f"A cinematic scene: {data.request}, high quality"
    else:
        text_input = PROMPT_GEN_TEMPLATE.format(
            harness_context=harness_context,
            title=scene.title,
            description=scene.description or scene.title,
            current_prompt=scene.prompt or "(없음)",
            user_request=data.request,
        )
        raw = await llm_gateway.chat(
            [{"role": "user", "content": text_input}],
            system="반드시 JSON만 출력.",
        )
        text = raw.strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif not text.startswith("{"):
            start = text.find("{")
            if start != -1:
                end = text.rfind("}")
                if end != -1:
                    text = text[start:end+1]
        try:
            new_prompt = json.loads(text)["prompt"]
        except (json.JSONDecodeError, KeyError):
            new_prompt = scene.prompt

    scene.prompt = new_prompt
    await db.commit()

    # 2. Start image generation in background
    async def _gen():
        async with async_session() as session:
            await pipeline_service.regenerate_scene_image(scene_id, session)

    background_tasks.add_task(_gen)
    return {"message": "프롬프트 수정 + 이미지 생성 시작", "prompt": new_prompt}
