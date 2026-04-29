import os
import uuid
import json
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional
from app.core.database import get_db
from app.core.security import get_current_user, require_admin
from app.core.config import settings
from app.models.asset import Asset
from app.models.user import User
from app.models.template import Template
from app.models.template_version import TemplateVersion
from app.schemas.schemas import AssetOut

router = APIRouter(prefix="/assets", tags=["素材管理"])

ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"}
ALLOWED_FONT_TYPES = {"font/ttf", "font/otf", "application/font-woff", "application/font-woff2",
                      "font/woff", "font/woff2", "application/octet-stream"}
ALLOWED_FONT_EXTENSIONS = {".ttf", ".otf", ".woff", ".woff2"}


@router.get("", response_model=list[AssetOut])
def list_assets(
    type: Optional[str] = None,
    mine: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Asset)
    if type:
        query = query.filter(Asset.type == type)
    if mine:
        query = query.filter(Asset.owner_id == current_user.id)
    elif current_user.role != "admin":
        # 非管理员只能看公共资源和自己的资源
        query = query.filter(
            (Asset.owner_id == None) | (Asset.owner_id == current_user.id)  # noqa: E711
        )
    return query.order_by(Asset.created_at.desc()).all()


@router.post("/upload", response_model=AssetOut)
async def upload_asset(
    file: UploadFile = File(...),
    type: str = Form(...),  # IMAGE / FONT
    font_family: Optional[str] = Form(None),
    font_categories: Optional[str] = Form(None),  # 逗号分隔
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 验证类型
    if type == "IMAGE" and file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="不支持的图片格式")
    if type == "FONT":
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in ALLOWED_FONT_EXTENSIONS:
            raise HTTPException(status_code=400, detail="不支持的字体格式，仅支持 ttf/otf/woff/woff2")

    # 验证大小
    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail="文件大小超过限制")

    # 保存文件
    ext = os.path.splitext(file.filename)[1]
    unique_name = f"{uuid.uuid4().hex}{ext}"
    
    if type == "IMAGE":
        sub_dir = os.path.join(settings.UPLOAD_DIR, "images")
    else:
        sub_dir = os.path.join(settings.UPLOAD_DIR, "fonts")
    
    os.makedirs(sub_dir, exist_ok=True)
    real_file_path = os.path.join(sub_dir, unique_name)
    
    with open(real_file_path, "wb") as f:
        f.write(content)

    # 存储为 URL 路径，前端可直接通过静态文件服务访问
    url_sub_dir = "images" if type == "IMAGE" else "fonts"
    file_path = f"/uploads/{url_sub_dir}/{unique_name}"

    # 管理员上传的字体为公共资源，其他为私有
    owner_id = None
    if type == "FONT" and current_user.role == "admin":
        owner_id = None  # 公共字体
    else:
        owner_id = current_user.id

    # 图片元数据
    img_metadata = None
    if type == "IMAGE":
        try:
            from PIL import Image
            import io
            img = Image.open(io.BytesIO(content))
            img_metadata = {"width": img.width, "height": img.height}
        except Exception:
            pass

    asset = Asset(
        type=type,
        owner_id=owner_id,
        file_name=file.filename,
        file_path=file_path,
        mime_type=file.content_type or "application/octet-stream",
        file_size=len(content),
        asset_metadata=img_metadata,
        font_family=font_family if type == "FONT" else None,
        font_categories=font_categories.split(",") if font_categories and type == "FONT" else None,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


@router.delete("/{asset_id}")
def delete_asset(
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="素材不存在")
    # 权限检查
    if current_user.role != "admin" and asset.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权删除")

    # 检查素材是否被模板引用
    file_path = asset.file_path
    # 生成备选路径（带/前缀和不带/前缀）
    file_path_alt = file_path.lstrip("/") if file_path.startswith("/") else "/" + file_path
    file_name = asset.file_name
    is_referenced = False

    # 1. 检查 templates 表：通过 published_version 的 config_data 检查引用
    templates = db.query(Template).filter(Template.is_deleted == 0).all()
    for template in templates:
        if template.published_version_id:
            pub_version = db.query(TemplateVersion).filter(
                TemplateVersion.id == template.published_version_id
            ).first()
            if pub_version and pub_version.config_data:
                config_str = json.dumps(pub_version.config_data)
                if file_path in config_str or file_path_alt in config_str or file_name in config_str:
                    is_referenced = True
                    break

    # 2. 检查 template_versions 表：所有版本的 config_data
    if not is_referenced:
        versions = db.query(TemplateVersion).all()
        for version in versions:
            if version.config_data:
                config_str = json.dumps(version.config_data)
                if file_path in config_str or file_path_alt in config_str or file_name in config_str:
                    is_referenced = True
                    break

    if is_referenced:
        raise HTTPException(
            status_code=400,
            detail="该素材正在被模板使用，无法删除"
        )

    # 删除文件（file_path 是 URL 路径如 /uploads/images/xxx.png，需转为真实路径）
    real_path = asset.file_path.lstrip("/")
    if os.path.exists(real_path):
        os.remove(real_path)
    db.delete(asset)
    db.commit()
    return {"message": "删除成功"}


@router.get("/fonts", response_model=list[AssetOut])
def list_fonts(db: Session = Depends(get_db)):
    """获取所有公共字体列表"""
    return db.query(Asset).filter(
        Asset.type == "FONT",
        Asset.owner_id == None,  # noqa: E711
    ).order_by(Asset.created_at.desc()).all()


@router.get("/fonts/{font_id}/preview")
def font_preview(
    font_id: int,
    db: Session = Depends(get_db),
):
    """生成字体预览图片"""
    asset = db.query(Asset).filter(Asset.id == font_id, Asset.type == "FONT").first()
    if not asset:
        raise HTTPException(status_code=404, detail="字体不存在")

    # file_path 是 URL 路径如 /uploads/fonts/xxx.ttf，转为真实路径
    real_path = asset.file_path.lstrip("/")
    if not os.path.exists(real_path):
        raise HTTPException(status_code=404, detail="字体文件不存在")

    # 检查是否已有缓存的预览图
    thumb_dir = os.path.join(settings.UPLOAD_DIR, "thumbnails")
    os.makedirs(thumb_dir, exist_ok=True)
    thumb_name = f"font_preview_{font_id}.png"
    thumb_path = os.path.join(thumb_dir, thumb_name)

    # 如果预览图已存在且比字体文件新，直接返回
    if os.path.exists(thumb_path):
        if os.path.getmtime(thumb_path) >= os.path.getmtime(real_path):
            return {"url": f"/uploads/thumbnails/{thumb_name}"}

    # 使用 Pillow 生成预览图
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        raise HTTPException(status_code=500, detail="服务器未安装 Pillow，无法生成预览")

    preview_text = "AaBbCc 你好"
    img_width, img_height = 600, 200
    bg_color = (255, 255, 255)
    text_color = (33, 33, 33)

    img = Image.new("RGB", (img_width, img_height), bg_color)
    draw = ImageDraw.Draw(img)

    # 尝试加载字体，逐步减小字号以适配
    font_loaded = False
    for font_size in [64, 48, 36, 28]:
        try:
            font = ImageFont.truetype(real_path, font_size)
            font_loaded = True
            break
        except Exception:
            continue

    if not font_loaded:
        # 无法加载字体，使用默认字体
        font = ImageFont.load_default()

    # 计算文字位置使其居中
    bbox = draw.textbbox((0, 0), preview_text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (img_width - text_w) / 2
    y = (img_height - text_h) / 2

    draw.text((x, y), preview_text, fill=text_color, font=font)
    img.save(thumb_path, "PNG")

    return {"url": f"/uploads/thumbnails/{thumb_name}"}
