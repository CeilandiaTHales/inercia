export const API_URL = '/api';

export const getAuthHeaders = () => {
  const token = localStorage.getItem('inercia_token');
  return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
};

export const api = {
  get: async (endpoint: string) => {
    const res = await fetch(`${API_URL}${endpoint}`, { headers: getAuthHeaders() });
    if (res.status === 401) {
       window.location.hash = '/login';
       throw new Error("Unauthorized");
    }
    return res.json();
  },
  post: async (endpoint: string, body: any) => {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(body)
    });
    if (res.status === 401) {
        window.location.hash = '/login';
        throw new Error("Unauthorized");
    }
    return res.json();
  }
};
