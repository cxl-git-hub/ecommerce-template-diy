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
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">我的素材</h1>
          <p className="text-gray-500">上传和管理您的个人素材库</p>
        </div>
        <label className="px-5 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 text-white font-medium rounded-xl hover:from-primary-600 hover:to-primary-700 cursor-pointer transition-all shadow-sm flex items-center gap-2">
          {uploading ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              上传中...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              上传图片
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleUpload}
            className="hidden"
            accept="image/*"
          />
        </label>
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`mb-8 border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
          dragOver
            ? 'border-primary-500 bg-primary-50 text-primary-600 scale-[1.02]'
            : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50 text-gray-500'
        }`}
      >
        <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center transition-colors ${
          dragOver ? 'bg-primary-100' : 'bg-gray-100'
        }`}>
          <svg className={`w-8 h-8 ${dragOver ? 'text-primary-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <p className="text-lg font-medium mb-1">
          {dragOver ? '释放以上传' : '拖拽图片到此处上传'}
        </p>
        <p className="text-sm text-gray-400">或点击此区域选择文件</p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin mb-4"></div>
          <p className="text-gray-500">加载中...</p>
        </div>
      ) : assets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-24 h-24 bg-gradient-to-br from-primary-100 to-accent-100 rounded-full flex items-center justify-center mb-6">
            <svg className="w-12 h-12 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">暂无素材</h3>
          <p className="text-gray-500">上传您的第一张图片开始使用</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {assets.map((asset) => (
            <div key={asset.id} className="bg-white rounded-xl overflow-hidden card-hover border border-gray-100 group">
              <div className="aspect-square bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-3 relative">
                <img
                  src={asset.file_path.startsWith('/') ? asset.file_path : `/${asset.file_path}`}
                  alt={asset.file_name}
                  className="max-w-full max-h-full object-contain group-hover:scale-110 transition-transform duration-300"
                />
                <button
                  onClick={() => handleDelete(asset.id)}
                  className="absolute top-2 right-2 p-1.5 bg-white/90 text-red-500 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 transition-all shadow-sm"
                  title="删除"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
              <div className="p-3">
                <p className="text-xs truncate text-gray-700 font-medium">{asset.file_name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{formatSize(asset.file_size)}</p>
                {asset.asset_metadata && (
                  <p className="text-xs text-gray-400">
                    {asset.asset_metadata.width} × {asset.asset_metadata.height}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
