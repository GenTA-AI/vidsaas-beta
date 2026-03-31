import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String(255))
    brief: Mapped[str] = mapped_column(Text)
    mode: Mapped[str] = mapped_column(String(20), default="director")  # director | full_auto
    status: Mapped[str] = mapped_column(String(30), default="draft")
    # draft → planning → scenes_review → image_generating →
    # images_review → video_generating → videos_review → completed
    script: Mapped[str | None] = mapped_column(Text, nullable=True)
    synopsis_data: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON: format, genre, logline, etc.
    harness: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON: 프로젝트 하네스 (스타일, 톤, 프롬프트 지침)
    llm_model: Mapped[str] = mapped_column(String(50), default="claude-sonnet-4")
    image_model: Mapped[str] = mapped_column(String(50), default="nano-banana-2")
    video_model: Mapped[str] = mapped_column(String(50), default="veo-3.1")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    scenes: Mapped[list["Scene"]] = relationship(back_populates="project", cascade="all, delete-orphan", order_by="Scene.order_index")
    pipeline_runs: Mapped[list["PipelineRun"]] = relationship(back_populates="project", cascade="all, delete-orphan")


# Import here to avoid circular imports but ensure relationships resolve
from app.models.scene import Scene  # noqa: E402, F401
from app.models.pipeline_run import PipelineRun  # noqa: E402, F401
