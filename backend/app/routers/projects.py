import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.gateways.llm_gateway import llm_gateway
from app.models.project import Project
from app.models.scene import Scene
from app.schemas.project import ProjectCreate, ProjectListOut, ProjectOut, ProjectUpdate

router = APIRouter(prefix="/api/v1/projects", tags=["projects"])


@router.post("", response_model=ProjectOut, status_code=201)
async def create_project(data: ProjectCreate, db: AsyncSession = Depends(get_db)):
    project = Project(**data.model_dump())
    db.add(project)
    await db.commit()
    result = await db.execute(
        select(Project).options(selectinload(Project.scenes)).where(Project.id == project.id)
    )
    return result.scalars().first()


@router.get("", response_model=list[ProjectListOut])
async def list_projects(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).order_by(Project.created_at.desc()))
    return result.scalars().all()


@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(project_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Project).options(selectinload(Project.scenes)).where(Project.id == project_id)
    )
    project = result.scalars().first()
    if not project:
        raise HTTPException(404, "Project not found")
    return project


@router.put("/{project_id}", response_model=ProjectOut)
async def update_project(project_id: str, data: ProjectUpdate, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(project, key, val)
    await db.commit()
    result = await db.execute(
        select(Project).options(selectinload(Project.scenes)).where(Project.id == project_id)
    )
    return result.scalars().first()


@router.delete("/{project_id}", status_code=204)
async def delete_project(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    await db.delete(project)
    await db.commit()


class HarnessUpdate(BaseModel):
    harness: dict


@router.put("/{project_id}/harness")
async def update_harness(project_id: str, data: HarnessUpdate, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    project.harness = json.dumps(data.harness, ensure_ascii=False)
    await db.commit()
    return {"message": "하네스가 업데이트되었습니다."}


class HarnessChatRequest(BaseModel):
    request: str


@router.post("/{project_id}/harness/chat")
async def update_harness_with_chat(project_id: str, data: HarnessChatRequest, db: AsyncSession = Depends(get_db)):
    """자연어로 하네스 수정 요청 → Claude가 수정"""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    current = project.harness or "{}"

    prompt = f"""현재 프로젝트 하네스:
{current}

사용자 수정 요청: {data.request}

수정된 하네스를 JSON으로만 출력하세요. 기존 값을 유지하면서 요청된 부분만 수정.
형식: {{"visual_style": "...", "color_palette": "...", "camera_style": "...", "tone": "...", "target_audience": "...", "brand_keywords": [...], "prompt_prefix": "...", "banned_words": [...]}}
JSON만 출력. 다른 텍스트 금지."""

    raw = await llm_gateway.chat(
        [{"role": "user", "content": prompt}],
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
        new_harness = json.loads(text)
    except json.JSONDecodeError:
        raise HTTPException(500, "AI 응답을 파싱할 수 없습니다.")

    project.harness = json.dumps(new_harness, ensure_ascii=False)
    await db.commit()
    return {"message": "하네스가 수정되었습니다.", "harness": new_harness}


PARSE_SYNOPSIS_PROMPT = """다음 시놉시스/기획 문서를 분석하여 완전한 영상 프로젝트를 생성하세요.
시놉시스 → 시나리오(대본) → 프로덕션(프롬프트) → 후보정(트랜지션, 자막)까지 모두 자동 생성합니다.

## 입력 문서:
{synopsis_text}

## 출력 (JSON만, 다른 텍스트 금지):

{{"title": "프로젝트 제목", "brief": "1-2줄 요약", "synopsis_meta": {{"format": "영상 포맷 (예: 15초 광고, 30초 브랜드 필름, 60초 홍보영상, 뮤직비디오 등)", "genre": ["장르 태그 배열 (예: 프리미엄, 테크, 라이프스타일)"], "logline": "핵심 로그라인 1줄", "key_concept": "핵심 컨셉 설명", "visual_reference": "비주얼 레퍼런스 설명 (색감, 분위기, 참고 스타일)", "characters": "등장인물 또는 주요 피사체 설명", "target_audience": "타겟 오디언스"}}, "script": "전체 대본 텍스트 (전문 영상 각본 형식)", "scenes": [{{"title": "씬 제목", "description": "씬 설명 (한국어)", "script_formatted": "정리된 대본 ([카메라], N: 나레이션, SUPER: 자막)", "prompt": "영어 이미지 프롬프트 (구도, 조명, 색감, 카메라앵글 상세)", "duration_sec": 3.0, "transition": "cut 또는 dissolve 또는 fade_black", "subtitle": "자막 텍스트", "subtitle_style": "default 또는 bold 또는 minimal 또는 cinematic"}}]}}

규칙:
- 문서를 최대한 반영. 빠뜨리지 말 것
- script_formatted: 전문 영상 각본 포맷. [카메라], N: 나레이션, SUPER: 자막 포함
- prompt: 반드시 영어. 구도/조명/색감/분위기 구체적으로
- transition: 첫 씬은 "fade_black", 마지막 씬은 "fade_black", 나머지는 내용에 맞게 cut/dissolve
- subtitle: 나레이션이나 핵심 카피가 있으면 자막으로
- 최소 3개, 최대 8개 씬"""


class SynopsisImport(BaseModel):
    synopsis_text: str
    title: str | None = None


@router.post("/import-synopsis", response_model=ProjectOut, status_code=201)
async def import_synopsis(data: SynopsisImport, db: AsyncSession = Depends(get_db)):
    """시놉시스 텍스트를 넣으면 AI가 자동으로 프로젝트 구조를 만듦"""
    from app.config import settings

    if settings.AI_MODE == "mock":
        parsed = {
            "title": data.title or "자동 생성 프로젝트",
            "brief": data.synopsis_text[:100],
            "script": data.synopsis_text,
            "scenes": [
                {"title": "씬 1", "description": "첫 번째 장면", "prompt": "Opening scene, cinematic", "duration_sec": 4.0},
                {"title": "씬 2", "description": "두 번째 장면", "prompt": "Main scene, dramatic", "duration_sec": 5.0},
                {"title": "씬 3", "description": "마지막 장면", "prompt": "Closing scene, elegant", "duration_sec": 3.0},
            ],
        }
    else:
        prompt = PARSE_SYNOPSIS_PROMPT.format(synopsis_text=data.synopsis_text)
        raw = await llm_gateway.chat(
            [{"role": "user", "content": prompt}],
            system="반드시 JSON 형식으로만 응답하세요. 다른 텍스트 없이.",
        )
        text = raw.strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif not text.startswith("{"):
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
            parsed = json.loads(text)
        except json.JSONDecodeError:
            raise HTTPException(500, "AI가 문서를 파싱하지 못했습니다. 다시 시도해주세요.")

    # Create project
    synopsis_meta = parsed.get("synopsis_meta", {})
    project = Project(
        title=data.title or parsed.get("title", "프로젝트"),
        brief=parsed.get("brief", data.synopsis_text[:200]),
        script=parsed.get("script", data.synopsis_text),
        synopsis_data=json.dumps(synopsis_meta, ensure_ascii=False) if synopsis_meta else None,
        status="scenes_review",
    )
    db.add(project)
    await db.flush()

    # Create scenes
    for i, s in enumerate(parsed.get("scenes", [])):
        scene = Scene(
            project_id=project.id,
            order_index=i,
            title=s.get("title", f"씬 {i + 1}"),
            description=s.get("description", ""),
            script_formatted=s.get("script_formatted", ""),
            prompt=s.get("prompt", ""),
            duration_sec=s.get("duration_sec", 3.0),
            transition=s.get("transition", "cut"),
            subtitles_json=json.dumps(
                [{"text": s["subtitle"], "start": 0, "end": s.get("duration_sec", 3.0), "style": s.get("subtitle_style", "default")}]
                if s.get("subtitle") else [],
                ensure_ascii=False,
            ),
            status="pending",
        )
        db.add(scene)

    await db.commit()
    result = await db.execute(
        select(Project).options(selectinload(Project.scenes)).where(Project.id == project.id)
    )
    return result.scalars().first()
