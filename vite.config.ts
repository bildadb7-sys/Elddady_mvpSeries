import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';





export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.VITE_APP_SUPABASE_URL),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.VITE_APP_ANON_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks: {
              // Split large vendor libraries
              'supabase': ['@supabase/supabase-js'],
              'refined': ['@refinedev/core', '@refinedev/react-router', '@refinedev/supabase'],
              'react-vendor': ['react', 'react-dom'],
              'utils': ['bcryptjs', 'crypto', 'cors']
            }
          }
        },
        chunkSizeWarningLimit: 1000 // Increase warning limit to 1MB
      }
    };
});

