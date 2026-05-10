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

type MobilePanel = 'none' | 'layers' | 'properties';

export default function DesignEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });

  // 移动端状态
  const [isMobile, setIsMobile] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>('none');

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

  // 检测移动端
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
      if (editingTextLayerId) return;
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

  // 保存
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
    transformerRef.current?.nodes([]);
    const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const uri = stageRef.current.toDataURL({ mimeType, pixelRatio: 2, quality });
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

  // 文字层编辑
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

  const handleTextEditConfirm = () => {
    if (editingTextLayerId) {
      updateLayer(editingTextLayerId, { text: editingTextValue } as any);
    }
    setEditingTextLayerId(null);
  };

  // 图片替换
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

  const handleAICutoutReplace = (layerId: string) => {
    setAicutoutTargetLayerId(layerId);
    setShowAICutout(true);
  };

  const handleAICutoutConfirm = (imageUrl: string) => {
    if (aicutoutTargetLayerId) {
      updateLayer(aicutoutTargetLayerId, { user_image_url: imageUrl } as any);
    }
    setAicutoutTargetLayerId(null);
  };

  const handleFontChange = (layerId: string, fontFamily: string) => {
    const font = fonts.find((f) => f.font_family === fontFamily);
    if (font && font.file_path) {
      loadFont(fontFamily, font.file_path.startsWith("/") ? font.file_path : `/${font.file_path}`);
    }
    updateLayer(layerId, { font_family: fontFamily } as any);
  };

  // 获取选中图层位置
  const getSelectedLayerCanvasPos = () => {
    if (!selectedLayerId || !stageRef.current) return null;
    const node = stageRef.current.findOne(`#${selectedLayerId}`);
    if (!node) return null;
    const rect = node.getClientRect();
    return {
      containerX: rect.x * stageScale + stagePos.x,
      containerY: rect.y * stageScale + stagePos.y,
      width: rect.width * stageScale,
      height: rect.height * stageScale,
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  const selectedLayer = layers.find((l) => l.id === selectedLayerId);
  const selectedLayerPos = getSelectedLayerCanvasPos();

  // 移动端布局
  if (isMobile) {
    return (
      <div className="flex flex-col h-[calc(100vh-3.5rem)] -mt-6 -mx-4 bg-gray-100">
        {/* 顶部工具栏 */}
        <div className="flex items-center justify-between px-3 py-2 bg-white border-b">
          <button onClick={() => navigate('/my-designs')} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="font-medium text-gray-900 text-sm truncate max-w-[120px]">编辑设计</span>
          <div className="flex items-center gap-1">
            <button onClick={() => undo()} disabled={!canUndo()} className="p-2 text-gray-600 disabled:opacity-30 hover:bg-gray-100 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </button>
            <button onClick={() => redo()} disabled={!canRedo()} className="p-2 text-gray-600 disabled:opacity-30 hover:bg-gray-100 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
              </svg>
            </button>
          </div>
        </div>

        {/* 画布区域 */}
        <div className="flex-1 relative overflow-hidden">
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
                  setMobilePanel('none');
                }
              }}
              style={{ backgroundColor: 'white' }}
            >
              <Layer>
                {layers.filter((l) => l.visible).map((layer) => (
                  <CanvasLayer
                    key={layer.id}
                    layer={layer}
                    isHovered={hoveredLayerId === layer.id}
                    isSelected={selectedLayerId === layer.id}
                    onSelect={() => {
                      if (!layer.locked) {
                        selectLayer(layer.id);
                        setMobilePanel('properties');
                      }
                    }}
                    onHover={() => {}}
                    onHoverEnd={() => {}}
                    onDblClick={() => {
                      if (layer.type === 'text' && !layer.locked) {
                        handleTextDblClick(layer.id);
                      }
                    }}
                    onUpdate={updateLayer}
                  />
                ))}
                <Transformer ref={transformerRef} rotateEnabled={true} enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']} />
              </Layer>
            </Stage>
          </div>

          {/* 选中图层操作按钮 */}
          {selectedLayer && selectedLayerPos && !editingTextLayerId && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
              {selectedLayer.type === 'image_replace' && (
                <>
                  <button
                    onClick={() => handleNormalImageReplace(selectedLayer.id)}
                    className="px-4 py-2 bg-white rounded-full shadow-lg text-sm font-medium text-gray-700 hover:bg-blue-50"
                  >
                    🖼 换图
                  </button>
                  {(selectedLayer as ImageReplaceLayer).replace_mode === 'ai_cutout' && (
                    <button
                      onClick={() => handleAICutoutReplace(selectedLayer.id)}
                      className="px-4 py-2 bg-white rounded-full shadow-lg text-sm font-medium text-gray-700 hover:bg-purple-50"
                    >
                      ✂️ AI换图
                    </button>
                  )}
                </>
              )}
              {selectedLayer.type === 'text' && !(selectedLayer as TextLayer).locked && (
                <button
                  onClick={() => handleTextDblClick(selectedLayer.id)}
                  className="px-4 py-2 bg-white rounded-full shadow-lg text-sm font-medium text-gray-700 hover:bg-blue-50"
                >
                  ✏️ 编辑文字
                </button>
              )}
            </div>
          )}
        </div>

        {/* 底部操作栏 */}
        <div className="flex items-center gap-2 px-3 py-2 bg-white border-t">
          <button
            onClick={() => setMobilePanel(mobilePanel === 'layers' ? 'none' : 'layers')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-sm transition-colors ${
              mobilePanel === 'layers' ? 'bg-primary-50 text-primary-600' : 'bg-gray-100 text-gray-700'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            图层
          </button>
          <button
            onClick={() => setMobilePanel(mobilePanel === 'properties' ? 'none' : 'properties')}
            disabled={!selectedLayerId}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-sm transition-colors disabled:opacity-50 ${
              mobilePanel === 'properties' ? 'bg-primary-50 text-primary-600' : 'bg-gray-100 text-gray-700'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            属性
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-sm bg-gradient-to-r from-primary-500 to-primary-600 text-white disabled:opacity-50"
          >
            {saving ? '保存中...' : '💾 保存'}
          </button>
          <button
            onClick={() => setShowExportModal(true)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-sm bg-gradient-to-r from-green-500 to-green-600 text-white"
          >
            📤 导出
          </button>
        </div>

        {/* 移动端抽屉面板 */}
        {mobilePanel !== 'none' && (
          <div className="fixed inset-0 z-40" onClick={() => setMobilePanel('none')}>
            <div className="absolute inset-0 bg-black/30" />
            <div 
              className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[60vh] overflow-hidden animate-slide-up"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 拖拽条 */}
              <div className="flex justify-center py-2">
                <div className="w-10 h-1 bg-gray-300 rounded-full" />
              </div>
              
              <div className="px-4 pb-4 overflow-y-auto max-h-[calc(60vh-40px)]">
                {mobilePanel === 'layers' && (
                  <MobileLayersPanel
                    layers={layers}
                    selectedLayerId={selectedLayerId}
                    onSelectLayer={(layerId) => {
                      selectLayer(layerId);
                      setMobilePanel('properties');
                    }}
                  />
                )}
                {mobilePanel === 'properties' && selectedLayerId && (
                  <MobilePropertiesPanel
                    layer={layers.find((l) => l.id === selectedLayerId)!}
                    fonts={fonts}
                    onUpdate={(updates) => updateLayer(selectedLayerId, updates)}
                    onFontChange={(fontFamily) => handleFontChange(selectedLayerId, fontFamily)}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* 浮动文字编辑框 */}
        {editingTextLayerId && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-4">
              <h3 className="font-bold text-gray-900 mb-3">编辑文字</h3>
              <textarea
                autoFocus
                value={editingTextValue}
                onChange={(e) => setEditingTextValue(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                rows={4}
                style={{
                  fontSize: ((layers.find((l) => l.id === editingTextLayerId) as TextLayer)?.font_size || 16),
                  fontFamily: (layers.find((l) => l.id === editingTextLayerId) as TextLayer)?.font_family || 'sans-serif',
                  color: (layers.find((l) => l.id === editingTextLayerId) as TextLayer)?.color || '#000',
                }}
              />
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setEditingTextLayerId(null)}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl font-medium"
                >
                  取消
                </button>
                <button
                  onClick={handleTextEditConfirm}
                  className="flex-1 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl font-medium"
                >
                  确认
                </button>
              </div>
            </div>
          </div>
        )}

        <AICutoutModal
          visible={showAICutout}
          onClose={() => { setShowAICutout(false); setAicutoutTargetLayerId(null); }}
          onConfirm={handleAICutoutConfirm}
        />
        <ExportModal
          visible={showExportModal}
          onClose={() => setShowExportModal(false)}
          onExport={handleExport}
        />
      </div>
    );
  }

  // 桌面端布局
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
                selectedLayerId === layer.id ? 'bg-primary-50 text-primary-600' : 'hover:bg-gray-50'
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
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-lg px-4 py-2 flex items-center gap-3 z-10">
          <button onClick={() => undo()} disabled={!canUndo()} className="text-sm disabled:opacity-30 hover:bg-gray-100 rounded-lg p-1.5" title="撤销">↩️</button>
          <button onClick={() => redo()} disabled={!canRedo()} className="text-sm disabled:opacity-30 hover:bg-gray-100 rounded-lg p-1.5" title="重做">↪️</button>
          <div className="w-px h-5 bg-gray-200" />
          <button onClick={handleSave} disabled={saving} className="text-sm text-primary-600 font-medium hover:bg-primary-50 rounded-lg px-2 py-1">
            {saving ? '保存中...' : '💾 保存'}
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <button onClick={() => setShowExportModal(true)} className="text-sm text-green-600 font-medium hover:bg-green-50 rounded-lg px-2 py-1">
            📤 导出
          </button>
        </div>

        {selectedLayer && selectedLayerPos && !editingTextLayerId && (
          <div
            className="absolute z-20 flex gap-1.5"
            style={{
              left: selectedLayerPos.containerX + selectedLayerPos.width / 2,
              top: selectedLayerPos.containerY + selectedLayerPos.height + 5,
              transform: 'translateX(-50%)',
            }}
          >
            {selectedLayer.type === 'image_replace' && (
              <>
                <button onClick={() => handleNormalImageReplace(selectedLayer.id)} className="px-3 py-1.5 bg-white rounded-lg shadow-md text-xs font-medium text-gray-700 hover:bg-blue-50">
                  🖼 换图
                </button>
                {(selectedLayer as ImageReplaceLayer).replace_mode === 'ai_cutout' && (
                  <button onClick={() => handleAICutoutReplace(selectedLayer.id)} className="px-3 py-1.5 bg-white rounded-lg shadow-md text-xs font-medium text-gray-700 hover:bg-purple-50">
                    ✂️ AI换图
                  </button>
                )}
              </>
            )}
            {selectedLayer.type === 'text' && !(selectedLayer as TextLayer).locked && (
              <button onClick={() => handleTextDblClick(selectedLayer.id)} className="px-3 py-1.5 bg-white rounded-lg shadow-md text-xs font-medium text-gray-700 hover:bg-blue-50">
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
                  onUpdate={updateLayer}
                />
              ))}
              <Transformer ref={transformerRef} rotateEnabled={true} enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']} />
            </Layer>
          </Stage>
        </div>

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
                if (e.key === 'Escape') setEditingTextLayerId(null);
              }}
              onBlur={handleTextEditConfirm}
              className="w-full h-full px-2 py-1 border-2 border-primary-500 rounded resize-none outline-none bg-white shadow-lg"
              style={{
                fontSize: ((layers.find((l) => l.id === editingTextLayerId) as TextLayer)?.font_size || 16) * stageScale,
                fontFamily: (layers.find((l) => l.id === editingTextLayerId) as TextLayer)?.font_family || 'sans-serif',
                color: (layers.find((l) => l.id === editingTextLayerId) as TextLayer)?.color || '#000',
                lineHeight: (layers.find((l) => l.id === editingTextLayerId) as TextLayer)?.line_height || 1.2,
              }}
            />
          </div>
        )}
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

      <AICutoutModal
        visible={showAICutout}
        onClose={() => { setShowAICutout(false); setAicutoutTargetLayerId(null); }}
        onConfirm={handleAICutoutConfirm}
      />
      <ExportModal
        visible={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
      />
    </div>
  );
}

// 移动端图层面板
function MobileLayersPanel({ layers, selectedLayerId, onSelectLayer }: {
  layers: LayerType[];
  selectedLayerId: string | null;
  onSelectLayer: (layerId: string) => void;
}) {
  return (
    <div>
      <h3 className="font-bold text-gray-900 mb-3">图层列表</h3>
      <div className="space-y-2">
        {[...layers].reverse().map((layer) => (
          <div
            key={layer.id}
            onClick={() => onSelectLayer(layer.id)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer ${
              selectedLayerId === layer.id ? 'bg-primary-50 border border-primary-200' : 'bg-gray-50'
            }`}
          >
            <span className="flex-1 font-medium text-gray-900">{layer.name}</span>
            {layer.locked && <span className="text-gray-400">🔒</span>}
            {!layer.visible && <span className="text-gray-400">👁</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// 移动端属性面板
function MobilePropertiesPanel({ layer, fonts, onUpdate, onFontChange }: {
  layer: LayerType;
  fonts: Asset[];
  onUpdate: (updates: Partial<LayerType>) => void;
  onFontChange: (fontFamily: string) => void;
}) {
  if (layer.type === 'text') {
    const textLayer = layer as TextLayer;
    return (
      <div className="space-y-4">
        <h3 className="font-bold text-gray-900">文字属性</h3>
        <MobilePropInput label="名称" value={layer.name} onChange={(v) => onUpdate({ name: v })} />
        <MobilePropInput label="文字内容" value={textLayer.text} onChange={(v) => onUpdate({ text: v } as any)} />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">字体</label>
          <select
            value={textLayer.font_family}
            onChange={(e) => onFontChange(e.target.value)}
            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500"
          >
            <option value="sans-serif">默认</option>
            <option value="serif">衬线</option>
            <option value="monospace">等宽</option>
            {fonts.filter((f) => f.font_family).map((font) => (
              <option key={font.id} value={font.font_family!}>{font.font_family}</option>
            ))}
          </select>
        </div>
        <MobilePropInput label="字号" value={String(textLayer.font_size)} type="number" onChange={(v) => onUpdate({ font_size: Number(v) } as any)} />
        <MobilePropInput label="颜色" value={textLayer.color} type="color" onChange={(v) => onUpdate({ color: v } as any)} />
        <div className="flex gap-3">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={textLayer.font_weight === 'bold'} onChange={(e) => onUpdate({ font_weight: e.target.checked ? 'bold' : 'normal' } as any)} className="w-4 h-4" />
            <span className="text-sm">粗体</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={textLayer.font_style === 'italic'} onChange={(e) => onUpdate({ font_style: e.target.checked ? 'italic' : 'normal' } as any)} className="w-4 h-4" />
            <span className="text-sm">斜体</span>
          </label>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-bold text-gray-900">图层属性</h3>
      <MobilePropInput label="名称" value={layer.name} onChange={(v) => onUpdate({ name: v })} />
      <MobilePropInput label="X" value={String(layer.x)} type="number" onChange={(v) => onUpdate({ x: Number(v) })} />
      <MobilePropInput label="Y" value={String(layer.y)} type="number" onChange={(v) => onUpdate({ y: Number(v) })} />
      <MobilePropInput label="宽度" value={String(layer.width)} type="number" onChange={(v) => onUpdate({ width: Number(v) })} />
      <MobilePropInput label="高度" value={String(layer.height)} type="number" onChange={(v) => onUpdate({ height: Number(v) })} />
      <MobilePropInput label="旋转" value={String(layer.rotation)} type="number" onChange={(v) => onUpdate({ rotation: Number(v) })} />
    </div>
  );
}

function MobilePropInput({ label, value, type = 'text', onChange }: {
  label: string;
  value: string;
  type?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
      />
    </div>
  );
}

// 画布图层渲染
function CanvasLayer({ layer, isHovered, isSelected, onSelect, onHover, onHoverEnd, onDblClick, onUpdate }: {
  layer: LayerType;
  isHovered: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onHover: () => void;
  onHoverEnd: () => void;
  onDblClick: () => void;
  onUpdate: (id: string, updates: Partial<LayerType>) => void;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (layer.type === 'background' || layer.type === 'image_replace') {
      const rawSrc = layer.type === 'background'
        ? (layer as BackgroundLayer).image_url
        : (layer as ImageReplaceLayer).user_image_url || (layer as ImageReplaceLayer).placeholder_url;
      if (rawSrc) {
        const src = rawSrc.startsWith('/') || rawSrc.startsWith('data:') || rawSrc.startsWith('http') ? rawSrc : `/${rawSrc}`;
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => setImage(img);
        img.src = src;
      }
    }
  }, [layer]);

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    onUpdate(layer.id, { x: e.target.x(), y: e.target.y() });
  };

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
    onDragEnd: handleDragEnd,
  };

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
        <KonvaImage {...commonProps} image={image} width={layer.width as number} height={layer.height as number} />
        {hoverHighlight}
      </>
    );
  }

  if (layer.type === 'image_replace') {
    const imgLayer = layer as ImageReplaceLayer;
    if (image) {
      return (
        <>
          <KonvaImage {...commonProps} image={image} width={layer.width as number} height={layer.height as number} />
          {hoverHighlight}
        </>
      );
    }
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

// 桌面端属性面板
function LayerProperties({ layer, fonts, onUpdate, onFontChange }: {
  layer: LayerType;
  fonts: Asset[];
  onUpdate: (updates: Partial<LayerType>) => void;
  onFontChange: (fontFamily: string) => void;
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
        <div>
          <label className="block text-xs text-gray-500 mb-1">字体</label>
          <select value={textLayer.font_family} onChange={(e) => onFontChange(e.target.value)} className="w-full px-2 py-1.5 border rounded text-sm focus:ring-1 focus:ring-primary-500">
            <option value="sans-serif">默认</option>
            <option value="serif">衬线</option>
            <option value="monospace">等宽</option>
            {fonts.filter((f) => f.font_family).map((font) => (
              <option key={font.id} value={font.font_family!}>{font.font_family}</option>
            ))}
          </select>
        </div>
        <PropInput label="字号" value={String(textLayer.font_size)} type="number" onChange={(v) => onUpdate({ font_size: Number(v) } as any)} />
        <PropInput label="颜色" value={textLayer.color} type="color" onChange={(v) => onUpdate({ color: v } as any)} />
        <PropInput label="行高" value={String(textLayer.line_height)} type="number" onChange={(v) => onUpdate({ line_height: Number(v) } as any)} />
        <PropInput label="字间距" value={String(textLayer.letter_spacing)} type="number" onChange={(v) => onUpdate({ letter_spacing: Number(v) } as any)} />
        <div>
          <label className="block text-xs text-gray-500 mb-1">对齐</label>
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
          <span className="text-sm">{imgLayer.replace_mode === 'ai_cutout' ? 'AI 抠图' : '普通替换'}</span>
        </div>
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
        className="w-full px-2 py-1.5 border rounded text-sm focus:ring-1 focus:ring-primary-500"
        min={type === 'range' ? '0' : undefined}
        max={type === 'range' ? '1' : undefined}
        step={type === 'range' ? '0.1' : undefined}
      />
    </div>
  );
}
