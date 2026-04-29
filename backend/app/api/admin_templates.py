import os
import uuid
import base64
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.core.database import get_db
from app.core.security import require_admin, get_current_user
from app.core.config import settings
from app.models.template import Template
from app.models.template_version import TemplateVersion
from app.models.user import User
from app.schemas.schemas import (
    TemplateCreate, TemplateUpdate, TemplateOut, TemplateDetailOut,
    TemplateVersionOut, PublishRequest,
)

router = APIRouter(prefix="/admin/templates", tags=["管理员-模板管理"])


@router.get("", response_model=list[TemplateOut])
def list_templates(
    status: Optional[str] = None,
    category_id: Optional[int] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    query = db.query(Template).filter(Template.is_deleted == 0)
    if status:
        query = query.filter(Template.status == status)
    if category_id:
        query = query.filter(Template.category_id == category_id)
    if search:
        query = query.filter(Template.title.contains(search))
    return query.order_by(Template.created_at.desc()).all()


@router.post("", response_model=TemplateOut)
def create_template(
    data: TemplateCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    template = Template(
        title=data.title,
        category_id=data.category_id,
        canvas_width=data.canvas_width,
        canvas_height=data.canvas_height,
        created_by=admin.id,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


@router.get("/{template_id}", response_model=TemplateDetailOut)
def get_template(
    template_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    template = db.query(Template).filter(
        Template.id == template_id,
        Template.is_deleted == 0,
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")
    
    # 获取最新草稿配置
    draft_version = db.query(TemplateVersion).filter(
        TemplateVersion.template_id == template_id,
        TemplateVersion.status == "DRAFT",
    ).order_by(TemplateVersion.version_number.desc()).first()
    
    versions = db.query(TemplateVersion).filter(
        TemplateVersion.template_id == template_id,
    ).order_by(TemplateVersion.version_number.desc()).all()
    
    result = TemplateDetailOut.model_validate(template)
    result.current_draft_config = draft_version.config_data if draft_version else None
    result.current_draft_version_id = draft_version.id if draft_version else None
    result.versions = [TemplateVersionOut.model_validate(v) for v in versions]
    return result


@router.put("/{template_id}", response_model=TemplateOut)
def update_template(
    template_id: int,
    data: TemplateUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    template = db.query(Template).filter(
        Template.id == template_id,
        Template.is_deleted == 0,
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")
    if data.title is not None:
        template.title = data.title
    if data.description is not None:
        template.description = data.description
    if data.category_id is not None:
        template.category_id = data.category_id
    db.commit()
    db.refresh(template)
    return template


@router.delete("/{template_id}")
def delete_template(
    template_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    template = db.query(Template).filter(
        Template.id == template_id,
        Template.is_deleted == 0,
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")
    template.is_deleted = 1
    db.commit()
    return {"message": "删除成功"}


@router.post("/{template_id}/copy", response_model=TemplateOut)
def copy_template(
    template_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    template = db.query(Template).filter(
        Template.id == template_id,
        Template.is_deleted == 0,
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")
    
    new_template = Template(
        title=f"{template.title} (副本)",
        description=template.description,
        category_id=template.category_id,
        canvas_width=template.canvas_width,
        canvas_height=template.canvas_height,
        created_by=admin.id,
    )
    db.add(new_template)
    db.flush()
    
    # 复制所有版本
    versions = db.query(TemplateVersion).filter(
        TemplateVersion.template_id == template_id,
    ).all()
    for v in versions:
        new_v = TemplateVersion(
            template_id=new_template.id,
            version_number=v.version_number,
            description=v.description,
            config_data=v.config_data,
            thumbnail_url=v.thumbnail_url,
            status=v.status,
        )
        db.add(new_v)
    
    db.commit()
    db.refresh(new_template)
    return new_template


@router.put("/{template_id}/draft")
def save_draft(
    template_id: int,
    config_data: dict,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    template = db.query(Template).filter(
        Template.id == template_id,
        Template.is_deleted == 0,
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")
    
    # 查找现有草稿版本
    draft = db.query(TemplateVersion).filter(
        TemplateVersion.template_id == template_id,
        TemplateVersion.status == "DRAFT",
    ).first()
    
    if draft:
        draft.config_data = config_data
    else:
        max_ver = db.query(TemplateVersion).filter(
            TemplateVersion.template_id == template_id,
        ).count()
        draft = TemplateVersion(
            template_id=template_id,
            version_number=max_ver + 1,
            config_data=config_data,
            status="DRAFT",
        )
        db.add(draft)
    
    db.commit()
    db.refresh(draft)
    return {
        "message": "草稿已保存",
        "draft_id": draft.id,
        "version_number": draft.version_number,
    }


@router.post("/{template_id}/publish", response_model=TemplateVersionOut)
def publish_template(
    template_id: int,
    data: PublishRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    template = db.query(Template).filter(
        Template.id == template_id,
        Template.is_deleted == 0,
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")
    
    # 获取当前草稿配置
    draft = db.query(TemplateVersion).filter(
        TemplateVersion.template_id == template_id,
        TemplateVersion.status == "DRAFT",
    ).first()
    if not draft:
        raise HTTPException(status_code=400, detail="没有草稿可发布")
    
    # 将旧的发布版本归档
    old_published = db.query(TemplateVersion).filter(
        TemplateVersion.template_id == template_id,
        TemplateVersion.status == "PUBLISHED",
    ).all()
    for v in old_published:
        v.status = "ARCHIVED"
    
    # 创建新发布版本
    max_ver = db.query(TemplateVersion).filter(
        TemplateVersion.template_id == template_id,
    ).order_by(TemplateVersion.version_number.desc()).first()
    new_ver_num = (max_ver.version_number + 1) if max_ver else 1
    
    # 处理缩略图
    thumbnail_url = None
    if data.thumbnail_base64:
        try:
            # 去掉 data:image/png;base64, 前缀（如果有）
            b64_str = data.thumbnail_base64
            if "," in b64_str:
                b64_str = b64_str.split(",", 1)[1]
            img_bytes = base64.b64decode(b64_str)
            thumb_dir = os.path.join(settings.UPLOAD_DIR, "thumbnails")
            os.makedirs(thumb_dir, exist_ok=True)
            filename = f"tpl_{template_id}_v{new_ver_num}_{uuid.uuid4().hex[:8]}.png"
            filepath = os.path.join(thumb_dir, filename)
            with open(filepath, "wb") as f:
                f.write(img_bytes)
            thumbnail_url = f"/uploads/thumbnails/{filename}"
        except Exception:
            pass  # 缩略图生成失败不影响发布

    new_version = TemplateVersion(
        template_id=template_id,
        version_number=new_ver_num,
        description=data.description,
        config_data=draft.config_data,
        thumbnail_url=thumbnail_url,
        status="PUBLISHED",
        published_at=datetime.now(timezone.utc),
    )
    db.add(new_version)
    db.flush()

    # 删除草稿
    db.delete(draft)

    # 更新模板状态
    template.status = "PUBLISHED"
    template.published_version_id = new_version.id

    db.commit()
    db.refresh(new_version)
    return new_version


@router.post("/{template_id}/unpublish")
def unpublish_template(
    template_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    template = db.query(Template).filter(
        Template.id == template_id,
        Template.is_deleted == 0,
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")
    template.status = "DRAFT"
    db.commit()
    return {"message": "已下架"}


@router.get("/{template_id}/versions", response_model=list[TemplateVersionOut])
def list_versions(
    template_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return db.query(TemplateVersion).filter(
        TemplateVersion.template_id == template_id,
    ).order_by(TemplateVersion.version_number.desc()).all()


@router.get("/{template_id}/versions/{version_id}", response_model=TemplateVersionOut)
def get_version(
    template_id: int,
    version_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    version = db.query(TemplateVersion).filter(
        TemplateVersion.id == version_id,
        TemplateVersion.template_id == template_id,
    ).first()
    if not version:
        raise HTTPException(status_code=404, detail="版本不存在")
    return version


@router.post("/{template_id}/versions/{version_id}/copy", response_model=TemplateOut)
def copy_from_version(
    template_id: int,
    version_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    version = db.query(TemplateVersion).filter(
        TemplateVersion.id == version_id,
        TemplateVersion.template_id == template_id,
    ).first()
    if not version:
        raise HTTPException(status_code=404, detail="版本不存在")
    
    template = db.query(Template).filter(Template.id == template_id).first()
    
    new_template = Template(
        title=f"{template.title} - 版本{version.version_number}副本",
        description=template.description,
        category_id=template.category_id,
        canvas_width=template.canvas_width,
        canvas_height=template.canvas_height,
        created_by=admin.id,
    )
    db.add(new_template)
    db.flush()
    
    new_version = TemplateVersion(
        template_id=new_template.id,
        version_number=1,
        description=f"从版本 {version.version_number} 复制",
        config_data=version.config_data,
        thumbnail_url=version.thumbnail_url,
        status="DRAFT",
    )
    db.add(new_version)
    db.commit()
    db.refresh(new_template)
    return new_template
