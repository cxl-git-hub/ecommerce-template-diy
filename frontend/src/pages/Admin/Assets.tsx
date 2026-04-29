import { useState, useEffect } from 'react';
import { assetApi } from '@/api';
import { Asset } from '@/types';
import { loadFont } from '@/utils/fontLoader';

const getFileUrl = (path: string | null | undefined): string | null => {
  if (!path) return null;
  return path.startsWith('/') ? path : `/${path}`;
};

export default function AdminAssets() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [type, setType] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const fetchAssets = async () => {
    try {
      const res = await assetApi.list({ type: type || undefined });
      setAssets(res.data);
    } catch (err) {
      console.error('获取素材列表失败', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [type]);

  // 加载字体文件用于预览
  useEffect(() => {
    for (const asset of assets) {
      if (asset.type === 'FONT' && asset.font_family) {
        loadFont(asset.font_family, asset.file_path.startsWith("/") ? asset.file_path : `/${asset.file_path}`);
      }
    }
  }, [assets]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isFont = /\.(ttf|otf|woff|woff2)$/i.test(file.name);
    const fileType = isFont ? 'FONT' : 'IMAGE';

    let fontFamily = '';
    let fontCategories = '';
    if (isFont) {
      fontFamily = prompt('请输入字体家族名称（如：Noto Sans SC）') || '';
      if (!fontFamily) return;
      fontCategories = prompt('请输入字体分类（逗号分隔，如：简体中文,广告字体）') || '';
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', fileType);
      if (fontFamily) formData.append('font_family', fontFamily);
      if (fontCategories) formData.append('font_categories', fontCategories);
      await assetApi.upload(formData);
      fetchAssets();
    } catch (err: any) {
      alert(err.response?.data?.detail || '上传失败');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
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

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">素材管理</h1>
        <label className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 cursor-pointer">
          {uploading ? '上传中...' : '上传素材'}
          <input type="file" onChange={handleUpload} className="hidden" accept="image/*,.ttf,.otf,.woff,.woff2" />
        </label>
      </div>

      <div className="flex gap-4 mb-6">
        <button onClick={() => setType('')} className={`px-4 py-2 rounded text-sm ${!type ? 'bg-blue-500 text-white' : 'border hover:bg-gray-50'}`}>
          全部
        </button>
        <button onClick={() => setType('IMAGE')} className={`px-4 py-2 rounded text-sm ${type === 'IMAGE' ? 'bg-blue-500 text-white' : 'border hover:bg-gray-50'}`}>
          图片
        </button>
        <button onClick={() => setType('FONT')} className={`px-4 py-2 rounded text-sm ${type === 'FONT' ? 'bg-blue-500 text-white' : 'border hover:bg-gray-50'}`}>
          字体
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">加载中...</div>
      ) : assets.length === 0 ? (
        <div className="text-center py-12 text-gray-500">暂无素材</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {assets.map((asset) => (
            <div key={asset.id} className="bg-white border rounded-lg overflow-hidden group">
              <div className="aspect-square bg-gray-50 flex items-center justify-center p-2">
                {asset.type === 'IMAGE' ? (
                  <img src={getFileUrl(asset.file_path) || ''} alt={asset.file_name} className="max-w-full max-h-full object-contain" />
                ) : (
                  <div className="text-center">
                    <span className="text-2xl block mb-1 leading-tight" style={{ fontFamily: asset.font_family || 'sans-serif' }}>
                      AaBbCc 你好世界 123
                    </span>
                    <span className="text-xs text-gray-500">{asset.font_family}</span>
                  </div>
                )}
              </div>
              <div className="p-2">
                <p className="text-xs truncate text-gray-700">{asset.font_family || asset.file_name}</p>
                <p className="text-xs text-gray-400">{formatSize(asset.file_size)}</p>
                {asset.font_categories && (
                  <p className="text-xs text-gray-400 truncate">{asset.font_categories.join(', ')}</p>
                )}
                <button onClick={() => handleDelete(asset.id)} className="mt-1 text-xs text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity">
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
