import os
import uuid
import io
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional, List
from app.core.config import settings

router = APIRouter(prefix="/ai", tags=["AI功能"])

# 模型缓存
_models_cache = {}

def get_sam_model():
    """获取SAM模型（懒加载）"""
    if "sam" not in _models_cache:
        from segment_anything import sam_model_registry, SamPredictor
        import torch
        
        model_type = "vit_h"
        checkpoint_path = os.path.join(settings.MODELS_DIR, "sam_vit_h_4b8939.pth")
        
        if not os.path.exists(checkpoint_path):
            raise Exception(f"SAM模型文件不存在: {checkpoint_path}")
        
        device = "cuda" if torch.cuda.is_available() else "cpu"
        sam = sam_model_registry[model_type](checkpoint=checkpoint_path)
        sam.to(device)
        _models_cache["sam"] = SamPredictor(sam)
    
    return _models_cache["sam"]

def get_grounding_dino_model():
    """获取Grounding DINO模型（懒加载）"""
    if "gdino" not in _models_cache:
        from groundingdino.util.inference import load_model, load_image, predict
        
        config_path = os.path.join(settings.MODELS_DIR, "GroundingDINO_SwinT_OGC.py")
        weights_path = os.path.join(settings.MODELS_DIR, "groundingdino_swint_ogc.pth")
        
        if not os.path.exists(config_path) or not os.path.exists(weights_path):
            raise Exception("Grounding DINO模型文件不存在")
        
        device = "cuda" if __import__('torch').cuda.is_available() else "cpu"
        model = load_model(config_path, weights_path, device=device)
        _models_cache["gdino"] = model
    
    return _models_cache["gdino"]


@router.post("/remove-bg")
async def remove_background(file: UploadFile = File(...)):
    """使用 rembg 进行 AI 抠图（简单主体抠图）"""
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


@router.post("/segment-by-text")
async def segment_by_text(
    file: UploadFile = File(...),
    text_prompt: str = Form(...),  # 文本提示，如 "person", "cat", "dog's head"
):
    """
    使用 Grounding DINO + SAM 进行文本引导的对象分割
    
    text_prompt 示例:
    - "person" - 人物
    - "cat" / "dog" - 动物
    - "face" / "head" / "hand" - 特定部位
    - "car" / "building" - 物体
    - "person's face" - 人物的脸
    - "cat's head" - 猫的头
    """
    if file.content_type not in {"image/png", "image/jpeg", "image/webp"}:
        raise HTTPException(status_code=400, detail="不支持的图片格式")
    
    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail="文件大小超过限制")
    
    try:
        import cv2
        import numpy as np
        from PIL import Image
        import torch
        
        # 读取图片
        input_image = Image.open(io.BytesIO(content)).convert("RGB")
        image_np = np.array(input_image)
        
        # 使用 Grounding DINO 检测对象
        from groundingdino.util.inference import load_image, predict as gdino_predict
        
        # 保存临时文件供 Grounding DINO 使用
        temp_input = os.path.join(settings.UPLOAD_DIR, f"temp_{uuid.uuid4().hex}.jpg")
        input_image.save(temp_input, "JPEG")
        
        try:
            image_source, image = load_image(temp_input)
            
            # 获取 Grounding DINO 模型
            model = get_grounding_dino_model()
            
            # 预测边界框
            BOX_THRESHOLD = 0.30
            TEXT_THRESHOLD = 0.25
            
            boxes, logits, phrases = gdino_predict(
                model=model,
                image=image,
                caption=text_prompt,
                box_threshold=BOX_THRESHOLD,
                text_threshold=TEXT_THRESHOLD,
            )
            
            if len(boxes) == 0:
                raise Exception(f"未找到匹配 '{text_prompt}' 的对象")
            
            # 选择置信度最高的检测结果
            best_idx = torch.argmax(logits).item()
            best_box = boxes[best_idx].cpu().numpy()
            
            # 将归一化坐标转换为像素坐标
            h, w = image_np.shape[:2]
            x1 = int(best_box[0] * w)
            y1 = int(best_box[1] * h)
            x2 = int(best_box[2] * w)
            y2 = int(best_box[3] * h)
            
            # 扩展边界框以包含完整对象
            padding = int(max(x2 - x1, y2 - y1) * 0.1)
            x1 = max(0, x1 - padding)
            y1 = max(0, y1 - padding)
            x2 = min(w, x2 + padding)
            y2 = min(h, y2 + padding)
            
            # 裁剪对象区域
            cropped = image_np[y1:y2, x1:x2]
            
            # 使用 SAM 进行精确分割
            sam_predictor = get_sam_model()
            sam_predictor.set_image(image_np)
            
            # 将边界框转换为 SAM 的输入格式
            box_xyxy = np.array([x1, y1, x2, y2])
            
            # 使用 SAM 预测掩码
            masks, scores, _ = sam_predictor.predict(
                box=box_xyxy,
                multimask_output=True,
            )
            
            # 选择最佳掩码
            best_mask_idx = np.argmax(scores)
            mask = masks[best_mask_idx]
            
            # 应用掩码生成透明背景图片
            result_image = Image.fromarray(image_np)
            result_image.putalpha(Image.fromarray((mask * 255).astype(np.uint8)))
            
            # 裁剪到对象边界框
            result_image = result_image.crop((x1, y1, x2, y2))
            
            # 保存结果
            output_dir = os.path.join(settings.UPLOAD_DIR, "segmented")
            os.makedirs(output_dir, exist_ok=True)
            
            output_name = f"{uuid.uuid4().hex}.png"
            output_path = os.path.join(output_dir, output_name)
            result_image.save(output_path, "PNG")
            
            return {
                "file_path": f"/uploads/segmented/{output_name}",
                "file_name": output_name,
                "width": result_image.width,
                "height": result_image.height,
                "detected_object": phrases[best_idx] if phrases else text_prompt,
                "confidence": float(logits[best_idx]),
            }
        finally:
            # 清理临时文件
            if os.path.exists(temp_input):
                os.remove(temp_input)
                
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 对象分割处理失败: {str(e)}")


