import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ProjectVersion(Base):
    __tablename__ = "project_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id", ondelete="CASCADE"))
    label: Mapped[str] = mapped_column(String(255))
    snapshot: Mapped[str] = mapped_column(Text)  # JSON snapshot of project + scenes
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
