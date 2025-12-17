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
    let errorMessage = res.statusText;
    try {
        const json = await res.json();
        if (json.error) errorMessage = json.error;
    } catch (e) {}

    if (res.status === 401) {
       localStorage.removeItem('inercia_token');
       window.location.hash = '/login';
    }
    throw new Error(errorMessage);
};

export const copyToClipboard = async (text: string): Promise<void> => {
    if (!navigator.clipboard) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus(); textArea.select();
        try { document.execCommand('copy'); } finally { document.body.removeChild(textArea); }
        return;
    }
    return navigator.clipboard.writeText(text);
};

export const api = {
  get: async (endpoint: string) => {
    const res = await fetch(`${API_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`, { headers: getAuthHeaders() });
    return handleResponse(res);
  },
  post: async (endpoint: string, body: any) => {
    const res = await fetch(`${API_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(body)
    });
    return handleResponse(res);
  },
  put: async (endpoint: string, body: any) => {
    const res = await fetch(`${API_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(body)
    });
    return handleResponse(res);
  },
  delete: async (endpoint: string, body?: any) => {
    const res = await fetch(`${API_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      body: body ? JSON.stringify(body) : undefined
    });
    return handleResponse(res);
  }
};