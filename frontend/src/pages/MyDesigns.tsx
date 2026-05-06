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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">我的设计</h1>
        <p className="text-gray-500">管理您创建的所有设计作品</p>
      </div>

      {designs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-24 h-24 bg-gradient-to-br from-primary-100 to-accent-100 rounded-full flex items-center justify-center mb-6">
            <svg className="w-12 h-12 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">暂无设计</h3>
          <p className="text-gray-500 mb-6">开始创作您的第一个设计吧</p>
          <button 
            onClick={() => navigate('/')} 
            className="px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white font-medium rounded-xl hover:from-primary-600 hover:to-primary-700 transition-all shadow-sm"
          >
            去模板广场
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {designs.map((d) => (
            <div key={d.id} className="bg-white rounded-2xl overflow-hidden card-hover border border-gray-100">
              <div className="aspect-[4/3] bg-gradient-to-br from-gray-50 to-gray-100 relative overflow-hidden group">
                {d.thumbnail_url ? (
                  <img 
                    src={d.thumbnail_url} 
                    alt={`设计 ${d.id}`} 
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
                    onClick={() => navigate(`/design/${d.id}`)}
                    className="w-full py-2.5 bg-white text-gray-900 font-medium rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    继续编辑
                  </button>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    创建于 {new Date(d.created_at).toLocaleDateString('zh-CN')}
                  </p>
                  <button
                    onClick={() => handleDelete(d.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="删除"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
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
