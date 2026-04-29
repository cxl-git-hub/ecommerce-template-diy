from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Template(Base):
    __tablename__ = "templates"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(String(1000), nullable=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    canvas_width = Column(Integer, nullable=False, default=800)
    canvas_height = Column(Integer, nullable=False, default=800)
    status = Column(String(20), nullable=False, default="DRAFT")  # DRAFT / PUBLISHED
    published_version_id = Column(Integer, ForeignKey("template_versions.id"), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_deleted = Column(Integer, nullable=False, default=0)  # 软删除
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    category = relationship("Category")
    creator = relationship("User", foreign_keys=[created_by])
    published_version = relationship("TemplateVersion", foreign_keys=[published_version_id])
    versions = relationship("TemplateVersion", foreign_keys="TemplateVersion.template_id", back_populates="template")
