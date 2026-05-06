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
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">模板广场</h1>
        <p className="text-gray-500">选择一个模板开始您的设计</p>
      </div>
      
      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <div className="relative flex-1">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="搜索模板..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
          />
        </div>
        <select
          value={categoryId || ''}
          onChange={(e) => { setCategoryId(e.target.value ? Number(e.target.value) : undefined); setPage(1); }}
          className="px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all min-w-[150px]"
        >
          <option value="">全部分类</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Template Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin mb-4"></div>
          <p className="text-gray-500">加载中...</p>
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-gray-500 text-lg">暂无模板</p>
          <p className="text-gray-400 text-sm mt-1">稍后再来看看吧</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {templates.map((t) => (
            <div key={t.id} className="bg-white rounded-2xl overflow-hidden card-hover border border-gray-100">
              <div className="aspect-[4/3] bg-gradient-to-br from-gray-50 to-gray-100 relative overflow-hidden group">
                {getFileUrl(t.thumbnail_url) ? (
                  <img 
                    src={getFileUrl(t.thumbnail_url)!} 
                    alt={t.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                    <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm">暂无预览</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                  <button
                    onClick={() => handleUseTemplate(t.id)}
                    className="w-full py-2.5 bg-white text-gray-900 font-medium rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    使用模板
                  </button>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 truncate mb-1">{t.title}</h3>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                  {t.canvas_width} × {t.canvas_height}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {templates.length > 0 && (
        <div className="mt-10 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            上一页
          </button>
          <div className="px-4 py-2 text-sm font-medium text-primary-600 bg-primary-50 rounded-lg">
            第 {page} 页
          </div>
          <button
            onClick={() => setPage(page + 1)}
            disabled={templates.length < 20}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
}
