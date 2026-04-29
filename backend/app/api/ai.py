import os
import uuid
import io
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.core.config import settings

router = APIRouter(prefix="/ai", tags=["AI功能"])


@router.post("/remove-bg")
async def remove_background(file: UploadFile = File(...)):
    """使用 rembg 进行 AI 抠图"""
    if file.content_type not in {"image/png", "image/jpeg", "image/webp"}:
        raise HTTPException(status_code=400, detail="不支持的图片格式")
    
    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail="文件大小超过限制")
    
    try:
        from rembg import remove
        from PIL import Image
        
        input_image = Image.open(io.BytesIO(content))
        output_image = remove(input_image)
        
        # 保存结果
        output_dir = os.path.join(settings.UPLOAD_DIR, "rembg")
        os.makedirs(output_dir, exist_ok=True)
        
        output_name = f"{uuid.uuid4().hex}.png"
        output_path = os.path.join(output_dir, output_name)
        output_image.save(output_path, "PNG")
        
        return {
            "file_path": f"/uploads/rembg/{output_name}",
            "file_name": output_name,
            "width": output_image.width,
            "height": output_image.height,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 抠图处理失败: {str(e)}")
