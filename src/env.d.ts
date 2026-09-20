/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_MEDIA_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
