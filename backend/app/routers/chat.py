import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.gateways.llm_gateway import SYSTEM_PROMPT, llm_gateway
from app.models.chat_message import ChatMessage
from app.models.project import Project
from app.models.scene import Scene

router = APIRouter(prefix="/api/v1/projects/{project_id}/chat", tags=["chat"])

APPLY_SYSTEM_PROMPT = """당신은 AI 영상 제작 전문 기획자입니다. 사용자가 프로젝트 수정을 요청하면:

1. 먼저 일반 대화로 상담하세요
2. 사용자가 구체적인 변경을 요청하면, 변경사항을 제안하세요
3. 변경사항 제안 시 반드시 아래 형식을 사용하세요:

[CHANGES_PROPOSAL]
```json
{
  "summary": "변경 요약 (한국어)",
  "changes": [
    {
      "target": "scene",
      "scene_index": 0,
      "field": "title 또는 description 또는 prompt 또는 script_formatted 또는 duration_sec 또는 subtitle 또는 transition",
      "before": "변경 전 값 (일부만 표시 가능)",
      "after": "변경 후 값"
    },
    {
      "target": "project",
      "field": "script 또는 title 또는 brief",
      "before": "변경 전",
      "after": "변경 후"
    }
  ]
}
```
[/CHANGES_PROPOSAL]

규칙:
- 변경을 제안할 때만 [CHANGES_PROPOSAL] 태그를 사용
- 일반 대화에서는 태그 없이 자연스럽게 대화
- 여러 씬을 동시에 수정 가능
- prompt는 영어로 작성"""


class ChatInput(BaseModel):
    message: str


class ChatMessageOut(BaseModel):
    id: str
    role: str
    content: str
    created_at: str

    model_config = {"from_attributes": True}


class ChatResponse(BaseModel):
    user_message: ChatMessageOut
    assistant_message: ChatMessageOut
    has_proposal: bool = False
    proposal: dict | None = None


class FinalizeResponse(BaseModel):
    script: str
    scenes: list[dict]


class ApplyChanges(BaseModel):
    changes: list[dict]


@router.get("", response_model=list[ChatMessageOut])
async def get_chat_history(project_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.project_id == project_id)
        .order_by(ChatMessage.created_at)
    )
    messages = result.scalars().all()
    return [
        ChatMessageOut(
            id=m.id, role=m.role, content=m.content, created_at=m.created_at.isoformat(),
        )
        for m in messages
    ]


@router.post("", response_model=ChatResponse)
async def send_chat_message(
    project_id: str,
    data: ChatInput,
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    if project.status == "draft":
        project.status = "planning"

    # Save user message
    user_msg = ChatMessage(project_id=project_id, role="user", content=data.message)
    db.add(user_msg)
    await db.commit()
    await db.refresh(user_msg)

    # Build conversation history
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.project_id == project_id)
        .order_by(ChatMessage.created_at)
    )
    all_messages = result.scalars().all()

    # Include current project state as context
    scenes_result = await db.execute(
        select(Scene).where(Scene.project_id == project_id).order_by(Scene.order_index)
    )
    scenes = scenes_result.scalars().all()

    project_context = ""
    if scenes:
        scene_summaries = []
        for s in scenes:
            scene_summaries.append(
                f"  씬 {s.order_index+1}: {s.title} ({s.duration_sec}초) - {s.description[:50] if s.description else '설명 없음'}"
            )
        project_context = f"\n\n[현재 프로젝트 상태]\n제목: {project.title}\n상태: {project.status}\n씬 수: {len(scenes)}개\n" + "\n".join(scene_summaries)

    claude_messages = []
    for msg in all_messages:
        content = msg.content
        if msg.role == "user" and msg.id == all_messages[0].id:
            content = f"[프로젝트 브리프]\n{project.brief}{project_context}\n\n[사용자 메시지]\n{content}"
        claude_messages.append({"role": msg.role, "content": content})

    # Determine system prompt based on project state
    system = SYSTEM_PROMPT if not scenes else APPLY_SYSTEM_PROMPT

    assistant_text = await llm_gateway.chat(claude_messages, system)

    # Check for change proposals
    has_proposal = "[CHANGES_PROPOSAL]" in assistant_text
    proposal = None
    display_text = assistant_text

    if has_proposal:
        try:
            proposal_raw = assistant_text.split("[CHANGES_PROPOSAL]")[1].split("[/CHANGES_PROPOSAL]")[0]
            if "```json" in proposal_raw:
                proposal_raw = proposal_raw.split("```json")[1].split("```")[0]
            elif "```" in proposal_raw:
                proposal_raw = proposal_raw.split("```")[1].split("```")[0]
            proposal = json.loads(proposal_raw.strip())
            # Clean display text
            display_text = assistant_text.split("[CHANGES_PROPOSAL]")[0].strip()
            after_tag = assistant_text.split("[/CHANGES_PROPOSAL]")
            if len(after_tag) > 1 and after_tag[1].strip():
                display_text += "\n\n" + after_tag[1].strip()
        except (json.JSONDecodeError, IndexError):
            has_proposal = False

    # Save assistant message
    assistant_msg = ChatMessage(project_id=project_id, role="assistant", content=display_text)
    db.add(assistant_msg)
    await db.commit()
    await db.refresh(assistant_msg)

    return ChatResponse(
        user_message=ChatMessageOut(
            id=user_msg.id, role=user_msg.role, content=user_msg.content,
            created_at=user_msg.created_at.isoformat(),
        ),
        assistant_message=ChatMessageOut(
            id=assistant_msg.id, role=assistant_msg.role, content=assistant_msg.content,
            created_at=assistant_msg.created_at.isoformat(),
        ),
        has_proposal=has_proposal,
        proposal=proposal,
    )


