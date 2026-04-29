import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Stage, Layer, Image as KonvaImage, Text as KonvaText, Rect, Transformer } from 'react-konva';
import { designApi, assetApi } from '@/api';
import { useEditorStore } from '@/stores/useEditorStore';
import { Layer as LayerType, ImageReplaceLayer, TextLayer, BackgroundLayer, Asset } from '@/types';
import { loadFont } from '@/utils/fontLoader';
import AICutoutModal from '@/components/AICutoutModal';
import ExportModal from '@/components/ExportModal';
import Konva from 'konva';

export default function DesignEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });

  // 图层悬停状态
  const [hoveredLayerId, setHoveredLayerId] = useState<string | null>(null);

  // 文字编辑状态
  const [editingTextLayerId, setEditingTextLayerId] = useState<string | null>(null);
  const [editingTextValue, setEditingTextValue] = useState('');
  const [editingTextPos, setEditingTextPos] = useState({ x: 0, y: 0, width: 0, height: 0 });

  // 字体列表
  const [fonts, setFonts] = useState<Asset[]>([]);

  // 弹窗状态
  const [showAICutout, setShowAICutout] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [aicutoutTargetLayerId, setAicutoutTargetLayerId] = useState<string | null>(null);

  const {
    canvasWidth, canvasHeight, layers, selectedLayerId,
    setConfig, getConfig, selectLayer, updateLayer, undo, redo, canUndo, canRedo,
  } = useEditorStore();

  // 加载设计
  useEffect(() => {
    const loadDesign = async () => {
      try {
        const res = await designApi.get(Number(id));
        setConfig(res.data.config_data);
      } catch (err) {
        alert('加载设计失败');
        navigate('/my-designs');
      } finally {
        setLoading(false);
      }
    };
    loadDesign();
  }, [id, setConfig, navigate]);

  // 加载公共字体列表
  useEffect(() => {
    const loadFonts = async () => {
      try {
        const res = await assetApi.listFonts();
        setFonts(res.data as Asset[]);
        // 预加载所有字体
        const fontList = res.data as { font_family: string | null; file_path: string }[];
        for (const font of fontList) {
          if (font.font_family && font.file_path) {
            loadFont(font.font_family, font.file_path.startsWith("/") ? font.file_path : `/${font.file_path}`);
          }
        }
      } catch (err) {
        console.warn('字体列表加载失败', err);
      }
    };
    loadFonts();
  }, []);

  // 选中图层时更新 Transformer
  useEffect(() => {
    if (!stageRef.current || !transformerRef.current) return;
    const stage = stageRef.current;
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
  }, [selectedLayerId]);

  // 快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingTextLayerId) return; // 编辑文字时不处理快捷键
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') { e.preventDefault(); undo(); }
        if (e.key === 'y') { e.preventDefault(); redo(); }
      }
      if (e.key === 'Delete' && selectedLayerId) {
        const layer = layers.find((l) => l.id === selectedLayerId);
        if (layer && layer.type !== 'background') {
          useEditorStore.getState().removeLayer(selectedLayerId);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, selectedLayerId, layers, editingTextLayerId]);

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

  // 保存（自动生成缩略图）
  const handleSave = async () => {
    setSaving(true);
    try {
      const config = getConfig();
      let thumbnailBase64: string | undefined;
      if (stageRef.current) {
        transformerRef.current?.nodes([]);
        thumbnailBase64 = stageRef.current.toDataURL({ mimeType: 'image/png', pixelRatio: 0.5 });
        if (selectedLayerId) {
          const node = stageRef.current.findOne(`#${selectedLayerId}`);
          if (node) transformerRef.current?.nodes([node]);
        }
      }
      await designApi.updateConfig(Number(id), config, thumbnailBase64);
      alert('保存成功');
    } catch (err: any) {
      alert(err.response?.data?.detail || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 导出
  const handleExport = async (format: 'png' | 'jpeg', quality: number) => {
    if (!stageRef.current) return;
    // 先隐藏 transformer
    transformerRef.current?.nodes([]);
    const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const uri = stageRef.current.toDataURL({ mimeType, pixelRatio: 2, quality });
    // 恢复 transformer
    if (selectedLayerId) {
      const node = stageRef.current.findOne(`#${selectedLayerId}`);
      if (node) transformerRef.current?.nodes([node]);
    }

    const link = document.createElement('a');
    link.download = `design-${id}.${format}`;
    link.href = uri;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 文字层双击编辑
  const handleTextDblClick = (layerId: string) => {
    const layer = layers.find((l) => l.id === layerId) as TextLayer | undefined;
    if (!layer || layer.type !== 'text' || layer.locked) return;

    const stage = stageRef.current;
    if (!stage) return;

    const textNode = stage.findOne(`#${layerId}`);
    if (!textNode) return;

    const textPosition = textNode.getAbsolutePosition();
    const stageBox = stage.container().getBoundingClientRect();

    setEditingTextLayerId(layerId);
    setEditingTextValue(layer.text);
    setEditingTextPos({
      x: stageBox.left + textPosition.x * stageScale,
      y: stageBox.top + textPosition.y * stageScale,
      width: (layer.width as number) * stageScale,
      height: (layer.height as number) * stageScale,
    });
  };

  // 确认文字编辑
  const handleTextEditConfirm = () => {
    if (editingTextLayerId) {
      updateLayer(editingTextLayerId, { text: editingTextValue } as any);
      setEditingTextLayerId(null);
    }
  };

  // 字体变更（加载字体后更新）
  const handleFontChange = (layerId: string, fontFamily: string) => {
    const font = fonts.find((f) => f.font_family === fontFamily);
    if (font && font.file_path) {
      loadFont(fontFamily, font.file_path.startsWith("/") ? font.file_path : `/${font.file_path}`);
    }
    updateLayer(layerId, { font_family: fontFamily } as any);
  };

  // 普通图片替换
  const handleNormalImageReplace = (layerId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        updateLayer(layerId, { user_image_url: reader.result } as any);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  // AI 抠图替换
  const handleAICutoutReplace = (layerId: string) => {
    setAicutoutTargetLayerId(layerId);
    setShowAICutout(true);
  };

  // AI 抠图确认
  const handleAICutoutConfirm = (imageUrl: string) => {
    if (aicutoutTargetLayerId) {
      updateLayer(aicutoutTargetLayerId, { user_image_url: imageUrl } as any);
    }
    setAicutoutTargetLayerId(null);
  };

  // 获取选中图层的画布位置（用于悬浮按钮定位）
  const getSelectedLayerCanvasPos = () => {
    if (!selectedLayerId || !stageRef.current) return null;
    const node = stageRef.current.findOne(`#${selectedLayerId}`);
    if (!node) return null;
    const rect = node.getClientRect();
    const stageBox = stageRef.current.container().getBoundingClientRect();
    return {
      x: stageBox.left + (rect.x * stageScale + stagePos.x),
      y: stageBox.top + (rect.y * stageScale + stagePos.y),
      width: rect.width * stageScale,
      height: rect.height * stageScale,
    };
  };

  if (loading) return <div className="flex items-center justify-center h-screen">加载中...</div>;

  const selectedLayer = layers.find((l) => l.id === selectedLayerId);
  const selectedLayerPos = getSelectedLayerCanvasPos();

  return (
    <div className="flex h-[calc(100vh-3.5rem)] -mt-6 -mx-4">
      {/* 左侧图层面板 */}
      <div className="w-64 bg-white border-r overflow-y-auto p-4">
        <h3 className="font-bold text-sm mb-3">图层</h3>
        <div className="space-y-1">
          {[...layers].reverse().map((layer) => (
            <div
              key={layer.id}
              onClick={() => selectLayer(layer.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer text-sm ${
                selectedLayerId === layer.id ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50'
              }`}
            >
              <span className="flex-1 truncate">{layer.name}</span>
              {layer.locked && <span className="text-xs text-gray-400">🔒</span>}
              {!layer.visible && <span className="text-xs text-gray-400">👁</span>}
            </div>
          ))}
        </div>
      </div>

      {/* 中间画布 */}
      <div className="flex-1 bg-gray-200 overflow-hidden relative">
        {/* 用户端工具栏 */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white rounded-lg shadow-md px-4 py-2 flex items-center gap-3 z-10">
          <button onClick={() => undo()} disabled={!canUndo()} className="text-sm disabled:opacity-30 hover:bg-gray-100 rounded px-1.5 py-0.5" title="撤销 (Ctrl+Z)">↩️</button>
          <button onClick={() => redo()} disabled={!canRedo()} className="text-sm disabled:opacity-30 hover:bg-gray-100 rounded px-1.5 py-0.5" title="重做 (Ctrl+Y)">↪️</button>
          <div className="w-px h-5 bg-gray-300" />
          <button onClick={handleSave} disabled={saving} className="text-sm text-blue-600 font-medium hover:bg-blue-50 rounded px-2 py-0.5">
            {saving ? '保存中...' : '💾 保存'}
          </button>
          <div className="w-px h-5 bg-gray-300" />
          <button onClick={() => setShowExportModal(true)} className="text-sm text-green-600 font-medium hover:bg-green-50 rounded px-2 py-0.5">
            📤 导出
          </button>
        </div>

        {/* 选中图层悬浮操作按钮 */}
        {selectedLayer && selectedLayerPos && !editingTextLayerId && (
          <div
            className="absolute z-20 flex gap-1.5"
            style={{
              left: selectedLayerPos.x + selectedLayerPos.width / 2,
              top: selectedLayerPos.y - 40,
              transform: 'translateX(-50%)',
            }}
          >
            {/* 普通图片替换按钮 */}
            {selectedLayer.type === 'image_replace' && (
              <>
                <button
                  onClick={() => handleNormalImageReplace(selectedLayer.id)}
                  className="px-3 py-1.5 bg-white rounded-lg shadow-md text-xs font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors whitespace-nowrap"
                >
                  🖼 换图
                </button>
                {(selectedLayer as ImageReplaceLayer).replace_mode === 'ai_cutout' && (
                  <button
                    onClick={() => handleAICutoutReplace(selectedLayer.id)}
                    className="px-3 py-1.5 bg-white rounded-lg shadow-md text-xs font-medium text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-colors whitespace-nowrap"
                  >
                    ✂️ AI换图
                  </button>
                )}
              </>
            )}
            {/* 文字层双击提示 */}
            {selectedLayer.type === 'text' && !(selectedLayer as TextLayer).locked && (
              <button
                onClick={() => handleTextDblClick(selectedLayer.id)}
                className="px-3 py-1.5 bg-white rounded-lg shadow-md text-xs font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors whitespace-nowrap"
              >
                ✏️ 编辑文字
              </button>
            )}
          </div>
        )}

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
              if (e.target === e.target.getStage()) {
                selectLayer(null);
              }
            }}
            style={{ backgroundColor: 'white', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}
          >
            <Layer>
              {layers.filter((l) => l.visible).map((layer) => (
                <CanvasLayer
                  key={layer.id}
                  layer={layer}
                  isHovered={hoveredLayerId === layer.id}
                  isSelected={selectedLayerId === layer.id}
                  onSelect={() => {
                    if (!layer.locked) selectLayer(layer.id);
                  }}
                  onHover={() => {
                    if (!layer.locked) setHoveredLayerId(layer.id);
                  }}
                  onHoverEnd={() => setHoveredLayerId(null)}
                  onDblClick={() => {
                    if (layer.type === 'text' && !layer.locked) {
                      handleTextDblClick(layer.id);
                    }
                  }}
                />
              ))}
              <Transformer ref={transformerRef} rotateEnabled={true} enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']} />
            </Layer>
          </Stage>
        </div>
      </div>

      {/* 右侧属性面板 */}
      <div className="w-72 bg-white border-l overflow-y-auto p-4">
        <h3 className="font-bold text-sm mb-3">属性</h3>
        {selectedLayerId ? (
          <LayerProperties
            layer={layers.find((l) => l.id === selectedLayerId)!}
            fonts={fonts}
            onUpdate={(updates) => updateLayer(selectedLayerId, updates)}
            onFontChange={(fontFamily) => handleFontChange(selectedLayerId, fontFamily)}
          />
        ) : (
          <p className="text-sm text-gray-500">选择一个图层查看属性</p>
        )}
      </div>

      {/* 浮动文字编辑框 */}
      {editingTextLayerId && (
        <div
          className="fixed z-50"
          style={{
            left: editingTextPos.x,
            top: editingTextPos.y,
            width: editingTextPos.width,
            minHeight: editingTextPos.height,
          }}
        >
          <textarea
            autoFocus
            value={editingTextValue}
            onChange={(e) => setEditingTextValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleTextEditConfirm();
              }
              if (e.key === 'Escape') {
                setEditingTextLayerId(null);
              }
            }}
            onBlur={handleTextEditConfirm}
            className="w-full h-full px-2 py-1 border-2 border-blue-500 rounded resize-none outline-none bg-white shadow-lg"
            style={{
              fontSize: ((layers.find((l) => l.id === editingTextLayerId) as TextLayer)?.font_size || 16) * stageScale,
              fontFamily: (layers.find((l) => l.id === editingTextLayerId) as TextLayer)?.font_family || 'sans-serif',
              color: (layers.find((l) => l.id === editingTextLayerId) as TextLayer)?.color || '#000',
              lineHeight: (layers.find((l) => l.id === editingTextLayerId) as TextLayer)?.line_height || 1.2,
            }}
          />
          <div className="text-xs text-gray-400 mt-1 bg-white px-2 py-1 rounded shadow">
            Enter 确认 · Esc 取消 · Shift+Enter 换行
          </div>
        </div>
      )}

      {/* AI 抠图弹窗 */}
      <AICutoutModal
        visible={showAICutout}
        onClose={() => { setShowAICutout(false); setAicutoutTargetLayerId(null); }}
        onConfirm={handleAICutoutConfirm}
      />

      {/* 导出弹窗 */}
      <ExportModal
        visible={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
      />
    </div>
  );
}

// 画布图层渲染
function CanvasLayer({ layer, isHovered, isSelected, onSelect, onHover, onHoverEnd, onDblClick }: {
  layer: LayerType;
  isHovered: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onHover: () => void;
  onHoverEnd: () => void;
  onDblClick: () => void;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (layer.type === 'background' || layer.type === 'image_replace') {
      const rawSrc = layer.type === 'background'
        ? (layer as BackgroundLayer).image_url
        : (layer as ImageReplaceLayer).user_image_url || (layer as ImageReplaceLayer).placeholder_url;
      if (rawSrc) {
        // Ensure URL has leading / for relative paths
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
    draggable: !layer.locked,
    onClick: onSelect,
    onTap: onSelect,
    onMouseEnter: onHover,
    onMouseLeave: onHoverEnd,
    onDblClick: onDblClick,
    onDblTap: onDblClick,
  };

  // 悬停高亮虚线框
  const hoverHighlight = isHovered && !isSelected && !layer.locked ? (
    <Rect
      x={layer.x}
      y={layer.y}
      width={layer.width as number}
      height={layer.height as number}
      rotation={layer.rotation}
      scaleX={layer.scaleX}
      scaleY={layer.scaleY}
      stroke="#3b82f6"
      strokeWidth={1.5}
      dash={[6, 4]}
      listening={false}
      perfectDrawEnabled={false}
    />
  ) : null;

  if (layer.type === 'background' && image) {
    return (
      <>
        <KonvaImage
          {...commonProps}
          image={image}
          width={layer.width as number}
          height={layer.height as number}
        />
        {hoverHighlight}
      </>
    );
  }

  if (layer.type === 'image_replace') {
    const imgLayer = layer as ImageReplaceLayer;
    if (image) {
      return (
        <>
          <KonvaImage
            {...commonProps}
            image={image}
            width={layer.width as number}
            height={layer.height as number}
          />
          {hoverHighlight}
        </>
      );
    }
    // 占位符
    return (
      <>
        <Rect
          {...commonProps}
          width={layer.width as number}
          height={layer.height as number}
          fill={imgLayer.replace_mode === 'ai_cutout' ? 'rgba(200,200,255,0.3)' : '#f0f0f0'}
          stroke={imgLayer.replace_mode === 'ai_cutout' ? '#6666ff' : '#ccc'}
          strokeWidth={2}
          dash={[5, 5]}
        />
        {hoverHighlight}
      </>
    );
  }

  if (layer.type === 'text') {
    const textLayer = layer as TextLayer;
    return (
      <>
        <KonvaText
          {...commonProps}
          text={textLayer.text}
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
        />
        {hoverHighlight}
      </>
    );
  }

  return null;
}

// 属性面板
function LayerProperties({ layer, fonts, onUpdate, onFontChange }: {
  layer: LayerType;
  fonts: Asset[];
  onUpdate: (updates: Partial<LayerType>) => void;
  onFontChange: (fontFamily: string) => void;
}) {
  if (layer.type === 'text') {
    const textLayer = layer as TextLayer;
    return (
      <div className="space-y-3">
        <PropertyInput label="名称" value={layer.name} onChange={(v) => onUpdate({ name: v })} />
        <PropertyInput label="文字内容" value={textLayer.text} onChange={(v) => onUpdate({ text: v } as any)} />
        {/* 字体选择器 */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">字体</label>
          <select
            value={textLayer.font_family}
            onChange={(e) => onFontChange(e.target.value)}
            className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="sans-serif">默认 (sans-serif)</option>
            <option value="serif">衬线 (serif)</option>
            <option value="monospace">等宽 (monospace)</option>
            {fonts.filter((f) => f.font_family).map((font) => (
              <option key={font.id} value={font.font_family!} style={{ fontFamily: font.font_family! }}>
                {font.font_family}
              </option>
            ))}
          </select>
        </div>
        <PropertyInput label="字号" value={String(textLayer.font_size)} type="number" onChange={(v) => onUpdate({ font_size: Number(v) } as any)} />
        <PropertyInput label="颜色" value={textLayer.color} type="color" onChange={(v) => onUpdate({ color: v } as any)} />
        <PropertyInput label="透明度" value={String(textLayer.opacity)} type="range" onChange={(v) => onUpdate({ opacity: Number(v) } as any)} />
        <div className="flex gap-2">
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" checked={textLayer.font_weight === 'bold'} onChange={(e) => onUpdate({ font_weight: e.target.checked ? 'bold' : 'normal' } as any)} /> 粗体
          </label>
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" checked={textLayer.font_style === 'italic'} onChange={(e) => onUpdate({ font_style: e.target.checked ? 'italic' : 'normal' } as any)} /> 斜体
          </label>
        </div>
        <PropertyInput label="X" value={String(layer.x)} type="number" onChange={(v) => onUpdate({ x: Number(v) })} />
        <PropertyInput label="Y" value={String(layer.y)} type="number" onChange={(v) => onUpdate({ y: Number(v) })} />
        <PropertyInput label="旋转" value={String(layer.rotation)} type="number" onChange={(v) => onUpdate({ rotation: Number(v) })} />
      </div>
    );
  }

  if (layer.type === 'image_replace') {
    const imgLayer = layer as ImageReplaceLayer;
    return (
      <div className="space-y-3">
        <PropertyInput label="名称" value={layer.name} onChange={(v) => onUpdate({ name: v })} />
        <div>
          <label className="block text-xs text-gray-500 mb-1">替换模式</label>
          <span className="text-sm">{imgLayer.replace_mode === 'ai_cutout' ? 'AI 抠图' : '普通替换'}</span>
        </div>
        <PropertyInput label="X" value={String(layer.x)} type="number" onChange={(v) => onUpdate({ x: Number(v) })} />
        <PropertyInput label="Y" value={String(layer.y)} type="number" onChange={(v) => onUpdate({ y: Number(v) })} />
        <PropertyInput label="宽度" value={String(layer.width)} type="number" onChange={(v) => onUpdate({ width: Number(v) })} />
        <PropertyInput label="高度" value={String(layer.height)} type="number" onChange={(v) => onUpdate({ height: Number(v) })} />
        <PropertyInput label="旋转" value={String(layer.rotation)} type="number" onChange={(v) => onUpdate({ rotation: Number(v) })} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <PropertyInput label="名称" value={layer.name} onChange={(v) => onUpdate({ name: v })} />
      <PropertyInput label="X" value={String(layer.x)} type="number" onChange={(v) => onUpdate({ x: Number(v) })} />
      <PropertyInput label="Y" value={String(layer.y)} type="number" onChange={(v) => onUpdate({ y: Number(v) })} />
      <PropertyInput label="宽度" value={String(layer.width)} type="number" onChange={(v) => onUpdate({ width: Number(v) })} />
      <PropertyInput label="高度" value={String(layer.height)} type="number" onChange={(v) => onUpdate({ height: Number(v) })} />
      <PropertyInput label="旋转" value={String(layer.rotation)} type="number" onChange={(v) => onUpdate({ rotation: Number(v) })} />
    </div>
  );
}

function PropertyInput({ label, value, type = 'text', onChange }: {
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
