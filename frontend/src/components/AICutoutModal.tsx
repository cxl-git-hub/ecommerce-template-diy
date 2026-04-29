import { useState, useRef } from 'react';
import { aiApi } from '@/api';

interface AICutoutModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (imageUrl: string) => void;
}

type Step = 'upload' | 'processing' | 'preview';

export default function AICutoutModal({ visible, onClose, onConfirm }: AICutoutModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!visible) return null;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setStep('processing');
    setOriginalUrl(URL.createObjectURL(file));

    try {
      const res = await aiApi.removeBg(file);
      setResultUrl(res.data.file_path);
      setStep('preview');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'AI 抠图处理失败，请重试');
      setStep('upload');
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
    setOriginalUrl(null);
    setResultUrl(null);
    setError(null);
    onClose();
  };

  const handleRetry = () => {
    setStep('upload');
    setOriginalUrl(null);
    setResultUrl(null);
    setError(null);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-[500px] max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">AI 智能抠图</h2>
          <button onClick={handleClose} className="text-gray-500 hover:text-gray-700 text-xl">✕</button>
        </div>

        {/* Step: Upload */}
        {step === 'upload' && (
          <div className="text-center py-8">
            <div className="mb-4 text-4xl">✂️</div>
            <p className="text-gray-600 mb-2">上传人物或物体照片</p>
            <p className="text-sm text-gray-400 mb-6">AI 将自动识别主体并去除背景</p>
            {error && (
              <p className="text-sm text-red-500 mb-4">{error}</p>
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
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              选择图片
            </button>
            <p className="text-xs text-gray-400 mt-3">支持 JPG、PNG 格式</p>
          </div>
        )}

        {/* Step: Processing */}
        {step === 'processing' && (
          <div className="text-center py-8">
            {originalUrl && (
              <div className="mb-4 flex justify-center">
                <img src={originalUrl} alt="原图" className="max-h-48 rounded border" />
              </div>
            )}
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
              <span className="text-blue-600 font-medium">AI 处理中...</span>
            </div>
            <p className="text-sm text-gray-400">正在智能识别主体并去除背景，请稍候</p>
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && (
          <div className="py-4">
            <div className="flex gap-4 mb-4">
              <div className="flex-1 text-center">
                <p className="text-xs text-gray-500 mb-2">原图</p>
                <div className="aspect-square bg-gray-100 rounded flex items-center justify-center overflow-hidden">
                  {originalUrl && <img src={originalUrl} alt="原图" className="max-w-full max-h-full object-contain" />}
                </div>
              </div>
              <div className="flex items-center text-gray-400">→</div>
              <div className="flex-1 text-center">
                <p className="text-xs text-gray-500 mb-2">抠图结果</p>
                <div className="aspect-square bg-[repeating-conic-gradient(#e5e5e5_0%_25%,#fff_0%_50%)] bg-[length:16px_16px] rounded flex items-center justify-center overflow-hidden">
                  {resultUrl && <img src={resultUrl} alt="抠图结果" className="max-w-full max-h-full object-contain" />}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={handleRetry} className="px-4 py-2 border rounded hover:bg-gray-50">
                重新上传
              </button>
              <button onClick={handleConfirm} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                确认使用
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
