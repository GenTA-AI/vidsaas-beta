import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.project import Project
from app.models.scene import Scene
from app.models.version import ProjectVersion

router = APIRouter(prefix="/api/v1/projects/{project_id}/versions", tags=["versions"])


class VersionOut(BaseModel):
    id: str
    project_id: str
    label: str
    created_at: datetime

    model_config = {"from_attributes": True}


class VersionCreate(BaseModel):
    label: str


class VersionDetail(BaseModel):
    id: str
    label: str
    created_at: datetime
    snapshot: dict

    model_config = {"from_attributes": True}


@router.get("", response_model=list[VersionOut])
async def list_versions(project_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ProjectVersion)
        .where(ProjectVersion.project_id == project_id)
        .order_by(ProjectVersion.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=VersionOut, status_code=201)
async def save_version(
    project_id: str,
    data: VersionCreate,
    db: AsyncSession = Depends(get_db),
):
    """현재 프로젝트 상태를 스냅샷으로 저장"""
    result = await db.execute(
        select(Project).options(selectinload(Project.scenes)).where(Project.id == project_id)
    )
    project = result.scalars().first()
    if not project:
        raise HTTPException(404, "Project not found")

    snapshot = {
        "title": project.title,
        "brief": project.brief,
        "status": project.status,
        "script": project.script,
        "harness": project.harness,
        "synopsis_data": project.synopsis_data,
        "scenes": [
            {
                "order_index": s.order_index,
                "title": s.title,
                "description": s.description,
                "script_formatted": s.script_formatted,
                "prompt": s.prompt,
                "duration_sec": s.duration_sec,
                "key_image_url": s.key_image_url,
                "video_url": s.video_url,
                "status": s.status,
                "transition": s.transition,
                "subtitles_json": s.subtitles_json,
            }
            for s in sorted(project.scenes, key=lambda x: x.order_index)
        ],
    }

    version = ProjectVersion(
        project_id=project_id,
        label=data.label,
        snapshot=json.dumps(snapshot, ensure_ascii=False),
    )
    db.add(version)
    await db.commit()
    await db.refresh(version)
    return version


@router.get("/{version_id}", response_model=VersionDetail)
async def get_version(version_id: str, db: AsyncSession = Depends(get_db)):
    v = await db.get(ProjectVersion, version_id)
    if not v:
        raise HTTPException(404, "Version not found")
    return VersionDetail(
        id=v.id,
        label=v.label,
        created_at=v.created_at,
        snapshot=json.loads(v.snapshot),
    )


@router.post("/{version_id}/restore")
async def restore_version(
    project_id: str,
    version_id: str,
    db: AsyncSession = Depends(get_db),
):
    """이전 버전으로 프로젝트 복원"""
    v = await db.get(ProjectVersion, version_id)
    if not v:
        raise HTTPException(404, "Version not found")

    snapshot = json.loads(v.snapshot)

    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    # Restore project fields
    project.title = snapshot["title"]
    project.brief = snapshot["brief"]
    project.status = snapshot["status"]
    project.script = snapshot.get("script")
    project.harness = snapshot.get("harness")
    project.synopsis_data = snapshot.get("synopsis_data")

    # Clear existing scenes
    existing = await db.execute(select(Scene).where(Scene.project_id == project_id))
    for scene in existing.scalars().all():
        await db.delete(scene)
    await db.flush()

    # Restore scenes
    for s in snapshot.get("scenes", []):
        scene = Scene(
            project_id=project_id,
            order_index=s["order_index"],
            title=s["title"],
            description=s.get("description", ""),
            script_formatted=s.get("script_formatted", ""),
            prompt=s.get("prompt", ""),
            duration_sec=s.get("duration_sec", 3.0),
            key_image_url=s.get("key_image_url"),
            video_url=s.get("video_url"),
            status=s.get("status", "pending"),
            transition=s.get("transition", "cut"),
            subtitles_json=s.get("subtitles_json", "[]"),
        )
        db.add(scene)

    await db.commit()
    return {"message": f"버전 '{v.label}'으로 복원되었습니다."}


@router.delete("/{version_id}", status_code=204)
async def delete_version(version_id: str, db: AsyncSession = Depends(get_db)):
    v = await db.get(ProjectVersion, version_id)
    if not v:
        raise HTTPException(404, "Version not found")
    await db.delete(v)
    await db.commit()
