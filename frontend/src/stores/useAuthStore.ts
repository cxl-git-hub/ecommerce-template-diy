import { create } from 'zustand';
import { User } from '@/types';
import { authApi } from '@/api';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
  fetchUser: () => Promise<void>;
  init: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('access_token'),
  loading: true,

  login: async (email, password) => {
    const res = await authApi.login({ email, password });
    const { access_token } = res.data;
    localStorage.setItem('access_token', access_token);
    set({ token: access_token });
    await get().fetchUser();
  },

  register: async (email, username, password) => {
    await authApi.register({ email, username, password });
  },

  logout: () => {
    localStorage.removeItem('access_token');
    set({ user: null, token: null });
  },

  fetchUser: async () => {
    try {
      const res = await authApi.getMe();
      set({ user: res.data, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },

  init: async () => {
    const token = localStorage.getItem('access_token');
    if (token) {
      set({ token });
      await get().fetchUser();
    } else {
      set({ loading: false });
    }
  },
}));
