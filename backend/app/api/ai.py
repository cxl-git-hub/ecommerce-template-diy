import os
import uuid
import io
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional, List
from pydantic import BaseModel
from app.core.config import settings

router = APIRouter(prefix="/ai", tags=["AI功能"])

# 模型缓存
_models_cache = {}

# SAM 2 模型配置
SAM2_CONFIGS = {
    "vit_h": {"checkpoint": "sam2_hiera_large.pt", "model_type": "sam2_hiera_l"},
    "vit_t": {"checkpoint": "sam2_hiera_tiny.pt", "model_type": "sam2_hiera_t"},
}


def get_sam2_model():
    """获取SAM 2模型（懒加载）"""
    if "sam2" not in _models_cache:
        import torch
        from sam2.build_sam import build_sam2
        from sam2.sam2_image_predictor import SAM2ImagePredictor
        
        # 使用配置
        config = SAM2_CONFIGS["vit_h"]
        checkpoint_path = os.path.join(settings.MODELS_DIR, config["checkpoint"])
        
        if not os.path.exists(checkpoint_path):
            raise Exception(f"SAM 2模型文件不存在: {checkpoint_path}")
        
        device = "cuda" if torch.cuda.is_available() else "cpu"
        
        # 构建模型
        sam2_model = build_sam2(
            config_file=None,  # 使用默认配置
            ckpt_path=checkpoint_path,
            device=device,
        )
        
        _models_cache["sam2"] = SAM2ImagePredictor(sam2_model)
    
    return _models_cache["sam2"]


def get_grounding_dino_model():
    """获取Grounding DINO模型（懒加载）"""
    if "gdino" not in _models_cache:
        from groundingdino.util.inference import load_model
        
        config_path = os.path.join(settings.MODELS_DIR, "GroundingDINO_SwinT_OGC.py")
        weights_path = os.path.join(settings.MODELS_DIR, "groundingdino_swint_ogc.pth")
        
        if not os.path.exists(config_path) or not os.path.exists(weights_path):
            raise Exception("Grounding DINO模型文件不存在")
        
        import torch
        device = "cuda" if torch.cuda.is_available() else "cpu"
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
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"AI 抠图处理失败: {str(e)}")


class PointPrompt(BaseModel):
    x: float  # 归一化坐标 [0, 1]
    y: float
    label: int  # 1=前景, 0=背景

class BoxPrompt(BaseModel):
    x1: float  # 归一化坐标 [0, 1]
    y1: float
    x2: float
    y2: float


@router.post("/segment-by-points")
async def segment_by_points(
    file: UploadFile = File(...),
    points: str = Form(...),  # JSON格式的点列表
    image_width: int = Form(...),
    image_height: int = Form(...),
):
    """
    使用 SAM 2 进行点提示分割
    
    points 格式: [{"x": 0.5, "y": 0.3, "label": 1}, ...]
    - x, y: 归一化坐标 [0, 1]
    - label: 1=前景点(要保留), 0=背景点(要去除)
    
    这种方式最精确，用户点击要保留的区域即可
    """
    if file.content_type not in {"image/png", "image/jpeg", "image/webp"}:
        raise HTTPException(status_code=400, detail="不支持的图片格式")
    
    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail="文件大小超过限制")
    
    try:
        import json
        import numpy as np
        from PIL import Image
        import torch
        
        # 解析点列表
        point_list = json.loads(points)
        if not point_list:
            raise HTTPException(status_code=400, detail="至少需要一个点")
        
        # 读取图片
        input_image = Image.open(io.BytesIO(content)).convert("RGB")
        image_np = np.array(input_image)
        h, w = image_np.shape[:2]
        
        # 转换归一化坐标为像素坐标
        points_array = np.array([[p["x"] * w, p["y"] * h] for p in point_list])
        labels_array = np.array([p["label"] for p in point_list])
        
        # 使用 SAM 2 进行分割
        sam2_predictor = get_sam2_model()
        sam2_predictor.set_image(image_np)
        
        # 预测掩码
        masks, scores, _ = sam2_predictor.predict(
            point_coords=points_array,
            point_labels=labels_array,
            multimask_output=True,
        )
        
        # 选择最佳掩码
        best_mask_idx = np.argmax(scores)
        mask = masks[best_mask_idx]
        
        # 应用掩码生成透明背景图片
        result_image = Image.fromarray(image_np)
        result_image.putalpha(Image.fromarray((mask * 255).astype(np.uint8)))
        
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
            "score": float(scores[best_mask_idx]),
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"点提示分割失败: {str(e)}")


