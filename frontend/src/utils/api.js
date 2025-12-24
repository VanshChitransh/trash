// Normalize base URL to remove trailing slashes
const normalizeBaseUrl = (url) => {
  return url ? url.replace(/\/+$/, '') : url;
};

export const API_BASE_URL = normalizeBaseUrl(
  // Prefer explicit env; otherwise, if running locally, default to local backend
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5050'
    : 'https://seal-app-hbsmr.ondigitalocean.app')
);

// Get token from localStorage (if available)
// Export this so other components can use it consistently
export const getToken = () => {
  try {
    // Try to get token from auth response stored in localStorage
    const authData = localStorage.getItem('authToken');
    if (authData) {
      return authData;
    }
    // Fallback: check if we stored it elsewhere
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      return user.token;
    }
  } catch (e) {
    // Ignore errors
  }
  return null;
};

async function request(path, options = {}) {
  const { ignoreStatuses = [], timeout = 30000 } = options;
  // Ensure path starts with / and construct URL properly
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${API_BASE_URL}${normalizedPath}`;
  const defaultHeaders = { 'Content-Type': 'application/json' };
  
  // Add Authorization header if token is available (fallback if cookies don't work)
  const token = getToken();
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }
  
  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      credentials: 'include',
      headers: { ...defaultHeaders, ...(options.headers || {}) },
      method: options.method || 'GET',
      body: options.body,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : null;

    if (!response.ok) {
      if (ignoreStatuses.includes(response.status)) {
        return { ok: false, status: response.status, data };
      }
      const message = data?.message || `Request failed with ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      const timeoutError = new Error(`Request timeout after ${timeout}ms`);
      timeoutError.status = 408;
      throw timeoutError;
    }
    throw error;
  }
}

export const api = {
  post: (path, body, options = {}) => request(path, { method: 'POST', body: JSON.stringify(body), ...options }),
  get: (path, options = {}) => request(path, { method: 'GET', ...options }),
  put: (path, body, options = {}) => request(path, { method: 'PUT', body: JSON.stringify(body), ...options }),
  delete: (path, body, options = {}) => request(path, { method: 'DELETE', body: JSON.stringify(body), ...options }),
  // Upload file (multipart/form-data)
  upload: async (path, file, options = {}) => {
    const { ignoreStatuses = [], onUploadProgress } = options;
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = `${API_BASE_URL}${normalizedPath}`;
    const formData = new FormData();
    formData.append('file', file);
    
    // Add Authorization header if token is available
    const headers = { ...(options.headers || {}) };
    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(url, {
      credentials: 'include',
      method: 'POST',
      body: formData,
      headers, // Don't set Content-Type for FormData (browser will set it with boundary)
    });
    
    const contentType = response.headers.get('content-type') || '';
    let data = null;
    
    try {
      data = contentType.includes('application/json') ? await response.json() : await response.text();
      // If we got text, try to parse it as JSON
      if (typeof data === 'string' && data.trim().startsWith('{')) {
        data = JSON.parse(data);
      }
    } catch (parseError) {
      console.error('Failed to parse response:', parseError);
      data = { message: 'Failed to parse server response' };
    }

    if (!response.ok) {
      if (ignoreStatuses.includes(response.status)) {
        return { ok: false, status: response.status, data };
      }
      const message = data?.message || `Request failed with ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  },
};
