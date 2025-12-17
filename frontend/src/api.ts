export const API_URL = '/api';

export const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('inercia_token');
  const projectId = localStorage.getItem('inercia_active_project');
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (projectId) headers['x-project-id'] = projectId;
  
  return headers;
};

const handleResponse = async (res: Response) => {
    if (res.ok) return res.json();
    
    let errorMessage = `Error ${res.status}: ${res.statusText}`;
    try {
        const json = await res.json();
        if (json.error) errorMessage = json.error;
        if (json.message) errorMessage = json.message;
    } catch (e) {
        // Fallback if response is not JSON
    }

    if (res.status === 401 || res.status === 403) {
       // Only clear session if explicitly unauthenticated
       if (res.status === 401 && !window.location.hash.includes('/login')) {
           localStorage.removeItem('inercia_token');
           window.location.href = '/#/login';
       }
    }
    
    throw new Error(errorMessage);
};

// Standard Fetch with Timeout
const fetchWithTimeout = async (url: string, options: any, timeout = 15000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (e: any) {
        clearTimeout(id);
        if (e.name === 'AbortError') throw new Error('Request timeout - server is taking too long');
        throw e;
    }
};

export const copyToClipboard = async (text: string): Promise<void> => {
    try {
        await navigator.clipboard.writeText(text);
    } catch (err) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
    }
};

export const api = {
  get: async (endpoint: string) => {
    const url = `${API_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const res = await fetchWithTimeout(url, { headers: getAuthHeaders() });
    return handleResponse(res);
  },
  post: async (endpoint: string, body: any) => {
    const url = `${API_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(body)
    });
    return handleResponse(res);
  },
  put: async (endpoint: string, body: any) => {
    const url = `${API_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const res = await fetchWithTimeout(url, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(body)
    });
    return handleResponse(res);
  },
  delete: async (endpoint: string, body?: any) => {
    const url = `${API_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const res = await fetchWithTimeout(url, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      body: body ? JSON.stringify(body) : undefined
    });
    return handleResponse(res);
  }
};