@router.post("/detect-objects")
async def detect_objects(
    file: UploadFile = File(...),
    text_prompt: str = Form(default="person, cat, dog, face, head, hand"),
):
    """
    检测图片中的所有匹配对象，返回每个对象的边界框
    用于让用户选择要分割的对象
    """
    if file.content_type not in {"image/png", "image/jpeg", "image/webp"}:
        raise HTTPException(status_code=400, detail="不支持的图片格式")
    
    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail="文件大小超过限制")
    
    try:
        import torch
        from PIL import Image
        from groundingdino.util.inference import load_image, predict as gdino_predict
        
        # 读取图片
        input_image = Image.open(io.BytesIO(content)).convert("RGB")
        
        # 保存临时文件
        temp_input = os.path.join(settings.UPLOAD_DIR, f"temp_{uuid.uuid4().hex}.jpg")
        input_image.save(temp_input, "JPEG")
        
        try:
            image_source, image = load_image(temp_input)
            
            # 获取 Grounding DINO 模型
            model = get_grounding_dino_model()
            
            # 预测边界框
            BOX_THRESHOLD = 0.25
            TEXT_THRESHOLD = 0.20
            
            boxes, logits, phrases = gdino_predict(
                model=model,
                image=image,
                caption=text_prompt,
                box_threshold=BOX_THRESHOLD,
                text_threshold=TEXT_THRESHOLD,
            )
            
            h, w = image_source.shape[:2]
            
            detected_objects = []
            for i, (box, logit, phrase) in enumerate(zip(boxes, logits, phrases)):
                # 将归一化坐标转换为像素坐标
                x1, y1, x2, y2 = box.cpu().numpy()
                detected_objects.append({
                    "id": i,
                    "label": phrase,
                    "confidence": float(logit),
                    "bbox": {
                        "x1": float(x1),
                        "y1": float(y1),
                        "x2": float(x2),
                        "y2": float(y2),
                    }
                })
            
            return {
                "objects": detected_objects,
                "image_width": w,
                "image_height": h,
            }
        finally:
            if os.path.exists(temp_input):
                os.remove(temp_input)
                
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"对象检测失败: {str(e)}")
