from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String(20), nullable=False)  # IMAGE / FONT
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # null = 公共资源
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    mime_type = Column(String(100), nullable=False)
    file_size = Column(Integer, nullable=False)
    asset_metadata = Column("metadata", JSON, nullable=True)  # 图片宽高等（列名 metadata，Python 属性名 asset_metadata 避免冲突）
    font_family = Column(String(200), nullable=True)  # 字体专用
    font_categories = Column(JSON, nullable=True)  # ["简体中文", "广告字体"] 等
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    owner = relationship("User", foreign_keys=[owner_id])
