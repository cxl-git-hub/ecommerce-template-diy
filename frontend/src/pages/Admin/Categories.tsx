import { useState, useEffect } from 'react';
import { categoryApi } from '@/api';
import { Category } from '@/types';

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [sortOrder, setSortOrder] = useState(0);

  const fetchCategories = async () => {
    try {
      const res = await categoryApi.list();
      setCategories(res.data);
    } catch (err) {
      console.error('获取分类列表失败', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      await categoryApi.create({ name, sort_order: sortOrder });
      setName('');
      setSortOrder(0);
      setShowCreate(false);
      fetchCategories();
    } catch (err: any) {
      alert(err.response?.data?.detail || '创建失败');
    }
  };

  const handleUpdate = async (id: number) => {
    if (!name.trim()) return;
    try {
      await categoryApi.update(id, { name, sort_order: sortOrder });
      setEditingId(null);
      setName('');
      setSortOrder(0);
      fetchCategories();
    } catch (err: any) {
      alert(err.response?.data?.detail || '更新失败');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除该分类？')) return;
    try {
      await categoryApi.delete(id);
      setCategories(categories.filter((c) => c.id !== id));
    } catch (err: any) {
      alert(err.response?.data?.detail || '删除失败');
    }
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setName(cat.name);
    setSortOrder(cat.sort_order);
    setShowCreate(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setName('');
    setSortOrder(0);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">分类管理</h1>
        <button
          onClick={() => { setShowCreate(true); setEditingId(null); setName(''); setSortOrder(0); }}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          创建分类
        </button>
      </div>

      {/* 创建/编辑表单 */}
      {(showCreate || editingId !== null) && (
        <div className="bg-white border rounded-lg p-4 mb-6">
          <h3 className="font-medium mb-3">{editingId !== null ? '编辑分类' : '创建分类'}</h3>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm text-gray-600 mb-1">分类名称</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="输入分类名称"
              />
            </div>
            <div className="w-32">
              <label className="block text-sm text-gray-600 mb-1">排序</label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={() => editingId !== null ? handleUpdate(editingId) : handleCreate()}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              {editingId !== null ? '保存' : '创建'}
            </button>
            <button
              onClick={() => { editingId !== null ? cancelEdit() : setShowCreate(false); }}
              className="px-4 py-2 border rounded hover:bg-gray-50"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 分类列表 */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">加载中...</div>
      ) : categories.length === 0 ? (
        <div className="text-center py-12 text-gray-500">暂无分类</div>
      ) : (
        <div className="bg-white rounded-lg border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">ID</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">名称</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">排序</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">创建时间</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{cat.id}</td>
                  <td className="px-4 py-3 text-sm">{cat.name}</td>
                  <td className="px-4 py-3 text-sm">{cat.sort_order}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{new Date(cat.created_at).toLocaleDateString('zh-CN')}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => startEdit(cat)} className="text-sm text-blue-500 hover:underline mr-3">编辑</button>
                    <button onClick={() => handleDelete(cat.id)} className="text-sm text-red-500 hover:underline">删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
