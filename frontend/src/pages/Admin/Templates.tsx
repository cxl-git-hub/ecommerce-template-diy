import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminTemplateApi, categoryApi } from '@/api';
import { Template, Category } from '@/types';

export default function AdminTemplates() {
  const [templates, setTemplates] = useState<Template[]>([]);
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
      await adminTemplateApi.delete(id);
      setTemplates(templates.filter((t) => t.id !== id));
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">模板管理</h1>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
          创建模板
        </button>
      </div>

      {/* 筛选 */}
      <div className="flex gap-4 mb-6">
        <input
          type="text"
          placeholder="搜索模板..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-4 py-2 border rounded-md w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-4 py-2 border rounded-md">
          <option value="">全部状态</option>
          <option value="DRAFT">草稿</option>
          <option value="PUBLISHED">已发布</option>
        </select>
        <select value={categoryId || ''} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : undefined)} className="px-4 py-2 border rounded-md">
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
        <div className="bg-white rounded-lg border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">标题</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">状态</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">尺寸</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">创建时间</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{t.title}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded ${t.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {t.status === 'PUBLISHED' ? '已发布' : '草稿'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{t.canvas_width} × {t.canvas_height}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{new Date(t.created_at).toLocaleDateString('zh-CN')}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => navigate(`/admin/templates/${t.id}/edit`)} className="text-sm text-blue-500 hover:underline mr-3">编辑</button>
                    <button onClick={() => handleCopy(t.id)} className="text-sm text-green-500 hover:underline mr-3">复制</button>
                    <button onClick={() => handleDelete(t.id)} className="text-sm text-red-500 hover:underline">删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 创建弹窗 */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h2 className="text-lg font-bold mb-4">创建模板</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">模板标题</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="输入模板标题"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">分类</label>
                <select value={newCategoryId || ''} onChange={(e) => setNewCategoryId(e.target.value ? Number(e.target.value) : undefined)} className="w-full px-3 py-2 border rounded-md">
                  <option value="">无分类</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">宽度</label>
                  <input type="number" value={newWidth} onChange={(e) => setNewWidth(Number(e.target.value))} className="w-full px-3 py-2 border rounded-md" />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">高度</label>
                  <input type="number" value={newHeight} onChange={(e) => setNewHeight(Number(e.target.value))} className="w-full px-3 py-2 border rounded-md" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 border rounded hover:bg-gray-50">取消</button>
              <button onClick={handleCreate} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">创建</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
