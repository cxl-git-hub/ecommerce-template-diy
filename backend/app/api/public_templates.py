from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.core.database import get_db
from app.models.template import Template
from app.models.template_version import TemplateVersion
from app.schemas.schemas import TemplateOut

router = APIRouter(prefix="/templates", tags=["用户端-模板广场"])


@router.get("", response_model=list[dict])
def list_published_templates(
    category_id: Optional[int] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(Template).filter(
        Template.status == "PUBLISHED",
        Template.is_deleted == 0,
    )
    if category_id:
        query = query.filter(Template.category_id == category_id)
    if search:
        query = query.filter(Template.title.contains(search))
    
    total = query.count()
    templates = query.order_by(Template.created_at.desc()).offset((page - 1) * size).limit(size).all()
    
    result = []
    for t in templates:
        published_version = None
        if t.published_version_id:
            published_version = db.query(TemplateVersion).filter(
                TemplateVersion.id == t.published_version_id,
            ).first()
        
        result.append({
            "id": t.id,
            "title": t.title,
            "description": t.description,
            "category_id": t.category_id,
            "canvas_width": t.canvas_width,
            "canvas_height": t.canvas_height,
            "status": t.status,
            "thumbnail_url": published_version.thumbnail_url if published_version else None,
            "published_version_id": t.published_version_id,
            "created_at": t.created_at.isoformat(),
        })
    
    return result