@router.post("/apply", response_model=dict)
async def apply_changes(
    project_id: str,
    data: ApplyChanges,
    db: AsyncSession = Depends(get_db),
):
    """채팅에서 제안된 변경사항을 실제로 적용"""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    scenes_result = await db.execute(
        select(Scene).where(Scene.project_id == project_id).order_by(Scene.order_index)
    )
    scenes = {s.order_index: s for s in scenes_result.scalars().all()}

    applied = 0
    for change in data.changes:
        target = change.get("target")
        field = change.get("field")
        after = change.get("after")

        if target == "project" and field and after is not None:
            if hasattr(project, field):
                setattr(project, field, after)
                applied += 1

        elif target == "scene":
            scene_idx = change.get("scene_index")
            if scene_idx is not None and scene_idx in scenes and field and after is not None:
                scene = scenes[scene_idx]
                if hasattr(scene, field):
                    setattr(scene, field, after)
                    applied += 1

    await db.commit()
    return {"message": f"{applied}개 변경사항이 적용되었습니다.", "applied": applied}


@router.post("/finalize", response_model=FinalizeResponse)
async def finalize_planning(
    project_id: str,
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.project_id == project_id)
        .order_by(ChatMessage.created_at)
    )
    all_messages = result.scalars().all()

    if not all_messages:
        raise HTTPException(400, "No chat history to finalize")

    claude_messages = []
    for msg in all_messages:
        content = msg.content
        if msg.role == "user" and msg.id == all_messages[0].id:
            content = f"[프로젝트 브리프]\n{project.brief}\n\n[사용자 메시지]\n{content}"
        claude_messages.append({"role": msg.role, "content": content})

    # Get finalized script + scenes (retry up to 3 times)
    data = None
    last_error = None
    for attempt in range(3):
        raw = await llm_gateway.finalize(claude_messages)

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
            data = json.loads(text)
            break
        except json.JSONDecodeError as e:
            last_error = e
            continue

    if data is None:
        raise HTTPException(500, f"AI 응답을 파싱할 수 없습니다. 다시 시도해주세요. ({last_error})")

    # Update project
    project.script = data["script"]
    project.status = "scenes_review"

    # Store harness
    harness = data.get("harness")
    if harness:
        project.harness = json.dumps(harness, ensure_ascii=False)

    # Store synopsis meta if present
    synopsis_meta = data.get("synopsis_meta")
    if synopsis_meta:
        project.synopsis_data = json.dumps(synopsis_meta, ensure_ascii=False)

    # Clear existing scenes and create new ones
    existing = await db.execute(select(Scene).where(Scene.project_id == project_id))
    for scene in existing.scalars().all():
        await db.delete(scene)

    for i, s in enumerate(data["scenes"]):
        scene = Scene(
            project_id=project_id,
            order_index=i,
            title=s.get("title", f"Scene {i + 1}"),
            prompt=s.get("prompt", ""),
            description=s.get("description", ""),
            script_formatted=s.get("script_formatted", ""),
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

    return FinalizeResponse(script=data["script"], scenes=data["scenes"])
