import os
import uuid
import base64
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.models.user import User
from app.models.template import Template
from app.models.template_version import TemplateVersion
from app.models.user_design import UserDesign
from app.schemas.schemas import UserDesignCreate, UserDesignOut, UserDesignConfigUpdate, ExportRequest

router = APIRouter(prefix="/designs", tags=["用户设计"])


@router.post("", response_model=UserDesignOut)
def create_design(
    data: UserDesignCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    template = db.query(Template).filter(
        Template.id == data.template_id,
        Template.status == "PUBLISHED",
        Template.is_deleted == 0,
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在或未发布")
    
    published_version = db.query(TemplateVersion).filter(
        TemplateVersion.id == template.published_version_id,
    ).first()
    if not published_version:
        raise HTTPException(status_code=400, detail="模板没有发布版本")
    
    design = UserDesign(
        user_id=current_user.id,
        template_version_id=published_version.id,
        config_data=published_version.config_data,
    )
    db.add(design)
    db.commit()
    db.refresh(design)
    return design


@router.get("", response_model=list[UserDesignOut])
def list_designs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(UserDesign).filter(
        UserDesign.user_id == current_user.id,
    ).order_by(UserDesign.updated_at.desc()).all()


@router.get("/{design_id}", response_model=UserDesignOut)
def get_design(
    design_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    design = db.query(UserDesign).filter(
        UserDesign.id == design_id,
        UserDesign.user_id == current_user.id,
    ).first()
    if not design:
        raise HTTPException(status_code=404, detail="设计不存在")
    return design


@router.put("/{design_id}/config", response_model=UserDesignOut)
def update_design_config(
    design_id: int,
    data: UserDesignConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    design = db.query(UserDesign).filter(
        UserDesign.id == design_id,
        UserDesign.user_id == current_user.id,
    ).first()
    if not design:
        raise HTTPException(status_code=404, detail="设计不存在")
    design.config_data = data.config_data

    # 处理缩略图
    if data.thumbnail_base64:
        try:
            b64_str = data.thumbnail_base64
            if "," in b64_str:
                b64_str = b64_str.split(",", 1)[1]
            img_bytes = base64.b64decode(b64_str)
            thumb_dir = os.path.join(settings.UPLOAD_DIR, "thumbnails")
            os.makedirs(thumb_dir, exist_ok=True)
            filename = f"udesign_{design_id}_{uuid.uuid4().hex[:8]}.png"
            filepath = os.path.join(thumb_dir, filename)
            with open(filepath, "wb") as f:
                f.write(img_bytes)
            design.thumbnail_url = f"/uploads/thumbnails/{filename}"
        except Exception:
            pass  # 缩略图保存失败不影响配置更新

    db.commit()
    db.refresh(design)
    return design


@router.post("/{design_id}/export")
def export_design(
    design_id: int,
    data: ExportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    design = db.query(UserDesign).filter(
        UserDesign.id == design_id,
        UserDesign.user_id == current_user.id,
    ).first()
    if not design:
        raise HTTPException(status_code=404, detail="设计不存在")
    
    # 返回配置数据，前端使用 Konva Stage.toDataURL 导出
    design.status = "EXPORTED"
    db.commit()
    return {
        "message": "导出成功",
        "design_id": design.id,
        "config_data": design.config_data,
        "format": data.format,
        "quality": data.quality,
    }


@router.delete("/{design_id}")
def delete_design(
    design_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    design = db.query(UserDesign).filter(
        UserDesign.id == design_id,
        UserDesign.user_id == current_user.id,
    ).first()
    if not design:
        raise HTTPException(status_code=404, detail="设计不存在")
    db.delete(design)
    db.commit()
    return {"message": "删除成功"}


@router.get("/{design_id}/thumbnail")
def get_design_thumbnail(
    design_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    design = db.query(UserDesign).filter(
        UserDesign.id == design_id,
        UserDesign.user_id == current_user.id,
    ).first()
    if not design:
        raise HTTPException(status_code=404, detail="设计不存在")
    return {"thumbnail_url": design.thumbnail_url}
