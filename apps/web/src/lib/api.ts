/** API base URL for split deploy (static frontend + remote API). Empty = same origin on Vercel. */
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

function createTimeoutError(timeoutMs: number): DOMException {
  return new DOMException(`Request timed out after ${timeoutMs}ms`, "TimeoutError");
}

function abortWithReason(controller: AbortController, reason: unknown): void {
  if (controller.signal.aborted) return;
  try {
    controller.abort(reason);
  } catch {
    controller.abort();
  }
}

function combineSignals(signals: AbortSignal[]): AbortSignal {
  const activeSignals = signals.filter(Boolean);
  const abortedSignal = activeSignals.find((signal) => signal.aborted);
  if (abortedSignal) {
    const controller = new AbortController();
    abortWithReason(controller, abortedSignal.reason);
    return controller.signal;
  }

  const controller = new AbortController();
  const onAbort = (event: Event) => {
    const signal = event.target as AbortSignal;
    abortWithReason(controller, signal.reason);
    for (const activeSignal of activeSignals) {
      activeSignal.removeEventListener("abort", onAbort);
    }
  };

  for (const signal of activeSignals) {
    signal.addEventListener("abort", onAbort, { once: true });
  }

  return controller.signal;
}

export async function apiFetchWithTimeout(
  path: string,
  options?: RequestInit,
  timeoutMs = 25000
): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => {
    abortWithReason(controller, createTimeoutError(timeoutMs));
  }, timeoutMs);
  const signal = options?.signal ? combineSignals([options.signal, controller.signal]) : controller.signal;

  try {
    return await apiFetch(path, {
      ...options,
      signal
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

/** Safely parse a fetch Response — never throws on HTML error pages or invalid JSON. */
export async function parseResponseJson<T = Record<string, unknown>>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text.trim()) return {} as T;
  if (!response.headers.get("content-type")?.includes("application/json")) {
    return {} as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

export async function apiJson<T = unknown>(path: string, options?: RequestInit): Promise<T> {
  const response = await apiFetch(path, {
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
    ...options
  });
  const data = await parseResponseJson<T>(response);
  if (!response.ok) {
    const message =
      typeof data === "object" && data !== null && "error" in data
        ? String((data as { error?: string }).error)
        : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return data;
}

export async function apiJsonWithTimeout<T = unknown>(
  path: string,
  options?: RequestInit,
  timeoutMs = 15000
): Promise<T> {
  const response = await apiFetchWithTimeout(path, {
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
    ...options
  }, timeoutMs);
  const data = await parseResponseJson<T>(response);
  if (!response.ok) {
    const message =
      typeof data === "object" && data !== null && "error" in data
        ? String((data as { error?: string }).error)
        : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return data;
}
