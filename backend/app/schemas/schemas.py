from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


# ==================== Auth ====================
class UserRegister(BaseModel):
    email: str
    username: str
    password: str


class UserLogin(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    email: str
    username: str
    role: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ==================== Category ====================
class CategoryCreate(BaseModel):
    name: str
    sort_order: int = 0


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    sort_order: Optional[int] = None


class CategoryOut(BaseModel):
    id: int
    name: str
    sort_order: int
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== Asset ====================
class AssetOut(BaseModel):
    id: int
    type: str
    owner_id: Optional[int] = None
    file_name: str
    file_path: str
    mime_type: str
    file_size: int
    asset_metadata: Optional[dict] = None
    font_family: Optional[str] = None
    font_categories: Optional[list] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== Template ====================
class TemplateCreate(BaseModel):
    title: str
    category_id: Optional[int] = None
    canvas_width: int = 800
    canvas_height: int = 800


class TemplateUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category_id: Optional[int] = None


class TemplateOut(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    category_id: Optional[int] = None
    canvas_width: int
    canvas_height: int
    status: str
    published_version_id: Optional[int] = None
    created_by: int
    is_deleted: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TemplateDetailOut(TemplateOut):
    current_draft_config: Optional[dict] = None
    current_draft_version_id: Optional[int] = None
    versions: list["TemplateVersionOut"] = []


# ==================== Template Version ====================
class TemplateVersionOut(BaseModel):
    id: int
    template_id: int
    version_number: int
    description: Optional[str] = None
    config_data: dict
    thumbnail_url: Optional[str] = None
    status: str
    created_at: datetime
    published_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# 重建模型以解析前向引用 (TemplateVersionOut)
TemplateDetailOut.model_rebuild()


class PublishRequest(BaseModel):
    description: str
    thumbnail_base64: Optional[str] = None


# ==================== User Design ====================
class UserDesignCreate(BaseModel):
    template_id: int


class UserDesignOut(BaseModel):
    id: int
    user_id: int
    template_version_id: int
    config_data: dict
    thumbnail_url: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserDesignConfigUpdate(BaseModel):
    config_data: dict
    thumbnail_base64: Optional[str] = None


class ExportRequest(BaseModel):
    format: str = "png"  # png / jpeg
    quality: int = 90
