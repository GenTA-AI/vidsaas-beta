from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session, get_db
from app.gateways.base import GenerateRequest
from app.gateways.image_gateway import image_gateway
from app.models.reference_image import ReferenceImage

router = APIRouter(prefix="/api/v1/projects/{project_id}/references", tags=["references"])


class RefImageOut(BaseModel):
    id: str
    project_id: str
    category: str
    label: str
    prompt: str
    image_url: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class RefImageCreate(BaseModel):
    category: str  # character | background | object | style
    label: str
    prompt: str


@router.get("", response_model=list[RefImageOut])
async def list_references(project_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ReferenceImage)
        .where(ReferenceImage.project_id == project_id)
        .order_by(ReferenceImage.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=RefImageOut, status_code=201)
async def create_reference(
    project_id: str,
    data: RefImageCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """레퍼런스 이미지 생성 요청 (이미지는 백그라운드에서 생성)"""
    ref = ReferenceImage(
        project_id=project_id,
        category=data.category,
        label=data.label,
        prompt=data.prompt,
    )
    db.add(ref)
    await db.commit()
    await db.refresh(ref)

    ref_id = ref.id

    async def _generate():
        async with async_session() as session:
            r = await session.get(ReferenceImage, ref_id)
            if not r:
                return
            try:
                response = await image_gateway.generate(
                    GenerateRequest(
                        prompt=data.prompt,
                        model_id="nano-banana-2",
                        params={"scene_index": 0},
                    )
                )
                r.image_url = response.content
            except Exception as e:
                r.image_url = None
                import logging
                logging.error(f"Reference image generation failed: {e}")
            await session.commit()

    background_tasks.add_task(_generate)
    return ref


@router.delete("/{ref_id}", status_code=204)
async def delete_reference(ref_id: str, db: AsyncSession = Depends(get_db)):
    ref = await db.get(ReferenceImage, ref_id)
    if not ref:
        raise HTTPException(404, "Reference not found")
    await db.delete(ref)
    await db.commit()
