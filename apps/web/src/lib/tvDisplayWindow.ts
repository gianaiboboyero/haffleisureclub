const TV_WINDOW_NAME = "haff-club-tv-display";

let managedTvWindow: Window | null = null;

export function shouldManageTvDisplayWindow(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(min-width: 1024px)").matches;
}

export function openTvDisplayWindow(): Window | null {
  if (typeof window === "undefined") return null;
  const url = `${window.location.origin}/tv`;

  if (managedTvWindow && !managedTvWindow.closed) {
    try {
      managedTvWindow.focus();
      if (!managedTvWindow.location.pathname.endsWith("/tv")) {
        managedTvWindow.location.href = url;
      }
    } catch {
      managedTvWindow = null;
    }
    if (managedTvWindow) return managedTvWindow;
  }

  const opened = window.open(url, TV_WINDOW_NAME);
  if (opened) {
    managedTvWindow = opened;
    try {
      sessionStorage.setItem("haff-tv-display-managed", "1");
    } catch {
      // ignore
    }
  }
  return opened;
}

export function notifyTvDisplayRefresh() {
  if (!managedTvWindow || managedTvWindow.closed) {
    managedTvWindow = null;
    return;
  }
  try {
    managedTvWindow.postMessage({ type: "haff-tv-refresh" }, window.location.origin);
  } catch {
    managedTvWindow = null;
  }
}

export function closeManagedTvDisplayWindow() {
  if (managedTvWindow && !managedTvWindow.closed) {
    try {
      managedTvWindow.close();
    } catch {
      // ignore
    }
  }
  managedTvWindow = null;
  try {
    sessionStorage.removeItem("haff-tv-display-managed");
  } catch {
    // ignore
  }
}
