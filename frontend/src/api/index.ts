import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

// 请求拦截器：自动添加 token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：处理 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// ==================== Auth ====================
export const authApi = {
  register: (data: { email: string; username: string; password: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
};

// ==================== Categories ====================
export const categoryApi = {
  list: () => api.get('/categories'),
  create: (data: { name: string; sort_order?: number }) =>
    api.post('/categories', data),
  update: (id: number, data: { name?: string; sort_order?: number }) =>
    api.put(`/categories/${id}`, data),
  delete: (id: number) => api.delete(`/categories/${id}`),
};

// ==================== Assets ====================
export const assetApi = {
  list: (params?: { type?: string; mine?: boolean }) =>
    api.get('/assets', { params }),
  upload: (formData: FormData) =>
    api.post('/assets/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  delete: (id: number) => api.delete(`/assets/${id}`),
  listFonts: () => api.get('/assets/fonts'),
};

// ==================== Admin Templates ====================
export const adminTemplateApi = {
  list: (params?: { status?: string; category_id?: number; search?: string }) =>
    api.get('/admin/templates', { params }),
  get: (id: number) => api.get(`/admin/templates/${id}`),
  create: (data: { title: string; category_id?: number; canvas_width?: number; canvas_height?: number }) =>
    api.post('/admin/templates', data),
  update: (id: number, data: { title?: string; description?: string; category_id?: number }) =>
    api.put(`/admin/templates/${id}`, data),
  delete: (id: number) => api.delete(`/admin/templates/${id}`),
  copy: (id: number) => api.post(`/admin/templates/${id}/copy`),
  saveDraft: (id: number, config_data: object) =>
    api.put(`/admin/templates/${id}/draft`, config_data),
  publish: (id: number, description: string, thumbnail_base64?: string) =>
    api.post(`/admin/templates/${id}/publish`, { description, thumbnail_base64 }),
  unpublish: (id: number) => api.post(`/admin/templates/${id}/unpublish`),
  listVersions: (id: number) => api.get(`/admin/templates/${id}/versions`),
  getVersion: (templateId: number, versionId: number) =>
    api.get(`/admin/templates/${templateId}/versions/${versionId}`),
  copyFromVersion: (templateId: number, versionId: number) =>
    api.post(`/admin/templates/${templateId}/versions/${versionId}/copy`),
};

// ==================== Public Templates ====================
export const templateApi = {
  list: (params?: { category_id?: number; search?: string; page?: number; size?: number }) =>
    api.get('/templates', { params }),
};

// ==================== User Designs ====================
export const designApi = {
  create: (data: { template_id: number }) => api.post('/designs', data),
  list: () => api.get('/designs'),
  get: (id: number) => api.get(`/designs/${id}`),
  updateConfig: (id: number, config_data: object, thumbnail_base64?: string) =>
    api.put(`/designs/${id}/config`, { config_data, thumbnail_base64 }),
  export: (id: number, data: { format: string; quality: number }) =>
    api.post(`/designs/${id}/export`, data),
  delete: (id: number) => api.delete(`/designs/${id}`),
  getThumbnail: (id: number) => api.get(`/designs/${id}/thumbnail`),
};

// ==================== AI ====================
export const aiApi = {
  removeBg: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/ai/remove-bg', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// ==================== Utils ====================
export const utilApi = {
  makeTransparent: (file: File, points: { x: number; y: number }[]) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('points', JSON.stringify(points));
    return api.post('/utils/make-transparent', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
