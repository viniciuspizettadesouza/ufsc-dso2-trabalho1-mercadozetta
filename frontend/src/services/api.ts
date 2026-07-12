import axios from 'axios';
import { defaultBrand, getBrandByTenantId } from '../brands';

const activeBrand = getBrandByTenantId(import.meta.env.VITE_TENANT_ID);

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3333',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  config.headers['X-Tenant-Id'] = activeBrand.tenantId || defaultBrand.tenantId;

  return config;
});

export default api;
