from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class TemplateVersion(Base):
    __tablename__ = "template_versions"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("templates.id"), nullable=False)
    version_number = Column(Integer, nullable=False)
    description = Column(String(500), nullable=True)
    config_data = Column(JSON, nullable=False)  # 完整图层配置
    thumbnail_url = Column(String(500), nullable=True)
    status = Column(String(20), nullable=False, default="DRAFT")  # DRAFT / PUBLISHED / ARCHIVED
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    published_at = Column(DateTime, nullable=True)

    template = relationship("Template", foreign_keys=[template_id], back_populates="versions")
