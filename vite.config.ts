import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import dyadComponentTagger from '@dyad-sh/react-vite-component-tagger';
import { visualizer } from 'rollup-plugin-visualizer'; // Importar o visualizer

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        dyadComponentTagger(), 
        react(),
        visualizer({
          filename: './dist/bundle-analyzer.html', // Caminho onde o relatório será gerado
          open: false, // Não abrir automaticamente no navegador
          gzipSize: true, // Mostrar tamanho gzip
          brotliSize: true, // Mostrar tamanho brotli
        })
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});