const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
let csrfToken = '';

export function setCsrfToken(value: string) {
  csrfToken = value;
}

export function clearCsrfToken() {
  csrfToken = '';
}

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number, public details?: unknown) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers);
  if (init.body) headers.set('content-type', 'application/json');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken) {
    headers.set('x-csrf-token', csrfToken);
  }
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && path !== '/auth/login') window.dispatchEvent(new Event('session-expired'));
  if (!response.ok) {
    throw new ApiError(data?.error?.code ?? 'HTTP_ERROR', data?.error?.message ?? 'خطا در ارتباط با سامانه.', response.status, data?.error?.details);
  }
  if (!['GET','HEAD','OPTIONS'].includes(method)&&!path.endsWith('/preview')&&!path.startsWith('/auth/')) window.dispatchEvent(new CustomEvent('family-data-changed',{detail:{path}}));
  return data as T;
}

export async function apiFile(path:string,body:unknown):Promise<Blob>{
 const response=await fetch(`${API_BASE}${path}`,{method:'POST',credentials:'include',headers:{'content-type':'application/json','x-csrf-token':csrfToken},body:JSON.stringify(body)});
 if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data?.error?.message??'خروجی ساخته نشد.');}return response.blob();
}
