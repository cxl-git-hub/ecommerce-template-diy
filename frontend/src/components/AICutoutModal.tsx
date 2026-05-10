import { useState, useRef, useEffect } from 'react';
import { aiApi } from '@/api';

interface AICutoutModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (imageUrl: string) => void;
}

type Step = 'upload' | 'select-mode' | 'point-edit' | 'detecting' | 'select-object' | 'processing' | 'preview';
type CutoutMode = 'auto' | 'point' | 'text';

interface Point {
  x: number;  // 归一化坐标 [0, 1]
  y: number;
  label: number;  // 1=前景, 0=背景
}

export default function AICutoutModal({ visible, onClose, onConfirm }: AICutoutModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [mode, setMode] = useState<CutoutMode>('auto');
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [originalSize, setOriginalSize] = useState({ width: 0, height: 0 });
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [textPrompt, setTextPrompt] = useState('');
  const [detectedObjects, setDetectedObjects] = useState<any[]>([]);
  const [selectedObject, setSelectedObject] = useState<any>(null);
  
  // 点选编辑状态
  const [points, setPoints] = useState<Point[]>([]);
  const [isAddingForeground, setIsAddingForeground] = useState(true);
  const imageRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 预设的文本提示
  const presetPrompts = [
    { label: '👤 人物', value: 'person' },
    { label: '🐱 猫', value: 'cat' },
    { label: '🐶 狗', value: 'dog' },
    { label: '😊 人脸', value: 'face' },
    { label: '✋ 手', value: 'hand' },
    { label: '🚗 汽车', value: 'car' },
    { label: '🌸 花朵', value: 'flower' },
    { label: '🏠 建筑', value: 'building' },
  ];

  if (!visible) return null;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setOriginalFile(file);
    
    // 获取图片尺寸
    const img = new Image();
    img.onload = () => {
      setOriginalSize({ width: img.width, height: img.height });
      setOriginalUrl(URL.createObjectURL(file));
      setStep('select-mode');
    };
    img.src = URL.createObjectURL(file);
  };

  const handleAutoMode = async () => {
    if (!originalFile) return;
    
    setMode('auto');
    setStep('processing');
    
    try {
      const res = await aiApi.removeBg(originalFile);
      setResultUrl(res.data.file_path);
      setStep('preview');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'AI 抠图处理失败，请重试');
      setStep('select-mode');
    }
  };

  const handlePointMode = () => {
    setMode('point');
    setPoints([]);
    setStep('point-edit');
  };

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (step !== 'point-edit' || !imageRef.current) return;
    
    const rect = imageRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    
    // 添加点
    setPoints([...points, { x, y, label: isAddingForeground ? 1 : 0 }]);
  };

  const handleRemoveLastPoint = () => {
    setPoints(points.slice(0, -1));
  };

  const handleClearPoints = () => {
    setPoints([]);
  };

  const handlePointSegment = async () => {
    if (!originalFile || points.length === 0) return;
    
    setStep('processing');
    
    try {
      const res = await aiApi.segmentByPoints(
        originalFile,
        points,
        originalSize.width,
        originalSize.height
      );
      setResultUrl(res.data.file_path);
      setStep('preview');
    } catch (err: any) {
      setError(err.response?.data?.detail || '分割处理失败，请重试');
      setStep('point-edit');
    }
  };

  const handleTextMode = async () => {
    if (!originalFile) return;
    
    setMode('text');
    setStep('detecting');
    
    try {
      const res = await aiApi.detectObjects(originalFile, textPrompt || undefined);
      setDetectedObjects(res.data.objects || []);
      
      if (res.data.objects.length === 0) {
        setError('未找到匹配的对象，请尝试其他描述');
        setStep('select-mode');
        return;
      }
      
      setStep('select-object');
    } catch (err: any) {
      setError(err.response?.data?.detail || '对象检测失败，请重试');
      setStep('select-mode');
    }
  };

  const handleObjectSelect = async (obj: any) => {
    if (!originalFile) return;
    
    setSelectedObject(obj);
    setStep('processing');
    
    try {
      const res = await aiApi.detectAndSegment(originalFile, obj.label);
      setResultUrl(res.data.file_path);
      setStep('preview');
    } catch (err: any) {
      setError(err.response?.data?.detail || '对象分割失败，请重试');
      setStep('select-object');
    }
  };

  const handleConfirm = () => {
    if (resultUrl) {
      onConfirm(resultUrl);
      handleClose();
    }
  };

  const handleClose = () => {
    setStep('upload');
    setMode('auto');
    setOriginalUrl(null);
    setOriginalFile(null);
    setOriginalSize({ width: 0, height: 0 });
    setResultUrl(null);
    setError(null);
    setTextPrompt('');
    setDetectedObjects([]);
    setSelectedObject(null);
    setPoints([]);
    onClose();
  };

  const handleRetry = () => {
    setStep('upload');
    setOriginalUrl(null);
    setOriginalFile(null);
    setOriginalSize({ width: 0, height: 0 });
    setResultUrl(null);
    setError(null);
    setTextPrompt('');
    setDetectedObjects([]);
    setSelectedObject(null);
    setPoints([]);
  };

  // 渲染点选预览
  const renderPointPreview = () => {
    return (
      <div className="relative inline-block">
        <img
          ref={imageRef}
          src={originalUrl!}
          alt="编辑图片"
          className="max-w-full max-h-[50vh] rounded-xl cursor-crosshair"
          onClick={handleImageClick}
        />
        {/* 渲染已添加的点 */}
        {points.map((point, idx) => (
          <div
            key={idx}
            className="absolute w-4 h-4 rounded-full border-2 border-white shadow-lg transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{
              left: `${point.x * 100}%`,
              top: `${point.y * 100}%`,
              backgroundColor: point.label === 1 ? '#22c55e' : '#ef4444',
            }}
          >
            <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs font-medium text-white bg-black/70 px-1.5 py-0.5 rounded whitespace-nowrap">
              {point.label === 1 ? '保留' : '去除'}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">AI 智能抠图</h2>
              <p className="text-sm text-gray-500">SAM 2 精准分割</p>
            </div>
          </div>
          <button 
            onClick={handleClose} 
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {/* Step: Upload */}
          {step === 'upload' && (
            <div className="text-center py-8">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
                <svg className="w-10 h-10 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">选择图片</h3>
              <p className="text-gray-500 mb-2">上传人物、动物或物体照片</p>
              <p className="text-sm text-gray-400 mb-6">支持精确点选、框选和智能识别</p>
              
              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm flex items-center gap-2">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              )}
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all shadow-sm"
              >
                选择图片
              </button>
              <p className="text-xs text-gray-400 mt-3">支持 JPG、PNG、WebP 格式</p>
            </div>
          )}

          {/* Step: Select Mode */}
          {step === 'select-mode' && (
            <div className="space-y-4">
              {originalUrl && (
                <div className="flex justify-center mb-4">
                  <img src={originalUrl} alt="原图" className="max-h-40 rounded-xl border border-gray-100" />
                </div>
              )}
              
              {error && (
                <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm mb-4">
                  {error}
                </div>
              )}
              
              <h3 className="text-lg font-semibold text-gray-900 text-center mb-4">选择抠图方式</h3>
              
              {/* 快速自动抠图 */}
              <button
                onClick={handleAutoMode}
                className="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all text-left"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">快速自动抠图</div>
                    <div className="text-sm text-gray-500">AI 自动识别主体并去除背景</div>
                  </div>
                </div>
              </button>
              
              {/* 精确点选抠图 - 推荐 */}
              <button
                onClick={handlePointMode}
                className="w-full p-4 border-2 border-purple-300 bg-purple-50 rounded-xl hover:border-purple-400 transition-all text-left"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-100 to-pink-200 flex items-center justify-center">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 flex items-center gap-2">
                      精确点选抠图
                      <span className="text-xs bg-purple-500 text-white px-2 py-0.5 rounded-full">推荐</span>
                    </div>
                    <div className="text-sm text-gray-500">点击要保留的区域，精度最高</div>
                  </div>
                </div>
              </button>
              
              {/* 智能识别抠图 */}
              <div className="border-2 border-gray-200 rounded-xl p-4">
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-100 to-emerald-200 flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">智能识别抠图</div>
                    <div className="text-sm text-gray-500">输入文字描述，AI自动识别</div>
                  </div>
                </div>
                
                <input
                  type="text"
                  value={textPrompt}
                  onChange={(e) => setTextPrompt(e.target.value)}
                  placeholder="例如：person, cat, face, hand..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white transition-all mb-3"
                />
                
                <div className="flex flex-wrap gap-2 mb-3">
                  {presetPrompts.map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => setTextPrompt(preset.value)}
                      className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:border-green-300 hover:bg-green-50 transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                
                <button
                  onClick={handleTextMode}
                  disabled={!textPrompt.trim()}
                  className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-medium rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  开始智能识别
                </button>
              </div>
              
              <button
                onClick={handleRetry}
                className="w-full py-2.5 text-gray-600 hover:text-gray-900 transition-colors"
              >
                重新选择图片
              </button>
            </div>
          )}

          {/* Step: Point Edit */}
          {step === 'point-edit' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">精确点选</h3>
              
              {/* 操作说明 */}
              <div className="bg-purple-50 rounded-xl p-4 text-sm">
                <div className="flex items-center gap-4 mb-3">
                  <button
                    onClick={() => setIsAddingForeground(true)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      isAddingForeground ? 'bg-green-500 text-white' : 'bg-white text-gray-700 border border-gray-200'
                    }`}
                  >
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    添加保留区域
                  </button>
                  <button
                    onClick={() => setIsAddingForeground(false)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      !isAddingForeground ? 'bg-red-500 text-white' : 'bg-white text-gray-700 border border-gray-200'
                    }`}
                  >
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    添加去除区域
                  </button>
                </div>
                <p className="text-gray-600">点击图片添加标记点，<span className="text-green-600 font-medium">绿色</span>表示保留，<span className="text-red-600 font-medium">红色</span>表示去除</p>
              </div>
              
              {/* 图片预览 */}
              <div className="flex justify-center">
                {renderPointPreview()}
              </div>
              
              {/* 已添加的点列表 */}
              {points.length > 0 && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">已添加 {points.length} 个标记点</span>
                    <div className="flex gap-2">
                      <button
                        onClick={handleRemoveLastPoint}
                        className="text-sm text-gray-500 hover:text-gray-700"
                      >
                        撤销上一个
                      </button>
                      <button
                        onClick={handleClearPoints}
                        className="text-sm text-red-500 hover:text-red-700"
                      >
                        清空
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex gap-3">
                <button
                  onClick={() => setStep('select-mode')}
                  className="flex-1 py-3 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
                >
                  返回
                </button>
                <button
                  onClick={handlePointSegment}
                  disabled={points.length === 0}
                  className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  开始分割
                </button>
              </div>
            </div>
          )}

          {/* Step: Detecting */}
          {step === 'detecting' && (
            <div className="text-center py-12">
              {originalUrl && (
                <div className="mb-6 flex justify-center">
                  <img src={originalUrl} alt="原图" className="max-h-40 rounded-xl border border-gray-100" />
                </div>
              )}
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="w-8 h-8 border-3 border-green-200 border-t-green-500 rounded-full animate-spin" />
                <span className="text-green-600 font-medium">AI 检测中...</span>
              </div>
              <p className="text-gray-500">正在识别图片中的对象</p>
            </div>
          )}

          {/* Step: Select Object */}
          {step === 'select-object' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">选择要抠出的对象</h3>
              <p className="text-sm text-gray-500 text-center mb-4">点击选择一个对象进行抠图</p>
              
              {originalUrl && (
                <div className="flex justify-center mb-4">
                  <div className="relative inline-block">
                    <img src={originalUrl} alt="原图" className="max-h-60 rounded-xl border border-gray-100" />
                    {detectedObjects.map((obj, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleObjectSelect(obj)}
                        className="absolute cursor-pointer border-2 border-green-400 bg-green-500/10 hover:bg-green-500/20 transition-colors rounded-lg flex items-center justify-center"
                        style={{
                          left: `${obj.bbox.x1 * 100}%`,
                          top: `${obj.bbox.y1 * 100}%`,
                          width: `${(obj.bbox.x2 - obj.bbox.x1) * 100}%`,
                          height: `${(obj.bbox.y2 - obj.bbox.y1) * 100}%`,
                        }}
                        title={`${obj.label} (${Math.round(obj.confidence * 100)}%)`}
                      >
                        <span className="text-xs bg-green-500 text-white px-1.5 py-0.5 rounded">
                          {obj.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                {detectedObjects.map((obj, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleObjectSelect(obj)}
                    className="w-full p-3 border border-gray-200 rounded-xl hover:border-green-300 hover:bg-green-50 transition-all text-left flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center text-sm font-medium text-green-600">
                        {idx + 1}
                      </div>
                      <span className="font-medium text-gray-900">{obj.label}</span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {Math.round(obj.confidence * 100)}% 置信度
                    </span>
                  </button>
                ))}
              </div>
              
              <button
                onClick={() => setStep('select-mode')}
                className="w-full py-2.5 text-gray-600 hover:text-gray-900 transition-colors"
              >
                返回重新选择
              </button>
            </div>
          )}

          {/* Step: Processing */}
          {step === 'processing' && (
            <div className="text-center py-12">
              {originalUrl && (
                <div className="mb-6 flex justify-center">
                  <img src={originalUrl} alt="原图" className="max-h-40 rounded-xl border border-gray-100" />
                </div>
              )}
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="w-8 h-8 border-3 border-purple-200 border-t-purple-500 rounded-full animate-spin" />
                <span className="text-purple-600 font-medium">SAM 2 处理中...</span>
              </div>
              <p className="text-gray-500">
                {mode === 'point' 
                  ? `正在根据 ${points.length} 个标记点进行精确分割...`
                  : selectedObject 
                    ? `正在抠出 "${selectedObject.label}"...`
                    : '正在智能识别主体并去除背景...'
                }
              </p>
            </div>
          )}

          {/* Step: Preview */}
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1 text-center">
                  <p className="text-sm font-medium text-gray-700 mb-2">原图</p>
                  <div className="aspect-square bg-gray-100 rounded-xl flex items-center justify-center overflow-hidden">
                    {originalUrl && <img src={originalUrl} alt="原图" className="max-w-full max-h-full object-contain" />}
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
                <div className="flex-1 text-center">
                  <p className="text-sm font-medium text-gray-700 mb-2">抠图结果</p>
                  <div className="aspect-square bg-[repeating-conic-gradient(#e5e5e5_0%_25%,#fff_0%_50%)] bg-[length:16px_16px] rounded-xl flex items-center justify-center overflow-hidden">
                    {resultUrl && <img src={resultUrl} alt="抠图结果" className="max-w-full max-h-full object-contain" />}
                  </div>
                </div>
              </div>
              
              {error && (
                <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm">
                  {error}
                </div>
              )}
              
              <div className="flex gap-3 pt-4">
                <button 
                  onClick={handleRetry} 
                  className="flex-1 py-3 px-4 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
                >
                  重新上传
                </button>
                <button 
                  onClick={handleConfirm} 
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all shadow-sm"
                >
                  确认使用
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
