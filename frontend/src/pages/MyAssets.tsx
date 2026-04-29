import { useState, useEffect, useRef, useCallback } from 'react';
import { assetApi } from '@/api';
import { Asset } from '@/types';

export default function MyAssets() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAssets = async () => {
    try {
      const res = await assetApi.list({ type: 'IMAGE', mine: true });
      setAssets(res.data);
    } catch (err) {
      console.error('获取素材列表失败', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'IMAGE');
      await assetApi.upload(formData);
      fetchAssets();
    } catch (err: any) {
      alert(err.response?.data?.detail || '上传失败');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除该素材？')) return;
    try {
      await assetApi.delete(id);
      setAssets(assets.filter((a) => a.id !== id));
    } catch (err: any) {
      alert(err.response?.data?.detail || '删除失败');
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      await uploadFile(file);
    } else {
      alert('请上传图片文件');
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">我的素材</h1>
        <label className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 cursor-pointer">
          {uploading ? '上传中...' : '上传图片'}
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleUpload}
            className="hidden"
            accept="image/*"
          />
        </label>
      </div>

      {/* 拖拽上传区域 */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`mb-6 border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          dragOver
            ? 'border-blue-500 bg-blue-50 text-blue-600'
            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50 text-gray-500'
        }`}
      >
        <p className="text-lg mb-1">📁 拖拽图片到此处上传</p>
        <p className="text-sm">或点击此区域选择文件</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">加载中...</div>
      ) : assets.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          暂无素材，拖拽图片到上方区域或点击按钮上传
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {assets.map((asset) => (
            <div key={asset.id} className="bg-white border rounded-lg overflow-hidden group">
              <div className="aspect-square bg-gray-50 flex items-center justify-center p-2">
                <img
                  src={asset.file_path.startsWith('/') ? asset.file_path : `/${asset.file_path}`}
                  alt={asset.file_name}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              <div className="p-2">
                <p className="text-xs truncate text-gray-700">{asset.file_name}</p>
                <p className="text-xs text-gray-400">{formatSize(asset.file_size)}</p>
                {asset.asset_metadata && (
                  <p className="text-xs text-gray-400">
                    {asset.asset_metadata.width} × {asset.asset_metadata.height}
                  </p>
                )}
                <button
                  onClick={() => handleDelete(asset.id)}
                  className="mt-1 text-xs text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
