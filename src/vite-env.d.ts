/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_DATA_SOURCE?: "mock" | "base44" | "supabase";
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