@router.post("/segment-by-box")
async def segment_by_box(
    file: UploadFile = File(...),
    x1: float = Form(...),
    y1: float = Form(...),
    x2: float = Form(...),
    y2: float = Form(...),
):
    """
    使用 SAM 2 进行框提示分割
    
    x1, y1, x2, y2: 归一化坐标 [0, 1]
    
    用户框选要分割的区域
    """
    if file.content_type not in {"image/png", "image/jpeg", "image/webp"}:
        raise HTTPException(status_code=400, detail="不支持的图片格式")
    
    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail="文件大小超过限制")
    
    try:
        import numpy as np
        from PIL import Image
        
        # 读取图片
        input_image = Image.open(io.BytesIO(content)).convert("RGB")
        image_np = np.array(input_image)
        h, w = image_np.shape[:2]
        
        # 转换归一化坐标为像素坐标
        box = np.array([x1 * w, y1 * h, x2 * w, y2 * h])
        
        # 使用 SAM 2 进行分割
        sam2_predictor = get_sam2_model()
        sam2_predictor.set_image(image_np)
        
        # 预测掩码
        masks, scores, _ = sam2_predictor.predict(
            box=box,
            multimask_output=True,
        )
        
        # 选择最佳掩码
        best_mask_idx = np.argmax(scores)
        mask = masks[best_mask_idx]
        
        # 应用掩码生成透明背景图片
        result_image = Image.fromarray(image_np)
        result_image.putalpha(Image.fromarray((mask * 255).astype(np.uint8)))
        
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
            "score": float(scores[best_mask_idx]),
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"框提示分割失败: {str(e)}")


@router.post("/detect-and-segment")
async def detect_and_segment(
    file: UploadFile = File(...),
    text_prompt: str = Form(...),
):
    """
    使用 Grounding DINO + SAM 2 进行文本引导的对象分割
    
    text_prompt 示例:
    - "person" - 人物
    - "cat" / "dog" - 动物
    - "face" / "head" / "hand" - 特定部位
    - "car" / "building" - 物体
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
        from groundingdino.util.inference import load_image, predict as gdino_predict
        from groundingdino.util.box_ops import box_cxcywh_to_xyxy
        
        # 读取图片
        input_image = Image.open(io.BytesIO(content)).convert("RGB")
        image_np = np.array(input_image)
        h, w = image_np.shape[:2]
        
        # 保存临时文件供 Grounding DINO 使用
        temp_input = os.path.join(settings.UPLOAD_DIR, f"temp_{uuid.uuid4().hex}.jpg")
        input_image.save(temp_input, "JPEG")
        
        try:
            image_source, image = load_image(temp_input)
            
            # 获取 Grounding DINO 模型
            model = get_grounding_dino_model()
            
            # 预测边界框
            BOX_THRESHOLD = 0.35
            TEXT_THRESHOLD = 0.25
            
            boxes, logits, phrases = gdino_predict(
                model=model,
                image=image,
                caption=text_prompt,
                box_threshold=BOX_THRESHOLD,
                text_threshold=TEXT_THRESHOLD,
                device="cpu",
            )
            
            if len(boxes) == 0:
                raise Exception(f"未找到匹配 '{text_prompt}' 的对象")
            
            # 选择置信度最高的检测结果
            best_idx = torch.argmax(logits).item()
            best_box = boxes[best_idx].cpu().numpy()
            
            # 将归一化的 cx,cy,w,h 转换为像素坐标 x1,y1,x2,y2
            best_box_tensor = torch.tensor(best_box).unsqueeze(0)
            best_box_xyxy = box_cxcywh_to_xyxy(best_box_tensor).squeeze(0).numpy()
            
            x1 = int(best_box_xyxy[0] * w)
            y1 = int(best_box_xyxy[1] * h)
            x2 = int(best_box_xyxy[2] * w)
            y2 = int(best_box_xyxy[3] * h)
            
            # 确保坐标合法
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w, x2), min(h, y2)
            
            # 使用 SAM 2 进行精确分割
            sam2_predictor = get_sam2_model()
            sam2_predictor.set_image(image_np)
            
            # 使用边界框作为提示
            box_array = np.array([x1, y1, x2, y2])
            
            masks, scores, _ = sam2_predictor.predict(
                box=box_array,
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
                "mask_score": float(scores[best_mask_idx]),
            }
        finally:
            if os.path.exists(temp_input):
                os.remove(temp_input)
                
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"检测分割失败: {str(e)}")


@router.post("/detect-objects")
async def detect_objects(
    file: UploadFile = File(...),
    text_prompt: str = Form(default="person, cat, dog, face, head, hand, car, building"),
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
        
        input_image = Image.open(io.BytesIO(content)).convert("RGB")
        
        temp_input = os.path.join(settings.UPLOAD_DIR, f"temp_{uuid.uuid4().hex}.jpg")
        input_image.save(temp_input, "JPEG")
        
        try:
            image_source, image = load_image(temp_input)
            
            model = get_grounding_dino_model()
            
            BOX_THRESHOLD = 0.30
            TEXT_THRESHOLD = 0.20
            
            boxes, logits, phrases = gdino_predict(
                model=model,
                image=image,
                caption=text_prompt,
                box_threshold=BOX_THRESHOLD,
                text_threshold=TEXT_THRESHOLD,
                device="cpu",
            )
            
            h, w = image_source.shape[:2]
            
            detected_objects = []
            for i, (box, logit, phrase) in enumerate(zip(boxes, logits, phrases)):
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
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"对象检测失败: {str(e)}")
