// IMPORTANT: Use relative path. 
// The browser will resolve this against the current domain/port.
// This prevents the app from trying to go out to the internet and come back in.
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
    let errorCode = "";
    try {
        const json = await res.json();
        if (json.error) errorMessage = json.error;
        if (json.code) errorCode = json.code;
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
        // If it's an invalid token specifically, force logout.
        if (errorCode === 'AUTH_INVALID') {
             localStorage.removeItem('inercia_token');
             window.location.hash = '/login';
        }
        console.warn("Forbidden access - check user roles");
        throw new Error(errorMessage || "Access Denied: You do not have permission to perform this action.");
    }

    throw new Error(errorMessage || `Request failed with status ${res.status}`);
};

export const api = {
  get: async (endpoint: string) => {
    // Ensure endpoint starts with slash if not provided
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const res = await fetch(`${API_URL}${path}`, { headers: getAuthHeaders() });
    return handleResponse(res);
  },
  post: async (endpoint: string, body: any) => {
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(body)
    });
    return handleResponse(res);
  },
  put: async (endpoint: string, body: any) => {
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const res = await fetch(`${API_URL}${path}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(body)
    });
    return handleResponse(res);
  },
  delete: async (endpoint: string, body?: any) => {
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const options: RequestInit = {
      method: 'DELETE',
      headers: getAuthHeaders()
    };
    if (body) {
        options.body = JSON.stringify(body);
    }
    const res = await fetch(`${API_URL}${path}`, options);
    return handleResponse(res);
  }
};