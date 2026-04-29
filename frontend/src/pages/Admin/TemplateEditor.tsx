import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Stage, Layer, Image as KonvaImage, Text as KonvaText, Rect, Transformer, Line } from 'react-konva';
import { adminTemplateApi, assetApi, categoryApi } from '@/api';
import { useEditorStore } from '@/stores/useEditorStore';
import { Layer as LayerType, BackgroundLayer, ImageReplaceLayer, TextLayer, TemplateDetail, Asset, Category } from '@/types';
import { loadFont } from '@/utils/fontLoader';
import Konva from 'konva';

export default function AdminTemplateEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const stageContainerRef = useRef<HTMLDivElement>(null);
  const [template, setTemplate] = useState<TemplateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [versionDesc, setVersionDesc] = useState('');
  const [showAssets, setShowAssets] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetType, setAssetType] = useState<'IMAGE' | 'FONT'>('IMAGE');
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [isLassoMode, setIsLassoMode] = useState(false);
  const [lassoPoints, setLassoPoints] = useState<{ x: number; y: number }[]>([]);

  // 预览模式
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  // 文字层双击编辑
  const [editingTextLayerId, setEditingTextLayerId] = useState<string | null>(null);
  const [editingTextValue, setEditingTextValue] = useState('');
  const [editingTextRect, setEditingTextRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const textEditRef = useRef<HTMLTextAreaElement>(null);

  // 素材库选择回调（用于 image_replace 图层从素材库选择图片）
  const [assetSelectCallback, setAssetSelectCallback] = useState<((asset: Asset) => void) | null>(null);

  // 图层拖拽排序状态
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // 公共字体列表
  const [fontList, setFontList] = useState<Asset[]>([]);

  // 模板信息编辑
  const [showEditInfo, setShowEditInfo] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategoryId, setEditCategoryId] = useState<number | undefined>();
  const [categories, setCategories] = useState<Category[]>([]);

  // 版本配置预览
  const [previewVersionId, setPreviewVersionId] = useState<number | null>(null);
  const [previewConfig, setPreviewConfig] = useState<any>(null);

  const {
    canvasWidth, canvasHeight, layers, selectedLayerId,
    setConfig, getConfig, selectLayer, addLayer, removeLayer, updateLayer,
    reorderLayers, toggleLayerVisibility, toggleLayerLock, undo, redo, canUndo, canRedo,
  } = useEditorStore();

  // 加载模板
  useEffect(() => {
    const loadTemplate = async () => {
      try {
        const res = await adminTemplateApi.get(Number(id));
        setTemplate(res.data);
        setEditTitle(res.data.title);
        setEditDescription(res.data.description || '');
        setEditCategoryId(res.data.category_id || undefined);
        if (res.data.current_draft_config) {
          setConfig(res.data.current_draft_config);
        } else {
          setConfig({ width: res.data.canvas_width, height: res.data.canvas_height, layers: [] });
        }
      } catch (err) {
        alert('加载模板失败');
        navigate('/admin/templates');
      } finally {
        setLoading(false);
      }
    };
    loadTemplate();
    // 加载分类列表
    categoryApi.list().then((res) => setCategories(res.data)).catch(() => {});
  }, [id, setConfig, navigate]);

  // 预加载字体列表
  useEffect(() => {
    const loadFonts = async () => {
      try {
        const res = await assetApi.listFonts();
        setFontList(res.data);
        // 预加载所有字体到浏览器
        for (const font of res.data) {
          if (font.font_family && font.file_path) {
            loadFont(font.font_family, font.file_path.startsWith("/") ? font.file_path : `/${font.file_path}`);
          }
        }
      } catch {}
    };
    loadFonts();
  }, []);

  // 选中图层更新 Transformer
  useEffect(() => {
    if (!stageRef.current || !transformerRef.current) return;
    const stage = stageRef.current;
    // 预览模式下不显示 Transformer
    if (isPreviewMode) {
      transformerRef.current.nodes([]);
      transformerRef.current.getLayer()?.batchDraw();
      return;
    }
    if (selectedLayerId) {
      const node = stage.findOne(`#${selectedLayerId}`);
      if (node) {
        transformerRef.current.nodes([node]);
        transformerRef.current.getLayer()?.batchDraw();
        return;
      }
    }
    transformerRef.current.nodes([]);
    transformerRef.current.getLayer()?.batchDraw();
  }, [selectedLayerId, layers, isPreviewMode]);

  // 快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 编辑文字时禁用快捷键
      if (editingTextLayerId) return;
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') { e.preventDefault(); undo(); }
        if (e.key === 'y') { e.preventDefault(); redo(); }
      }
      if (e.key === 'Delete' && selectedLayerId) {
        removeLayer(selectedLayerId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, selectedLayerId, removeLayer, editingTextLayerId]);

  // 滚轮缩放
  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const scaleBy = 1.05;
    const stage = stageRef.current!;
    const oldScale = stageScale;
    const pointer = stage.getPointerPosition()!;
    const mousePointTo = { x: (pointer.x - stagePos.x) / oldScale, y: (pointer.y - stagePos.y) / oldScale };
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
    setStageScale(newScale);
    setStagePos({ x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale });
  }, [stageScale, stagePos]);

  // 保存草稿
  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const config = getConfig();
      await adminTemplateApi.saveDraft(Number(id), config);
      alert('草稿已保存');
    } catch (err: any) {
      alert(err.response?.data?.detail || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 发布
  const handlePublish = async () => {
    if (!versionDesc.trim()) return;
    setPublishing(true);
    try {
      const config = getConfig();
      await adminTemplateApi.saveDraft(Number(id), config);
      // 生成缩略图
      let thumbnailBase64: string | undefined;
      if (stageRef.current) {
        try {
          thumbnailBase64 = stageRef.current.toDataURL({ pixelRatio: 0.5 });
        } catch {}
      }
      await adminTemplateApi.publish(Number(id), versionDesc, thumbnailBase64);
      alert('发布成功');
      setShowPublish(false);
      setVersionDesc('');
      const res = await adminTemplateApi.get(Number(id));
      setTemplate(res.data);
    } catch (err: any) {
      alert(err.response?.data?.detail || '发布失败');
    } finally {
      setPublishing(false);
    }
  };

  // 下架
  const handleUnpublish = async () => {
    try {
      await adminTemplateApi.unpublish(Number(id));
      alert('已下架');
      const res = await adminTemplateApi.get(Number(id));
      setTemplate(res.data);
    } catch (err: any) {
      alert(err.response?.data?.detail || '下架失败');
    }
  };

  // 保存模板信息
  const handleSaveEditInfo = async () => {
    if (!editTitle.trim()) return;
    try {
      await adminTemplateApi.update(Number(id), {
        title: editTitle,
        description: editDescription || undefined,
        category_id: editCategoryId,
      });
      const res = await adminTemplateApi.get(Number(id));
      setTemplate(res.data);
      setShowEditInfo(false);
      alert('模板信息已更新');
    } catch (err: any) {
      alert(err.response?.data?.detail || '更新失败');
    }
  };

  // 预览版本配置
  const handlePreviewVersion = (versionId: number) => {
    if (previewVersionId === versionId) {
      setPreviewVersionId(null);
      setPreviewConfig(null);
      return;
    }
    const version = template?.versions?.find((v) => v.id === versionId);
    if (version) {
      setPreviewVersionId(versionId);
      setPreviewConfig(version.config_data);
    }
  };

  // 从历史版本复制为新模板
  const handleCopyFromVersion = async (versionId: number) => {
    if (!confirm('确定将此版本复制为新模板？')) return;
    try {
      const res = await adminTemplateApi.copyFromVersion(Number(id), versionId);
      alert('已复制为新模板');
      navigate(`/admin/templates/${res.data.id}/edit`);
    } catch (err: any) {
      alert(err.response?.data?.detail || '复制失败');
    }
  };

  // 加载素材库
  const loadAssets = async (type: 'IMAGE' | 'FONT') => {
    setAssetType(type);
    try {
      if (type === 'FONT') {
        const res = await assetApi.listFonts();
        setAssets(res.data);
      } else {
        const res = await assetApi.list({ type: 'IMAGE' });
        setAssets(res.data);
      }
      setShowAssets(true);
    } catch {}
  };

  // 打开素材库供 image_replace 图层选择图片
  const loadAssetsForLayer = async (callback: (asset: Asset) => void) => {
    setAssetSelectCallback(() => callback);
    try {
      const res = await assetApi.list({ type: 'IMAGE' });
      setAssets(res.data);
      setAssetType('IMAGE');
      setShowAssets(true);
    } catch {}
  };

  // 添加背景层
  const handleAddBackground = (asset: Asset) => {
    const newLayer: BackgroundLayer = {
      id: `bg_${Date.now()}`,
      type: 'background',
      locked: true,
      visible: true,
      name: '背景',
      image_url: asset.file_path.startsWith('/') ? asset.file_path : `/${asset.file_path}`,
      clip_path: null,
      x: 0,
      y: 0,
      width: canvasWidth,
      height: canvasHeight,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    };
    addLayer(newLayer);
    setShowAssets(false);
  };

  // 添加可替换图片层
  const handleAddImageReplace = (mode: 'normal' | 'ai_cutout') => {
    const newLayer: ImageReplaceLayer = {
      id: `img_${Date.now()}`,
      type: 'image_replace',
      replace_mode: mode,
      locked: false,
      visible: true,
      name: mode === 'ai_cutout' ? 'AI抠图层' : '替换图片',
      placeholder_url: '',
      user_image_url: null,
      x: 100,
      y: 100,
      width: 200,
      height: 200,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      clip: null,
    };
    addLayer(newLayer);
  };

  // 添加文字层
  const handleAddText = (fontFamily: string = 'sans-serif') => {
    const newLayer: TextLayer = {
      id: `text_${Date.now()}`,
      type: 'text',
      locked: false,
      visible: true,
      name: '文字',
      text: '双击编辑',
      font_family: fontFamily,
      font_size: 24,
      font_style: 'normal',
      font_weight: 'normal',
      text_decoration: 'none',
      line_height: 1.2,
      letter_spacing: 0,
      align: 'center',
      color: '#000000',
      stroke: null,
      stroke_width: 0,
      opacity: 1,
      x: canvasWidth / 2 - 100,
      y: canvasHeight / 2 - 15,
      width: 200,
      height: 30,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    };
    addLayer(newLayer);
  };

  // 多边形套索 - 处理背景透明化
  const handleLassoClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isLassoMode) return;
    const stage = stageRef.current!;
    const pos = stage.getRelativePointerPosition();
    if (!pos) return;
    setLassoPoints([...lassoPoints, { x: pos.x, y: pos.y }]);
  };

  const handleLassoComplete = async () => {
    if (lassoPoints.length < 3) {
      alert('至少需要3个点');
      return;
    }
    setIsLassoMode(false);
    setLassoPoints([]);
    alert('多边形套索完成，需要先上传背景图片再处理透明区域');
  };

  // 文字层双击编辑 - 计算文字层在屏幕上的位置并显示 textarea
  const handleTextEditStart = useCallback((layer: TextLayer) => {
    if (!stageRef.current || !stageContainerRef.current) return;
    const stage = stageRef.current;
    const containerRect = stageContainerRef.current.getBoundingClientRect();
    const textNode = stage.findOne(`#${layer.id}`);
    if (!textNode) return;

    const textRect = textNode.getClientRect({ relativeTo: stage });
    const absX = containerRect.left + textRect.x * stageScale + stagePos.x;
    const absY = containerRect.top + textRect.y * stageScale + stagePos.y;
    const absW = textRect.width * stageScale;
    const absH = textRect.height * stageScale;

    setEditingTextLayerId(layer.id);
    setEditingTextValue(layer.text);
    setEditingTextRect({ x: absX, y: absY, width: absW, height: absH });

    // 隐藏 Konva Text 节点（通过设为空字符串）在渲染层处理
    setTimeout(() => textEditRef.current?.focus(), 50);
  }, [stageScale, stagePos]);

  const handleTextEditEnd = useCallback(() => {
    if (editingTextLayerId) {
      updateLayer(editingTextLayerId, { text: editingTextValue } as Partial<TextLayer>);
    }
    setEditingTextLayerId(null);
    setEditingTextValue('');
    setEditingTextRect(null);
  }, [editingTextLayerId, editingTextValue, updateLayer]);

  const handleTextEditKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTextEditEnd();
    }
    if (e.key === 'Escape') {
      // Esc 取消编辑
      setEditingTextLayerId(null);
      setEditingTextValue('');
      setEditingTextRect(null);
    }
  }, [handleTextEditEnd]);

  // 素材库弹窗中的选择处理
  const handleAssetSelect = (asset: Asset) => {
    // 如果是为图层选择素材的回调
    if (assetSelectCallback) {
      assetSelectCallback(asset);
      setAssetSelectCallback(null);
      setShowAssets(false);
      return;
    }
    // 否则走原有逻辑（添加背景层 / 添加文字层）
    if (assetType === 'IMAGE') {
      handleAddBackground(asset);
    } else {
      handleAddText(asset.font_family || 'sans-serif');
      setShowAssets(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-screen">加载中...</div>;
  if (!template) return null;

  // 图层列表（反转为显示顺序，顶部 = 最上层）
  const reversedLayers = [...layers].reverse();

  return (
    <div className="flex h-[calc(100vh-3.5rem)] -mt-6 -mx-4">
      {/* 左侧工具面板 */}
      <div className="w-64 bg-white border-r overflow-y-auto p-4 space-y-4">
        <div>
          <h3 className="font-bold text-sm mb-2">添加图层</h3>
          <div className="space-y-2">
            <button onClick={() => loadAssets('IMAGE')} className="w-full text-left px-3 py-2 text-sm border rounded hover:bg-gray-50">
              🖼 添加背景层
            </button>
            <button onClick={() => handleAddImageReplace('normal')} className="w-full text-left px-3 py-2 text-sm border rounded hover:bg-gray-50">
              📷 可替换图片（普通）
            </button>
            <button onClick={() => handleAddImageReplace('ai_cutout')} className="w-full text-left px-3 py-2 text-sm border rounded hover:bg-gray-50">
              ✂️ 可替换图片（AI抠图）
            </button>
            <button onClick={() => loadAssets('FONT')} className="w-full text-left px-3 py-2 text-sm border rounded hover:bg-gray-50">
              🔤 文字层（选择字体）
            </button>
            <button onClick={() => handleAddText()} className="w-full text-left px-3 py-2 text-sm border rounded hover:bg-gray-50">
              📝 文字层（默认字体）
            </button>
          </div>
        </div>

        <div>
          <h3 className="font-bold text-sm mb-2">图层列表</h3>
          <div className="space-y-1">
            {reversedLayers.map((layer, idx) => {
              // idx in reversedLayers: 0=topmost
              // map back to layers array index: layers.length - 1 - idx
              const realIndex = layers.length - 1 - idx;
              return (
                <div
                  key={layer.id}
                  draggable
                  onDragStart={(e) => {
                    setDragIndex(realIndex);
                    e.dataTransfer.effectAllowed = 'move';
                    // 设置拖拽透明度
                    (e.target as HTMLElement).style.opacity = '0.5';
                  }}
                  onDragEnd={(e) => {
                    (e.target as HTMLElement).style.opacity = '1';
                    setDragIndex(null);
                    setDragOverIndex(null);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    setDragOverIndex(realIndex);
                  }}
                  onDragLeave={() => {
                    setDragOverIndex(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragIndex !== null && dragIndex !== realIndex) {
                      reorderLayers(dragIndex, realIndex);
                    }
                    setDragIndex(null);
                    setDragOverIndex(null);
                  }}
                  onClick={() => selectLayer(layer.id)}
                  className={`flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer text-xs transition-all ${
                    selectedLayerId === layer.id ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50'
                  } ${dragOverIndex === realIndex ? 'border-t-2 border-blue-400' : ''}`}
                >
                  <span className="cursor-grab text-gray-400 select-none" title="拖拽排序">⠿</span>
                  <button onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(layer.id); }}
                    className="text-xs opacity-60 hover:opacity-100">
                    {layer.visible ? '👁' : '🚫'}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); toggleLayerLock(layer.id); }}
                    className="text-xs opacity-60 hover:opacity-100">
                    {layer.locked ? '🔒' : '🔓'}
                  </button>
                  <span className="flex-1 truncate">{layer.name}</span>
                  <button onClick={(e) => { e.stopPropagation(); removeLayer(layer.id); }}
                    className="text-xs text-red-400 hover:text-red-600">✕</button>
                </div>
              );
            })}
          </div>
        </div>

        {/* 多边形套索 */}
        <div>
          <h3 className="font-bold text-sm mb-2">背景透明工具</h3>
          <button
            onClick={() => { setIsLassoMode(!isLassoMode); setLassoPoints([]); }}
            className={`w-full text-left px-3 py-2 text-sm border rounded ${isLassoMode ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'}`}
          >
            {isLassoMode ? '✅ 退出套索模式' : '🔶 多边形套索工具'}
          </button>
          {isLassoMode && lassoPoints.length >= 3 && (
            <button onClick={handleLassoComplete} className="w-full mt-2 px-3 py-2 text-sm bg-green-500 text-white rounded hover:bg-green-600">
              完成选区
            </button>
          )}
        </div>
      </div>

      {/* 中间画布 */}
      <div className="flex-1 bg-gray-200 overflow-hidden relative" ref={stageContainerRef}>
        {/* 工具栏 */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white rounded-lg shadow-md px-4 py-2 flex items-center gap-3 z-10">
          <button onClick={() => undo()} disabled={!canUndo()} className="text-sm disabled:opacity-30" title="撤销">↩️</button>
          <button onClick={() => redo()} disabled={!canRedo()} className="text-sm disabled:opacity-30" title="重做">↪️</button>
          <div className="w-px h-5 bg-gray-300" />
          <button
            onClick={() => {
              setIsPreviewMode(!isPreviewMode);
              if (!isPreviewMode) {
                selectLayer(null);
              }
            }}
            className={`text-sm font-medium px-2 py-0.5 rounded ${isPreviewMode ? 'bg-blue-500 text-white' : 'text-blue-600 hover:bg-blue-50'}`}
            title={isPreviewMode ? '退出预览' : '预览模式'}
          >
            {isPreviewMode ? '👁 退出预览' : '👁 预览'}
          </button>
          <div className="w-px h-5 bg-gray-300" />
          <button onClick={handleSaveDraft} disabled={saving} className="text-sm text-blue-600 font-medium">
            {saving ? '保存中...' : '保存草稿'}
          </button>
          <div className="w-px h-5 bg-gray-300" />
          <button onClick={() => setShowPublish(true)} className="text-sm text-green-600 font-medium">发布</button>
          {template?.status === 'PUBLISHED' && (
            <button onClick={handleUnpublish} className="text-sm text-orange-600 font-medium">下架</button>
          )}
          <div className="w-px h-5 bg-gray-300" />
          <button onClick={() => setShowEditInfo(true)} className="text-sm text-gray-600 font-medium">编辑信息</button>
        </div>

        <div className="w-full h-full flex items-center justify-center">
          <Stage
            ref={stageRef}
            width={canvasWidth}
            height={canvasHeight}
            scaleX={stageScale}
            scaleY={stageScale}
            x={stagePos.x}
            y={stagePos.y}
            onWheel={handleWheel}
            onClick={(e) => {
              if (isPreviewMode) return;
              if (isLassoMode) {
                handleLassoClick(e);
                return;
              }
              if (e.target === e.target.getStage()) {
                selectLayer(null);
              }
            }}
            style={{ backgroundColor: 'white', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}
          >
            <Layer>
              {layers.filter((l) => l.visible).map((layer) => (
                <AdminCanvasLayer
                  key={layer.id}
                  layer={layer}
                  isPreviewMode={isPreviewMode}
                  editingTextLayerId={editingTextLayerId}
                  onSelect={() => { if (!isPreviewMode) selectLayer(layer.id); }}
                  onTextEditStart={handleTextEditStart}
                  updateLayer={updateLayer}
                />
              ))}
              {/* 套索路径预览 */}
              {isLassoMode && lassoPoints.length > 0 && (
                <Line
                  points={lassoPoints.flatMap((p) => [p.x, p.y])}
                  stroke="red"
                  strokeWidth={2}
                  dash={[5, 5]}
                  closed={lassoPoints.length >= 3}
                />
              )}
              {!isPreviewMode && (
                <Transformer ref={transformerRef} rotateEnabled={true} enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']} />
              )}
            </Layer>
          </Stage>
        </div>

        {/* 文字层双击编辑 - 浮动 textarea */}
        {editingTextLayerId && editingTextRect && (() => {
          const editingLayer = layers.find(l => l.id === editingTextLayerId) as TextLayer | undefined;
          if (!editingLayer) return null;
          return (
            <textarea
              ref={textEditRef}
              value={editingTextValue}
              onChange={(e) => setEditingTextValue(e.target.value)}
              onBlur={handleTextEditEnd}
              onKeyDown={handleTextEditKeyDown}
              style={{
                position: 'fixed',
                left: editingTextRect.x,
                top: editingTextRect.y,
                width: editingTextRect.width,
                minHeight: editingTextRect.height,
                fontSize: `${editingLayer.font_size * stageScale}px`,
                fontFamily: editingLayer.font_family || 'sans-serif',
                fontWeight: editingLayer.font_weight || 'normal',
                fontStyle: editingLayer.font_style || 'normal',
                lineHeight: String(editingLayer.line_height || 1.2),
                letterSpacing: `${editingLayer.letter_spacing}px`,
                color: editingLayer.color || '#000',
                textAlign: (editingLayer.align as any) || 'center',
                border: '2px solid #3b82f6',
                borderRadius: '4px',
                padding: '4px',
                outline: 'none',
                resize: 'both',
                overflow: 'hidden',
                zIndex: 1000,
                background: 'rgba(255,255,255,0.8)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              }}
            />
          );
        })()}
      </div>

      {/* 右侧属性面板 */}
      <div className="w-72 bg-white border-l overflow-y-auto p-4">
        <h3 className="font-bold text-sm mb-3">属性</h3>
        {isPreviewMode ? (
          <p className="text-sm text-gray-500">预览模式中不可编辑属性</p>
        ) : selectedLayerId ? (
          <AdminLayerProperties
            layer={layers.find((l) => l.id === selectedLayerId)!}
            onUpdate={(updates) => updateLayer(selectedLayerId, updates)}
            fontList={fontList}
            onLoadAssetsForLayer={loadAssetsForLayer}
          />
        ) : (
          <p className="text-sm text-gray-500">选择一个图层查看属性</p>
        )}

        {/* 版本历史 */}
        {template?.versions && template.versions.length > 0 && (
          <div className="mt-6">
            <h3 className="font-bold text-sm mb-2">版本历史</h3>
            <div className="space-y-2">
              {template.versions.map((v) => (
                <div key={v.id} className={`flex border rounded overflow-hidden ${previewVersionId === v.id ? 'border-blue-400 ring-1 ring-blue-300' : ''}`}>
                  {/* 左侧缩略图 */}
                  {v.thumbnail_url ? (
                    <img src={v.thumbnail_url.startsWith('/') ? v.thumbnail_url : `/${v.thumbnail_url}`} alt={`v${v.version_number}`} className="w-20 h-20 object-cover bg-gray-100 flex-shrink-0" />
                  ) : (
                    <div className="w-20 h-20 bg-gray-100 flex items-center justify-center text-gray-300 text-xs flex-shrink-0">无缩略图</div>
                  )}
                  {/* 右侧版本信息 */}
                  <div className="flex-1 px-2 py-1.5 min-w-0">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">v{v.version_number} - {v.status === 'PUBLISHED' ? '已发布' : v.status === 'DRAFT' ? '草稿' : '归档'}</span>
                      <span className="text-gray-400">{new Date(v.created_at).toLocaleDateString('zh-CN')}</span>
                    </div>
                    {v.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{v.description}</p>}
                    <div className="flex gap-1.5 mt-1.5">
                      <button
                        onClick={() => handlePreviewVersion(v.id)}
                        className={`text-xs px-1.5 py-0.5 rounded border ${previewVersionId === v.id ? 'bg-blue-50 text-blue-600 border-blue-300' : 'text-gray-600 hover:bg-gray-50'}`}
                      >
                        {previewVersionId === v.id ? '退出预览' : '👁 预览'}
                      </button>
                      <button
                        onClick={() => handleCopyFromVersion(v.id)}
                        className="text-xs px-1.5 py-0.5 rounded border text-green-600 hover:bg-green-50"
                      >
                        📋 复制
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 素材选择弹窗 */}
      {showAssets && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[600px] max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold">
                  {assetType === 'FONT' ? '选择字体' : assetSelectCallback ? '替换图层图片' : '添加背景层'}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {assetType === 'FONT' ? '选择一个字体添加文字层' : assetSelectCallback ? '点击图片替换当前图层的占位图' : '点击图片设为背景层'}
                </p>
              </div>
              <button onClick={() => { setShowAssets(false); setAssetSelectCallback(null); }} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            {assets.length === 0 ? (
              <p className="text-gray-500 text-center py-8">暂无素材，请先在素材管理中上传</p>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {assets.map((asset) => (
                  <div
                    key={asset.id}
                    onClick={() => handleAssetSelect(asset)}
                    className="border rounded-lg p-3 cursor-pointer hover:border-blue-500 hover:bg-blue-50"
                  >
                    {assetType === 'IMAGE' ? (
                      <div className="aspect-square bg-gray-100 rounded mb-2 flex items-center justify-center overflow-hidden">
                        <img src={asset.file_path.startsWith('/') ? asset.file_path : `/${asset.file_path}`} alt={asset.file_name} className="max-w-full max-h-full object-contain" />
                      </div>
                    ) : (
                      <div className="aspect-square bg-gray-50 rounded mb-2 flex items-center justify-center">
                        <span className="text-lg" style={{ fontFamily: asset.font_family || 'sans-serif' }}>Aa</span>
                      </div>
                    )}
                    <p className="text-xs truncate">{asset.font_family || asset.file_name}</p>
                    {asset.font_categories && (
                      <p className="text-xs text-gray-400 truncate">{asset.font_categories.join(', ')}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 发布弹窗 */}
      {showPublish && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h2 className="text-lg font-bold mb-4">发布模板</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">版本描述</label>
              <textarea
                value={versionDesc}
                onChange={(e) => setVersionDesc(e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="描述本次发布的内容..."
              />
            </div>
            <p className="text-xs text-gray-400 mt-2">发布时将自动生成当前画布的缩略图</p>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowPublish(false)} className="px-4 py-2 border rounded hover:bg-gray-50">取消</button>
              <button onClick={handlePublish} disabled={publishing || !versionDesc.trim()} className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50">
                {publishing ? '发布中...' : '确认发布'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑模板信息弹窗 */}
      {showEditInfo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h2 className="text-lg font-bold mb-4">编辑模板信息</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">模板标题</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="模板描述..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">分类</label>
                <select
                  value={editCategoryId || ''}
                  onChange={(e) => setEditCategoryId(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">无分类</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowEditInfo(false)} className="px-4 py-2 border rounded hover:bg-gray-50">取消</button>
              <button onClick={handleSaveEditInfo} disabled={!editTitle.trim()} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50">保存</button>
            </div>
          </div>
        </div>
      )}

      {/* 版本配置预览覆盖层 */}
      {previewConfig && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-white rounded-lg shadow-xl border p-4 z-40 max-w-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold">版本配置预览（只读）</h3>
            <button onClick={() => { setPreviewVersionId(null); setPreviewConfig(null); }} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
          </div>
          <div className="flex items-center justify-center bg-gray-100 rounded p-2" style={{ maxHeight: '300px', overflow: 'auto' }}>
            <Stage
              width={previewConfig.width || canvasWidth}
              height={previewConfig.height || canvasHeight}
              scaleX={0.5}
              scaleY={0.5}
              style={{ backgroundColor: 'white' }}
            >
              <Layer>
                {(previewConfig.layers || []).filter((l: any) => l.visible !== false).map((layer: any) => (
                  <AdminCanvasLayer
                    key={layer.id}
                    layer={layer}
                    isPreviewMode={true}
                    editingTextLayerId={null}
                    onSelect={() => {}}
                    onTextEditStart={() => {}}
                    updateLayer={() => {}}
                  />
                ))}
              </Layer>
            </Stage>
          </div>
        </div>
      )}
    </div>
  );
}

// 管理员画布图层渲染
function AdminCanvasLayer({
  layer,
  isPreviewMode,
  editingTextLayerId,
  onSelect,
  onTextEditStart,
  updateLayer,
}: {
  layer: LayerType;
  isPreviewMode: boolean;
  editingTextLayerId: string | null;
  onSelect: () => void;
  onTextEditStart: (layer: TextLayer) => void;
  updateLayer: (id: string, updates: Partial<LayerType>) => void;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (layer.type === 'background' || layer.type === 'image_replace') {
      const rawSrc = layer.type === 'background'
        ? (layer as BackgroundLayer).image_url
        : (layer as ImageReplaceLayer).placeholder_url;
      if (rawSrc) {
        const src = rawSrc.startsWith('/') || rawSrc.startsWith('data:') || rawSrc.startsWith('http') ? rawSrc : `/${rawSrc}`;
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => setImage(img);
        img.src = src;
      }
    }
  }, [layer]);

  const commonProps = {
    id: layer.id,
    x: layer.x,
    y: layer.y,
    rotation: layer.rotation,
    scaleX: layer.scaleX,
    scaleY: layer.scaleY,
    draggable: !layer.locked && !isPreviewMode,
    onClick: onSelect,
    onTap: onSelect,
  };

  if (layer.type === 'background' && image) {
    return <KonvaImage {...commonProps} image={image} width={layer.width as number} height={layer.height as number} />;
  }

  if (layer.type === 'image_replace') {
    if (image) {
      return <KonvaImage {...commonProps} image={image} width={layer.width as number} height={layer.height as number} />;
    }
    const imgLayer = layer as ImageReplaceLayer;
    if (imgLayer.replace_mode === 'ai_cutout') {
      return (
        <Rect
          {...commonProps}
          width={layer.width as number}
          height={layer.height as number}
          fill="rgba(200,200,255,0.3)"
          stroke="#6666ff"
          strokeWidth={2}
          dash={[5, 5]}
        />
      );
    }
    return (
      <Rect
        {...commonProps}
        width={layer.width as number}
        height={layer.height as number}
        fill="#f0f0f0"
        stroke="#ccc"
        strokeWidth={2}
        dash={[5, 5]}
      />
    );
  }

  if (layer.type === 'text') {
    const textLayer = layer as TextLayer;
    // 双击编辑时隐藏 Konva Text（避免与 textarea 重叠）
    const displayText = editingTextLayerId === layer.id ? '' : textLayer.text;
    return (
      <KonvaText
        {...commonProps}
        text={displayText}
        fontSize={textLayer.font_size}
        fontFamily={textLayer.font_family}
        fontStyle={`${textLayer.font_weight === 'bold' ? 'bold ' : ''}${textLayer.font_style === 'italic' ? 'italic' : ''}`}
        fill={textLayer.color}
        align={textLayer.align}
        opacity={textLayer.opacity}
        letterSpacing={textLayer.letter_spacing}
        lineHeight={textLayer.line_height}
        width={layer.width as number}
        textDecoration={textLayer.text_decoration}
        stroke={textLayer.stroke || undefined}
        strokeWidth={textLayer.stroke_width}
        onDblClick={() => onTextEditStart(textLayer)}
        onDblTap={() => onTextEditStart(textLayer)}
      />
    );
  }

  return null;
}

// 管理员属性面板
function AdminLayerProperties({
  layer,
  onUpdate,
  fontList,
  onLoadAssetsForLayer,
}: {
  layer: LayerType;
  onUpdate: (updates: Partial<LayerType>) => void;
  fontList: Asset[];
  onLoadAssetsForLayer: (callback: (asset: Asset) => void) => void;
}) {
  const commonFields = (
    <>
      <PropInput label="名称" value={layer.name} onChange={(v) => onUpdate({ name: v })} />
      <PropInput label="X" value={String(layer.x)} type="number" onChange={(v) => onUpdate({ x: Number(v) })} />
      <PropInput label="Y" value={String(layer.y)} type="number" onChange={(v) => onUpdate({ y: Number(v) })} />
      <PropInput label="宽度" value={String(layer.width)} type="number" onChange={(v) => onUpdate({ width: Number(v) })} />
      <PropInput label="高度" value={String(layer.height)} type="number" onChange={(v) => onUpdate({ height: Number(v) })} />
      <PropInput label="旋转" value={String(layer.rotation)} type="number" onChange={(v) => onUpdate({ rotation: Number(v) })} />
      <div className="flex gap-4">
        <PropInput label="缩放X" value={String(layer.scaleX)} type="number" onChange={(v) => onUpdate({ scaleX: Number(v) })} />
        <PropInput label="缩放Y" value={String(layer.scaleY)} type="number" onChange={(v) => onUpdate({ scaleY: Number(v) })} />
      </div>
      <div className="flex gap-4">
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={layer.locked} onChange={(e) => onUpdate({ locked: e.target.checked })} /> 锁定
        </label>
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={layer.visible} onChange={(e) => onUpdate({ visible: e.target.checked })} /> 可见
        </label>
      </div>
    </>
  );

  if (layer.type === 'text') {
    const textLayer = layer as TextLayer;
    return (
      <div className="space-y-3">
        {commonFields}
        <PropInput label="文字内容" value={textLayer.text} onChange={(v) => onUpdate({ text: v } as any)} />
        {/* 字体下拉选择 */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">字体</label>
          <select
            value={textLayer.font_family}
            onChange={(e) => {
              const newFont = e.target.value;
              // 动态加载字体
              const fontAsset = fontList.find(f => f.font_family === newFont);
              if (fontAsset && fontAsset.file_path) {
                loadFont(newFont, fontAsset.file_path.startsWith("/") ? fontAsset.file_path : `/${fontAsset.file_path}`);
              }
              onUpdate({ font_family: newFont } as any);
            }}
            className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="sans-serif">默认 (sans-serif)</option>
            <option value="serif">衬线 (serif)</option>
            <option value="monospace">等宽 (monospace)</option>
            {fontList.filter(f => f.font_family).map((font) => (
              <option key={font.id} value={font.font_family!} style={{ fontFamily: font.font_family! }}>
                {font.font_family}
                {font.font_categories?.length ? ` (${font.font_categories.join(', ')})` : ''}
              </option>
            ))}
          </select>
        </div>
        <PropInput label="字号" value={String(textLayer.font_size)} type="number" onChange={(v) => onUpdate({ font_size: Number(v) } as any)} />
        <PropInput label="颜色" value={textLayer.color} type="color" onChange={(v) => onUpdate({ color: v } as any)} />
        <PropInput label="行高" value={String(textLayer.line_height)} type="number" onChange={(v) => onUpdate({ line_height: Number(v) } as any)} />
        <PropInput label="字间距" value={String(textLayer.letter_spacing)} type="number" onChange={(v) => onUpdate({ letter_spacing: Number(v) } as any)} />
        <div>
          <label className="block text-xs text-gray-500 mb-1">对齐方式</label>
          <select value={textLayer.align} onChange={(e) => onUpdate({ align: e.target.value } as any)} className="w-full px-2 py-1.5 border rounded text-sm">
            <option value="left">左对齐</option>
            <option value="center">居中</option>
            <option value="right">右对齐</option>
          </select>
        </div>
        <PropInput label="透明度" value={String(textLayer.opacity)} type="range" onChange={(v) => onUpdate({ opacity: Number(v) } as any)} />
        <div className="flex gap-3">
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" checked={textLayer.font_weight === 'bold'} onChange={(e) => onUpdate({ font_weight: e.target.checked ? 'bold' : 'normal' } as any)} /> 粗体
          </label>
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" checked={textLayer.font_style === 'italic'} onChange={(e) => onUpdate({ font_style: e.target.checked ? 'italic' : 'normal' } as any)} /> 斜体
          </label>
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" checked={textLayer.text_decoration === 'underline'} onChange={(e) => onUpdate({ text_decoration: e.target.checked ? 'underline' : 'none' } as any)} /> 下划线
          </label>
        </div>
        <PropInput label="描边颜色" value={textLayer.stroke || '#000000'} type="color" onChange={(v) => onUpdate({ stroke: v } as any)} />
        <PropInput label="描边宽度" value={String(textLayer.stroke_width)} type="number" onChange={(v) => onUpdate({ stroke_width: Number(v) } as any)} />
      </div>
    );
  }

  if (layer.type === 'image_replace') {
    const imgLayer = layer as ImageReplaceLayer;
    return (
      <div className="space-y-3">
        {commonFields}
        <div>
          <label className="block text-xs text-gray-500 mb-1">替换模式</label>
          <select
            value={imgLayer.replace_mode}
            onChange={(e) => onUpdate({ replace_mode: e.target.value } as any)}
            className="w-full px-2 py-1.5 border rounded text-sm"
          >
            <option value="normal">普通替换</option>
            <option value="ai_cutout">AI 抠图替换</option>
          </select>
        </div>
        {/* 当前 placeholder_url 显示 */}
        {imgLayer.placeholder_url && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">当前占位图</label>
            <img src={imgLayer.placeholder_url} alt="placeholder" className="w-full h-24 object-contain border rounded bg-gray-50" />
          </div>
        )}
        {/* 从素材库选择按钮 */}
        <button
          onClick={() => {
            onLoadAssetsForLayer((asset: Asset) => {
              onUpdate({ placeholder_url: asset.file_path.startsWith('/') ? asset.file_path : `/${asset.file_path}` } as any);
            });
          }}
          className="w-full px-3 py-2 text-sm border border-blue-300 text-blue-600 rounded hover:bg-blue-50"
        >
          🖼 从素材库选择图片
        </button>
      </div>
    );
  }

  return <div className="space-y-3">{commonFields}</div>;
}

function PropInput({ label, value, type = 'text', onChange }: {
  label: string;
  value: string;
  type?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        min={type === 'range' ? '0' : undefined}
        max={type === 'range' ? '1' : undefined}
        step={type === 'range' ? '0.1' : undefined}
      />
    </div>
  );
}
