/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_REALTIME_CHAT?: string;
  readonly VITE_OPERATION_EVENT_SYNC?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
