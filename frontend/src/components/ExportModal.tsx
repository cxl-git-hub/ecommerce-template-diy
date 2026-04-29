import { useState } from 'react';

interface ExportModalProps {
  visible: boolean;
  onClose: () => void;
  onExport: (format: 'png' | 'jpeg', quality: number) => void;
}

export default function ExportModal({ visible, onClose, onExport }: ExportModalProps) {
  const [format, setFormat] = useState<'png' | 'jpeg'>('png');
  const [quality, setQuality] = useState(90);

  if (!visible) return null;

  const handleExport = () => {
    onExport(format, quality / 100);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">导出设计</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl">✕</button>
        </div>

        <div className="space-y-4">
          {/* 格式选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">导出格式</label>
            <div className="flex gap-3">
              <button
                onClick={() => setFormat('png')}
                className={`flex-1 px-4 py-3 border-2 rounded-lg text-sm font-medium transition-colors ${
                  format === 'png'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-lg mb-1">🖼️</div>
                PNG
                <div className="text-xs text-gray-400 mt-1">无损透明</div>
              </button>
              <button
                onClick={() => setFormat('jpeg')}
                className={`flex-1 px-4 py-3 border-2 rounded-lg text-sm font-medium transition-colors ${
                  format === 'jpeg'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-lg mb-1">📷</div>
                JPEG
                <div className="text-xs text-gray-400 mt-1">体积更小</div>
              </button>
            </div>
          </div>

          {/* 质量滑块（仅 JPEG） */}
          {format === 'jpeg' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                输出质量: <span className="text-blue-600">{quality}%</span>
              </label>
              <input
                type="range"
                min={10}
                max={100}
                step={5}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="w-full accent-blue-500"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>小体积</span>
                <span>高质量</span>
              </div>
            </div>
          )}

          {/* PNG 提示 */}
          {format === 'png' && (
            <div className="bg-blue-50 text-blue-700 text-sm p-3 rounded-lg">
              💡 PNG 格式支持透明背景，适合需要叠加使用的场景
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-50">
            取消
          </button>
          <button onClick={handleExport} className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
            导出
          </button>
        </div>
      </div>
    </div>
  );
}
