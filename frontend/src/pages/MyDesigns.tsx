import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { designApi } from '@/api';
import { UserDesign } from '@/types';

export default function MyDesigns() {
  const [designs, setDesigns] = useState<UserDesign[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchDesigns = async () => {
    try {
      const res = await designApi.list();
      setDesigns(res.data);
    } catch (err) {
      console.error('获取设计列表失败', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDesigns();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除该设计？')) return;
    try {
      await designApi.delete(id);
      setDesigns(designs.filter((d) => d.id !== id));
    } catch (err: any) {
      alert(err.response?.data?.detail || '删除失败');
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">加载中...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">我的设计</h1>
      {designs.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>暂无设计</p>
          <button onClick={() => navigate('/')} className="mt-4 text-blue-500 hover:underline">
            去模板广场看看
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {designs.map((d) => (
            <div key={d.id} className="bg-white rounded-lg shadow-sm border overflow-hidden hover:shadow-md transition-shadow">
              <div className="aspect-square bg-gray-100 flex items-center justify-center">
                {d.thumbnail_url ? (
                  <img src={d.thumbnail_url} alt={`设计 ${d.id}`} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-gray-400">暂无预览</span>
                )}
              </div>
              <div className="p-4">
                <p className="text-sm text-gray-500">
                  创建于 {new Date(d.created_at).toLocaleDateString('zh-CN')}
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => navigate(`/design/${d.id}`)}
                    className="flex-1 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                  >
                    继续编辑
                  </button>
                  <button
                    onClick={() => handleDelete(d.id)}
                    className="px-3 py-2 border border-red-300 text-red-500 text-sm rounded hover:bg-red-50"
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
