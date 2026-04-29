import { useEffect } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { loadAllFonts } from '@/utils/fontLoader';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    loadAllFonts();
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="text-lg font-bold text-blue-600">DIY设计系统</Link>
            <nav className="flex gap-4 text-sm">
              <Link to="/" className="text-gray-600 hover:text-blue-600">模板广场</Link>
              {user && (
                <>
                  <Link to="/my-designs" className="text-gray-600 hover:text-blue-600">我的设计</Link>
                  <Link to="/my-assets" className="text-gray-600 hover:text-blue-600">我的素材</Link>
                </>
              )}
              {user?.role === 'admin' && (
                <>
                  <Link to="/admin/templates" className="text-gray-600 hover:text-blue-600">模板管理</Link>
                  <Link to="/admin/assets" className="text-gray-600 hover:text-blue-600">素材管理</Link>
                  <Link to="/admin/categories" className="text-gray-600 hover:text-blue-600">分类管理</Link>
                </>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <span className="text-sm text-gray-600">{user.username}</span>
                <button onClick={handleLogout} className="text-sm text-red-500 hover:text-red-700">退出</button>
              </>
            ) : (
              <div className="flex gap-2">
                <Link to="/login" className="px-4 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">登录</Link>
                <Link to="/register" className="px-4 py-1.5 text-sm border border-blue-500 text-blue-500 rounded hover:bg-blue-50">注册</Link>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
