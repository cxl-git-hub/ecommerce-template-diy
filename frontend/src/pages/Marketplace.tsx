import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { templateApi, designApi, categoryApi } from '@/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { Template, Category } from '@/types';

interface MarketplaceTemplate extends Template {
  thumbnail_url: string | null;
}

const getFileUrl = (path: string | null | undefined): string | null => {
  if (!path) return null;
  return path.startsWith('/') ? path : `/${path}`;
};

export default function Marketplace() {
  const [templates, setTemplates] = useState<MarketplaceTemplate[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await templateApi.list({ category_id: categoryId, search, page, size: 20 });
      setTemplates(res.data);
    } catch (err) {
      console.error('获取模板列表失败', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await categoryApi.list();
      setCategories(res.data);
    } catch {}
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [categoryId, search, page]);

  const handleUseTemplate = async (templateId: number) => {
    if (!user) {
      navigate('/login');
      return;
    }
    try {
      const res = await designApi.create({ template_id: templateId });
      navigate(`/design/${res.data.id}`);
    } catch (err: any) {
      alert(err.response?.data?.detail || '创建设计失败');
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">模板广场</h1>
      
      {/* 搜索和筛选 */}
      <div className="flex gap-4 mb-6">
        <input
          type="text"
          placeholder="搜索模板..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="px-4 py-2 border rounded-md w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={categoryId || ''}
          onChange={(e) => { setCategoryId(e.target.value ? Number(e.target.value) : undefined); setPage(1); }}
          className="px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">全部分类</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* 模板列表 */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">加载中...</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 text-gray-500">暂无模板</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {templates.map((t) => (
            <div key={t.id} className="bg-white rounded-lg shadow-sm border overflow-hidden hover:shadow-md transition-shadow">
              <div className="aspect-square bg-gray-100 flex items-center justify-center">
                {getFileUrl(t.thumbnail_url) ? (
                  <img src={getFileUrl(t.thumbnail_url)!} alt={t.title} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-gray-400">暂无预览</span>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-medium text-gray-900 truncate">{t.title}</h3>
                <p className="text-sm text-gray-500 mt-1">{t.canvas_width} × {t.canvas_height}</p>
                <button
                  onClick={() => handleUseTemplate(t.id)}
                  className="mt-3 w-full py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                >
                  使用模板
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 分页 */}
      <div className="mt-6 flex justify-center gap-2">
        <button
          onClick={() => setPage(Math.max(1, page - 1))}
          disabled={page === 1}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          上一页
        </button>
        <span className="px-3 py-1">{page}</span>
        <button
          onClick={() => setPage(page + 1)}
          disabled={templates.length < 20}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          下一页
        </button>
      </div>
    </div>
  );
}
