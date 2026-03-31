import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Scene(Base):
    __tablename__ = "scenes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id", ondelete="CASCADE"))
    order_index: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(255), default="")
    description: Mapped[str] = mapped_column(Text, default="")  # 사용자 자연어 설명 (한국어)
    script_formatted: Mapped[str] = mapped_column(Text, default="")  # AI 정리된 대본
    prompt: Mapped[str] = mapped_column(Text, default="")  # 이미지 생성용 영어 프롬프트
    duration_sec: Mapped[float] = mapped_column(Float, default=3.0)
    key_image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    video_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="pending")
    # pending → generating_image → image_ready → image_approved →
    # generating_video → video_ready → video_approved → completed
    image_model_used: Mapped[str | None] = mapped_column(String(50), nullable=True)
    video_model_used: Mapped[str | None] = mapped_column(String(50), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    # 후보정
    transition: Mapped[str] = mapped_column(String(30), default="cut")  # cut, dissolve, fade_black, fade_white, wipe, slide
    subtitles_json: Mapped[str] = mapped_column(Text, default="[]")  # JSON: [{text, start, end, style}]
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    project: Mapped["Project"] = relationship(back_populates="scenes")


from app.models.project import Project  # noqa: E402, F401
