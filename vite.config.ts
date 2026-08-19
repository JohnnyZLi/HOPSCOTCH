import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    modulePreload: {
      resolveDependencies: (_filename, dependencies, context) => context.hostType === 'js'
        ? dependencies.filter((dependency) => !dependency.endsWith('.js'))
        : dependencies,
    },
  },
  server: {
    port: 5173,
  },
});
