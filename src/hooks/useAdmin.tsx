import { useState, useEffect, useCallback } from 'react';

const ADMIN_TOKEN_KEY = 'glamsup_admin_token';
const ADMIN_USER_KEY = 'glamsup_admin_user';

const getBaseUrl = () => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  return url;
};

const getAnonKey = () => import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const useAdmin = () => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(ADMIN_TOKEN_KEY));
  const [adminUser, setAdminUser] = useState<string | null>(() => localStorage.getItem(ADMIN_USER_KEY));
  const [loading, setLoading] = useState(false);

  const isAuthenticated = !!token;

  const login = useCallback(async (username: string, password: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${getBaseUrl()}/functions/v1/admin-auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': getAnonKey() },
        body: JSON.stringify({ action: 'login', username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
      localStorage.setItem(ADMIN_USER_KEY, data.username);
      setToken(data.token);
      setAdminUser(data.username);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    if (token) {
      await fetch(`${getBaseUrl()}/functions/v1/admin-auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': getAnonKey() },
        body: JSON.stringify({ action: 'logout', token }),
      }).catch(() => {});
    }
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_USER_KEY);
    setToken(null);
    setAdminUser(null);
  }, [token]);

  const apiCall = useCallback(async (action: string, extra: Record<string, any> = {}) => {
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${getBaseUrl()}/functions/v1/admin-api`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': getAnonKey() },
      body: JSON.stringify({ action, token, ...extra }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'API call failed');
    return data;
  }, [token]);

  const updateCredentials = useCallback(async (username?: string, password?: string) => {
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${getBaseUrl()}/functions/v1/admin-auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': getAnonKey() },
      body: JSON.stringify({ action: 'update_credentials', token, username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Update failed');
    if (username) {
      localStorage.setItem(ADMIN_USER_KEY, username);
      setAdminUser(username);
    }
    return data;
  }, [token]);

  return { token, adminUser, isAuthenticated, loading, login, logout, apiCall, updateCredentials };
};
