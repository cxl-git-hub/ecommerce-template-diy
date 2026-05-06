import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminTemplateApi, categoryApi } from '@/api';
import { Category } from '@/types';

interface TemplateWithVersion {
  id: number;
  title: string;
  description?: string;
  category_id?: number;
  canvas_width: number;
  canvas_height: number;
  status: string;
  published_version_id?: number;
  created_by: number;
  is_deleted: number;
  created_at: string;
  updated_at: string;
  current_version?: {
    id: number;
    version_number: number;
    description?: string;
    thumbnail_url?: string;
    status: string;
    created_at: string;
  };
  versions_count: number;
}

export default function AdminTemplates() {
  const [templates, setTemplates] = useState<TemplateWithVersion[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [status, setStatus] = useState('');
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategoryId, setNewCategoryId] = useState<number | undefined>();
  const [newWidth, setNewWidth] = useState(800);
  const [newHeight, setNewHeight] = useState(800);
  const [previewTemplate, setPreviewTemplate] = useState<TemplateWithVersion | null>(null);
  const navigate = useNavigate();

  const fetchTemplates = async () => {
    try {
      const res = await adminTemplateApi.list({ status: status || undefined, category_id: categoryId, search: search || undefined });
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
  }, [status, categoryId, search]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    try {
      const res = await adminTemplateApi.create({
        title: newTitle,
        category_id: newCategoryId,
        canvas_width: newWidth,
        canvas_height: newHeight,
      });
      setShowCreate(false);
      setNewTitle('');
      navigate(`/admin/templates/${res.data.id}/edit`);
    } catch (err: any) {
      alert(err.response?.data?.detail || '创建失败');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除该模板？')) return;
    try {
      await adminTemplateApi.delete(id, false);
      fetchTemplates();
    } catch (err: any) {
      alert(err.response?.data?.detail || '删除失败');
    }
  };

  const handleDeleteAll = async (id: number) => {
    if (!confirm('确定彻底删除该模板及所有版本？此操作不可恢复！')) return;
    try {
      await adminTemplateApi.delete(id, true);
      fetchTemplates();
    } catch (err: any) {
      alert(err.response?.data?.detail || '删除失败');
    }
  };

  const handleCopy = async (id: number) => {
    try {
      await adminTemplateApi.copy(id);
      fetchTemplates();
    } catch (err: any) {
      alert(err.response?.data?.detail || '复制失败');
    }
  };

  const handlePublish = async (id: number) => {
    if (!confirm('确定发布该模板？')) return;
    try {
      await adminTemplateApi.publish(id, '从列表发布', undefined);
      fetchTemplates();
    } catch (err: any) {
      alert(err.response?.data?.detail || '发布失败');
    }
  };

  const handleUnpublish = async (id: number) => {
    if (!confirm('确定下架该模板？')) return;
    try {
      await adminTemplateApi.unpublish(id);
      fetchTemplates();
    } catch (err: any) {
      alert(err.response?.data?.detail || '下架失败');
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">模板管理</h1>
          <p className="text-gray-500">管理所有模板和版本</p>
        </div>
        <button 
          onClick={() => setShowCreate(true)} 
          className="px-5 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 text-white font-medium rounded-xl hover:from-primary-600 hover:to-primary-700 transition-all shadow-sm flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          创建模板
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-soft mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="搜索模板..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent focus:bg-white transition-all"
            />
          </div>
          <select 
            value={status} 
            onChange={(e) => setStatus(e.target.value)} 
            className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent focus:bg-white transition-all"
          >
            <option value="">全部状态</option>
            <option value="DRAFT">草稿</option>
            <option value="PUBLISHED">已发布</option>
          </select>
          <select 
            value={categoryId || ''} 
            onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : undefined)} 
            className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent focus:bg-white transition-all"
          >
            <option value="">全部分类</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Template List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin mb-4"></div>
          <p className="text-gray-500">加载中...</p>
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-gray-500 text-lg">暂无模板</p>
          <p className="text-gray-400 text-sm mt-1">点击"创建模板"开始</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">缩略图</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">模板信息</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">状态</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">版本</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">尺寸</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">创建时间</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {templates.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                    {/* Thumbnail */}
                    <td className="px-6 py-4">
                      <div 
                        className="w-16 h-16 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl cursor-pointer overflow-hidden relative group border border-gray-100"
                        onClick={() => setPreviewTemplate(t)}
                      >
                        {t.current_version?.thumbnail_url ? (
                          <img 
                            src={t.current_version.thumbnail_url.startsWith('/') ? t.current_version.thumbnail_url : `/${t.current_version.thumbnail_url}`} 
                            alt={t.title} 
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </td>
                    {/* Info */}
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">{t.title}</div>
                      {t.description && (
                        <div className="text-sm text-gray-500 mt-1 truncate max-w-xs">{t.description}</div>
                      )}
                      <div className="text-xs text-gray-400 mt-1">{t.current_version?.description || '暂无版本描述'}</div>
                    </td>
                    {/* Status */}
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                        t.status === 'PUBLISHED' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {t.status === 'PUBLISHED' ? '已发布' : '草稿'}
                      </span>
                    </td>
                    {/* Version */}
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">v{t.current_version?.version_number || 0}</div>
                      <div className="text-xs text-gray-400">{t.versions_count}个版本</div>
                    </td>
                    {/* Size */}
                    <td className="px-6 py-4 text-sm text-gray-600">{t.canvas_width} × {t.canvas_height}</td>
                    {/* Date */}
                    <td className="px-6 py-4 text-sm text-gray-600">{new Date(t.created_at).toLocaleDateString('zh-CN')}</td>
                    {/* Actions */}
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button 
                          onClick={() => navigate(`/admin/templates/${t.id}/edit`)} 
                          className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          title="编辑"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        {t.status === 'DRAFT' ? (
                          <button 
                            onClick={() => handlePublish(t.id)} 
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="发布"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleUnpublish(t.id)} 
                            className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                            title="下架"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                          </button>
                        )}
                        <button 
                          onClick={() => handleCopy(t.id)} 
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title="复制"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                        <button 
                          onClick={() => handleDelete(t.id)} 
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="删除"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewTemplate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setPreviewTemplate(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">{previewTemplate.title}</h2>
              <button 
                onClick={() => setPreviewTemplate(null)} 
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-auto max-h-[70vh]">
              {previewTemplate.current_version?.thumbnail_url ? (
                <img 
                  src={previewTemplate.current_version.thumbnail_url.startsWith('/') ? previewTemplate.current_version.thumbnail_url : `/${previewTemplate.current_version.thumbnail_url}`} 
                  alt={previewTemplate.title} 
                  className="w-full rounded-xl border border-gray-100"
                />
              ) : (
                <div className="aspect-square bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p>暂无缩略图</p>
                  </div>
                </div>
              )}
              <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
                <div className="bg-gray-50 rounded-xl p-4">
                  <span className="text-gray-500">描述</span>
                  <p className="mt-1 font-medium text-gray-900">{previewTemplate.description || '无'}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <span className="text-gray-500">版本</span>
                  <p className="mt-1 font-medium text-gray-900">v{previewTemplate.current_version?.version_number || 0}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <span className="text-gray-500">尺寸</span>
                  <p className="mt-1 font-medium text-gray-900">{previewTemplate.canvas_width} × {previewTemplate.canvas_height}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <span className="text-gray-500">状态</span>
                  <p className="mt-1 font-medium text-gray-900">{previewTemplate.status === 'PUBLISHED' ? '已发布' : '草稿'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md animate-scale-in">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">创建模板</h2>
              <button 
                onClick={() => setShowCreate(false)} 
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">模板标题</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent focus:bg-white transition-all"
                    placeholder="输入模板标题"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">分类</label>
                  <select 
                    value={newCategoryId || ''} 
                    onChange={(e) => setNewCategoryId(e.target.value ? Number(e.target.value) : undefined)} 
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent focus:bg-white transition-all"
                  >
                    <option value="">无分类</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">宽度</label>
                    <input 
                      type="number" 
                      value={newWidth} 
                      onChange={(e) => setNewWidth(Number(e.target.value))} 
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent focus:bg-white transition-all" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">高度</label>
                    <input 
                      type="number" 
                      value={newHeight} 
                      onChange={(e) => setNewHeight(Number(e.target.value))} 
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent focus:bg-white transition-all" 
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
              <button 
                onClick={() => setShowCreate(false)} 
                className="px-5 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors"
              >
                取消
              </button>
              <button 
                onClick={handleCreate} 
                className="px-5 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 text-white font-medium rounded-xl hover:from-primary-600 hover:to-primary-700 transition-all shadow-sm"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
