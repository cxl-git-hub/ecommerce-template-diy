import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Marketplace from '@/pages/Marketplace';
import MyDesigns from '@/pages/MyDesigns';
import DesignEditor from '@/pages/DesignEditor';
import AdminTemplates from '@/pages/Admin/Templates';
import AdminTemplateEditor from '@/pages/Admin/TemplateEditor';
import AdminAssets from '@/pages/Admin/Assets';
import AdminCategories from '@/pages/Admin/Categories';
import MyAssets from '@/pages/MyAssets';
import Layout from '@/components/layout/Layout';

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, loading } = useAuthStore();
  if (loading) return <div className="flex items-center justify-center h-screen">加载中...</div>;
  if (!user) return <Navigate to="/login" />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" />;
  return <>{children}</>;
}

export default function App() {
  const init = useAuthStore((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Marketplace />} />
          <Route path="my-designs" element={
            <ProtectedRoute><MyDesigns /></ProtectedRoute>
          } />
          <Route path="my-assets" element={
            <ProtectedRoute><MyAssets /></ProtectedRoute>
          } />
          <Route path="design/:id" element={
            <ProtectedRoute><DesignEditor /></ProtectedRoute>
          } />
          <Route path="admin/templates" element={
            <ProtectedRoute adminOnly><AdminTemplates /></ProtectedRoute>
          } />
          <Route path="admin/templates/:id/edit" element={
            <ProtectedRoute adminOnly><AdminTemplateEditor /></ProtectedRoute>
          } />
          <Route path="admin/assets" element={
            <ProtectedRoute adminOnly><AdminAssets /></ProtectedRoute>
          } />
          <Route path="admin/categories" element={
            <ProtectedRoute adminOnly><AdminCategories /></ProtectedRoute>
          } />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
