from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class UserDesign(Base):
    __tablename__ = "user_designs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    template_version_id = Column(Integer, ForeignKey("template_versions.id"), nullable=False)
    config_data = Column(JSON, nullable=False)  # 用户修改后的配置
    thumbnail_url = Column(String(500), nullable=True)
    status = Column(String(20), nullable=False, default="DRAFT")  # DRAFT / EXPORTED
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", foreign_keys=[user_id])
    template_version = relationship("TemplateVersion", foreign_keys=[template_version_id])
