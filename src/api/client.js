import axios from 'axios'
import config from '../config'

const STORAGE_KEYS = {
  access: 'access_token',
  refresh: 'refresh_token',
}

export function getAccessToken() {
  return localStorage.getItem(STORAGE_KEYS.access)
}

export function getRefreshToken() {
  return localStorage.getItem(STORAGE_KEYS.refresh)
}

export function setTokens({ access_token, refresh_token }) {
  localStorage.setItem(STORAGE_KEYS.access, access_token)
  if (refresh_token) {
    localStorage.setItem(STORAGE_KEYS.refresh, refresh_token)
  }
}

export function clearTokens() {
  localStorage.removeItem(STORAGE_KEYS.access)
  localStorage.removeItem(STORAGE_KEYS.refresh)
}

const api = axios.create({
  baseURL: config.apiBaseUrl,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((requestConfig) => {
  const token = getAccessToken()
  if (token) {
    requestConfig.headers.Authorization = `Bearer ${token}`
  }
  if (config.apiKey) {
    requestConfig.headers['X-API-Key'] = config.apiKey
  }
  return requestConfig
})

let refreshPromise = null

async function refreshAccessToken() {
  const refresh_token = getRefreshToken()
  if (!refresh_token) {
    throw new Error('No refresh token')
  }
  const { data } = await axios.post(
    `${config.apiBaseUrl}/api/auth/refresh`,
    { refresh_token },
  )
  setTokens(data)
  return data.access_token
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    const status = error.response?.status

    // Do not hard-redirect on every 403 — pages handle permission errors.
    // Route guards (RequirePermission) already protect unauthorized screens.

    if (
      status === 401 &&
      original &&
      !original._retry &&
      !original.url?.includes('/api/auth/login') &&
      !original.url?.includes('/api/auth/refresh')
    ) {
      original._retry = true
      try {
        refreshPromise = refreshPromise || refreshAccessToken()
        const access = await refreshPromise
        refreshPromise = null
        original.headers.Authorization = `Bearer ${access}`
        return api(original)
      } catch (refreshError) {
        refreshPromise = null
        clearTokens()
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.assign('/login')
        }
        return Promise.reject(refreshError)
      }
    }
    return Promise.reject(error)
  },
)

function apiErrorMessage(err, fallback) {
  const detail = err?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map((d) => d.msg).join(', ')
  return err?.message || fallback
}

export const authApi = {
  login: (email, password) =>
    api.post('/api/auth/login', { email, password }).then((r) => r.data),
  logout: (refresh_token) =>
    api.post('/api/auth/logout', { refresh_token }).then((r) => r.data),
  me: () => api.get('/api/auth/me').then((r) => r.data),
  refresh: (refresh_token) =>
    api.post('/api/auth/refresh', { refresh_token }).then((r) => r.data),
  forgotPassword: (email) =>
    api.post('/api/auth/forgot-password', { email }).then((r) => r.data),
  resetPassword: (token, new_password) =>
    api.post('/api/auth/reset-password', { token, new_password }).then((r) => r.data),
  errorMessage: apiErrorMessage,
}

export const leaveApi = {
  types: () => api.get('/api/leaves/types').then((r) => r.data),
  list: (opts = {}) => {
    const params = {}
    if (opts.employeeId) params.employee_id = opts.employeeId
    if (opts.status) params.status = opts.status
    if (opts.q) params.q = opts.q
    if (opts.page) params.page = opts.page
    if (opts.pageSize) params.page_size = opts.pageSize
    return api.get('/api/leaves', { params }).then((r) => r.data)
  },
  get: (id) => api.get(`/api/leaves/${id}`).then((r) => r.data),
  create: (payload) => api.post('/api/leaves', payload).then((r) => r.data),
  cancel: (id) => api.post(`/api/leaves/${id}/cancel`).then((r) => r.data),
  balances: (employeeId) => {
    const params = employeeId ? { employee_id: employeeId } : {}
    return api.get('/api/leaves/balances', { params }).then((r) => r.data)
  },
}

export const approvalApi = {
  pending: () => api.get('/api/approvals/pending').then((r) => r.data),
  processed: (opts = {}) => {
    const params = {}
    if (opts.page) params.page = opts.page
    if (opts.pageSize) params.page_size = opts.pageSize
    return api.get('/api/approvals/processed', { params }).then((r) => r.data)
  },
  approve: (id, comment) =>
    api.post(`/api/approvals/${id}/approve`, { comment }).then((r) => r.data),
  reject: (id, comment) =>
    api.post(`/api/approvals/${id}/reject`, { comment }).then((r) => r.data),
}

export const employeeApi = {
  departments: () => api.get('/api/employees/departments').then((r) => r.data),
  list: (opts = {}) => {
    const params = {}
    if (opts.managerId) params.manager_id = opts.managerId
    if (opts.departmentId) params.department_id = opts.departmentId
    if (opts.isActive !== undefined && opts.isActive !== null) params.is_active = opts.isActive
    if (opts.q) params.q = opts.q
    if (opts.page) params.page = opts.page
    if (opts.pageSize) params.page_size = opts.pageSize
    if (opts.scope) params.scope = opts.scope
    return api.get('/api/employees', { params }).then((r) => r.data)
  },
  get: (id) => api.get(`/api/employees/${id}`).then((r) => r.data),
  create: (payload) => api.post('/api/employees', payload).then((r) => r.data),
  update: (id, payload) => api.patch(`/api/employees/${id}`, payload).then((r) => r.data),
  deactivate: (id) => api.delete(`/api/employees/${id}`).then((r) => r.data),
}

export const healthApi = {
  check: () => api.get('/health').then((r) => r.data),
}

export default api
