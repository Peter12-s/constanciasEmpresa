import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Para GitHub Pages, base debe ser el path relativo, no la URL completa
export default defineConfig({
  base: '/constanciasEmpresa/',
  plugins: [react()],
});