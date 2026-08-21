import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        app: fileURLToPath(new URL('./index.html', import.meta.url)),
        widget: fileURLToPath(new URL('./src/widget/loader.ts', import.meta.url)),
        'business-widget': fileURLToPath(new URL('./src/widget/business-loader.ts', import.meta.url)),
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === 'widget') return 'widget/v1.js';
          if (chunk.name === 'business-widget') return 'widget/business-v1.js';
          return 'assets/[name]-[hash].js';
        },
      },
    },
  },
  plugins: [react(), widgetDevelopmentEntry()],
  server: {
    allowedHosts: ['.localdev.me', '.nip.io'],
  },
});

function widgetDevelopmentEntry(): Plugin {
  return {
    name: 'bigmelo-widget-development-entry',
    configureServer(server) {
      server.middlewares.use('/widget/v1.js', async (_request, response, next) => {
        try {
          const result = await server.transformRequest('/src/widget/loader.ts');

          if (!result) {
            next();
            return;
          }

          response.setHeader('Cache-Control', 'no-store');
          response.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          response.end(result.code);
        } catch (error) {
          next(error as Error);
        }
      });
      server.middlewares.use('/widget/business-v1.js', async (_request, response, next) => {
        try {
          const result = await server.transformRequest('/src/widget/business-loader.ts');
          if (!result) {
            next();
            return;
          }
          response.setHeader('Cache-Control', 'no-store');
          response.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          response.end(result.code);
        } catch (error) {
          next(error as Error);
        }
      });
    },
  };
}
