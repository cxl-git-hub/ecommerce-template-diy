import { useEffect, useState } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { loadAllFonts } from '@/utils/fontLoader';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    loadAllFonts();
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 glass border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
              </div>
              <span className="text-lg font-bold gradient-text hidden sm:block">DIY设计系统</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              <Link 
                to="/" 
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive('/') 
                    ? 'bg-primary-50 text-primary-600' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                模板广场
              </Link>
              {user && (
                <>
                  <Link 
                    to="/my-designs" 
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive('/my-designs') 
                        ? 'bg-primary-50 text-primary-600' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    我的设计
                  </Link>
                  <Link 
                    to="/my-assets" 
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive('/my-assets') 
                        ? 'bg-primary-50 text-primary-600' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    我的素材
                  </Link>
                </>
              )}
              {user?.role === 'admin' && (
                <div className="relative group">
                  <button className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                    location.pathname.startsWith('/admin') 
                      ? 'bg-primary-50 text-primary-600' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}>
                    管理后台
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-xl shadow-elevated border border-gray-100 py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                    <Link to="/admin/templates" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">模板管理</Link>
                    <Link to="/admin/assets" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">素材管理</Link>
                    <Link to="/admin/categories" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">分类管理</Link>
                  </div>
                </div>
              )}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-3">
              {user ? (
                <div className="hidden md:flex items-center gap-3">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center text-white text-xs font-medium">
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-gray-700">{user.username}</span>
                  </div>
                  <button 
                    onClick={handleLogout} 
                    className="px-4 py-2 text-sm text-gray-600 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    退出
                  </button>
                </div>
              ) : (
                <div className="hidden md:flex gap-2">
                  <Link 
                    to="/login" 
                    className="px-5 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    登录
                  </Link>
                  <Link 
                    to="/register" 
                    className="px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 rounded-lg shadow-sm transition-all"
                  >
                    注册
                  </Link>
                </div>
              )}

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
              >
                {mobileMenuOpen ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Mobile menu */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-gray-200 animate-fade-in">
              <nav className="flex flex-col gap-1">
                <Link to="/" className="px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100 font-medium">模板广场</Link>
                {user && (
                  <>
                    <Link to="/my-designs" className="px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100 font-medium">我的设计</Link>
                    <Link to="/my-assets" className="px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100 font-medium">我的素材</Link>
                  </>
                )}
                {user?.role === 'admin' && (
                  <>
                    <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">管理后台</div>
                    <Link to="/admin/templates" className="px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100 font-medium">模板管理</Link>
                    <Link to="/admin/assets" className="px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100 font-medium">素材管理</Link>
                    <Link to="/admin/categories" className="px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100 font-medium">分类管理</Link>
                  </>
                )}
              </nav>
              <div className="mt-4 pt-4 border-t border-gray-200">
                {user ? (
                  <div className="flex items-center justify-between px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center text-white text-sm font-medium">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-700">{user.username}</span>
                    </div>
                    <button onClick={handleLogout} className="text-sm text-red-500 hover:text-red-600">退出</button>
                  </div>
                ) : (
                  <div className="flex gap-3 px-4">
                    <Link to="/login" className="flex-1 py-2.5 text-center text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">登录</Link>
                    <Link to="/register" className="flex-1 py-2.5 text-center text-sm font-medium text-white bg-gradient-to-r from-primary-500 to-primary-600 rounded-lg shadow-sm">注册</Link>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
