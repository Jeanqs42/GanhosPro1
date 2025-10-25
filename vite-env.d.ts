/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY: string;
  readonly GEMINI_API_KEY: string; // Para compatibilidade, se ambos forem usados
  // Adicione outras variáveis de ambiente aqui, se houver
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}