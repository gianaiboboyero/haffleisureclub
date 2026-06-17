/** API base URL for split deploy (Cloudflare Pages frontend + remote API). Empty = same origin. */
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

export function apiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${normalized}` : normalized;
}

export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), {
    credentials: "include",
    ...options
  });
}

export async function apiJson<T = unknown>(path: string, options?: RequestInit): Promise<T> {
  const response = await apiFetch(path, {
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
    ...options
  });
  const text = await response.text();
  const data =
    text && response.headers.get("content-type")?.includes("application/json")
      ? (JSON.parse(text) as T)
      : ({} as T);
  if (!response.ok) {
    const message =
      typeof data === "object" && data !== null && "error" in data
        ? String((data as { error?: string }).error)
        : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return data;
}
