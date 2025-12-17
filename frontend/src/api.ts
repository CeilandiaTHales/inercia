export const API_URL = '/api';

export const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('inercia_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
};

// Helper to handle response errors
const handleResponse = async (res: Response) => {
    if (res.ok) {
        return res.json();
    }

    // Try to parse JSON error message
    let errorMessage = res.statusText;
    try {
        const json = await res.json();
        if (json.error) errorMessage = json.error;
    } catch (e) {
        // If parsing fails, stick to statusText or default
        console.warn("Non-JSON error response", res.status);
    }

    if (res.status === 401) {
       console.warn("Unauthorized access - redirecting to login");
       localStorage.removeItem('inercia_token');
       window.location.hash = '/login';
       throw new Error(errorMessage || "Unauthorized");
    }

    if (res.status === 403) {
        console.warn("Forbidden access - check user roles");
        throw new Error(errorMessage || "Access Denied: You do not have permission to perform this action.");
    }

    throw new Error(errorMessage || `Request failed with status ${res.status}`);
};

export const api = {
  get: async (endpoint: string) => {
    const res = await fetch(`${API_URL}${endpoint}`, { headers: getAuthHeaders() });
    return handleResponse(res);
  },
  post: async (endpoint: string, body: any) => {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(body)
    });
    return handleResponse(res);
  }
};