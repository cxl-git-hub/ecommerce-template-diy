import { useState, useRef } from 'react';
import { aiApi } from '@/api';

interface AICutoutModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (imageUrl: string) => void;
}

type Step = 'upload' | 'select-mode' | 'detecting' | 'select-object' | 'processing' | 'preview';
type CutoutMode = 'auto' | 'text';

export default function AICutoutModal({ visible, onClose, onConfirm }: AICutoutModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [mode, setMode] = useState<CutoutMode>('auto');
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [textPrompt, setTextPrompt] = useState('');
  const [detectedObjects, setDetectedObjects] = useState<any[]>([]);
  const [selectedObject, setSelectedObject] = useState<any>(null);
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
    setOriginalUrl(URL.createObjectURL(file));
    setStep('select-mode');
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

  const handleTextMode = async () => {
    if (!originalFile) return;
    
    setMode('text');
    setStep('detecting');
    
    try {
      // 先检测图片中的对象
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
      // 使用选中的对象标签进行精确分割
      const res = await aiApi.segmentByText(originalFile, obj.label);
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
    setResultUrl(null);
    setError(null);
    setTextPrompt('');
    setDetectedObjects([]);
    setSelectedObject(null);
    onClose();
  };

  const handleRetry = () => {
    setStep('upload');
    setOriginalUrl(null);
    setOriginalFile(null);
    setResultUrl(null);
    setError(null);
    setTextPrompt('');
    setDetectedObjects([]);
    setSelectedObject(null);
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
              <p className="text-sm text-gray-500">支持自动抠图或指定对象抠图</p>
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
              <p className="text-sm text-gray-400 mb-6">AI 将智能识别并抠出指定对象</p>
              
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
                  <img src={originalUrl} alt="原图" className="max-h-48 rounded-xl border border-gray-100" />
                </div>
              )}
              
              <h3 className="text-lg font-semibold text-gray-900 text-center mb-4">选择抠图方式</h3>
              
              {/* Auto Mode */}
              <button
                onClick={handleAutoMode}
                className="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-purple-300 hover:bg-purple-50 transition-all text-left"
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
              
              {/* Text Mode */}
              <div className="border-2 border-purple-200 bg-purple-50 rounded-xl p-4">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-100 to-pink-200 flex items-center justify-center">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">指定对象抠图</div>
                    <div className="text-sm text-gray-500">描述要抠出的对象或部位</div>
                  </div>
                </div>
                
                <input
                  type="text"
                  value={textPrompt}
                  onChange={(e) => setTextPrompt(e.target.value)}
                  placeholder="例如：person, cat, face, hand..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white transition-all mb-3"
                />
                
                {/* Preset prompts */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {presetPrompts.map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => setTextPrompt(preset.value)}
                      className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                
                <button
                  onClick={handleTextMode}
                  disabled={!textPrompt.trim()}
                  className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  开始检测
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

          {/* Step: Detecting */}
          {step === 'detecting' && (
            <div className="text-center py-12">
              {originalUrl && (
                <div className="mb-6 flex justify-center">
                  <img src={originalUrl} alt="原图" className="max-h-40 rounded-xl border border-gray-100" />
                </div>
              )}
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="w-8 h-8 border-3 border-purple-200 border-t-purple-500 rounded-full animate-spin" />
                <span className="text-purple-600 font-medium">AI 检测中...</span>
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
                    {/* 显示检测到的对象边界框 */}
                    {detectedObjects.map((obj, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleObjectSelect(obj)}
                        className="absolute cursor-pointer border-2 border-purple-400 bg-purple-500/10 hover:bg-purple-500/20 transition-colors rounded-lg flex items-center justify-center"
                        style={{
                          left: `${obj.bbox.x1 * 100}%`,
                          top: `${obj.bbox.y1 * 100}%`,
                          width: `${(obj.bbox.x2 - obj.bbox.x1) * 100}%`,
                          height: `${(obj.bbox.y2 - obj.bbox.y1) * 100}%`,
                        }}
                        title={`${obj.label} (${Math.round(obj.confidence * 100)}%)`}
                      >
                        <span className="text-xs bg-purple-500 text-white px-1.5 py-0.5 rounded">
                          {obj.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* 对象列表 */}
              <div className="space-y-2">
                {detectedObjects.map((obj, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleObjectSelect(obj)}
                    className="w-full p-3 border border-gray-200 rounded-xl hover:border-purple-300 hover:bg-purple-50 transition-all text-left flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-sm font-medium text-purple-600">
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
                <span className="text-purple-600 font-medium">AI 处理中...</span>
              </div>
              <p className="text-gray-500">
                {selectedObject 
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
