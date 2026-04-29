import os
import uuid
import io
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import List
from app.core.config import settings

router = APIRouter(prefix="/utils", tags=["工具"])


@router.post("/make-transparent")
async def make_transparent(
    file: UploadFile = File(...),
    points: str = Form(...),  # JSON 格式的多边形路径点列表
):
    """接收原图 + 多边形路径点列表，返回处理后的透明 PNG"""
    import json
    from PIL import Image, ImageDraw
    
    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail="文件大小超过限制")
    
    try:
        point_list = json.loads(points)
        
        img = Image.open(io.BytesIO(content)).convert("RGBA")
        mask = Image.new("L", img.size, 255)
        draw = ImageDraw.Draw(mask)
        
        # 绘制多边形区域为透明（0=透明, 255=不透明）
        polygon_points = [(p["x"], p["y"]) for p in point_list]
        draw.polygon(polygon_points, fill=0)
        
        # 应用蒙版
        img.putalpha(mask)
        
        # 保存结果
        output_dir = os.path.join(settings.UPLOAD_DIR, "images")
        os.makedirs(output_dir, exist_ok=True)
        output_name = f"{uuid.uuid4().hex}.png"
        output_path = os.path.join(output_dir, output_name)
        img.save(output_path, "PNG")
        
        return {
            "file_path": f"/uploads/images/{output_name}",
            "file_name": output_name,
            "width": img.width,
            "height": img.height,
        }
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="points 参数格式错误，需要 JSON 数组")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")
