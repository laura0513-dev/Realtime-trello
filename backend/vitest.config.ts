import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // globals: true  →  describe/it/expect/vi son globales, no hace falta importarlos
    globals: true,
    // environment: 'node'  →  entorno correcto para un backend Express (no browser)
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      // Excluimos el punto de entrada del servidor y los propios archivos de test
      exclude: ['src/**/*.test.ts', 'src/server.ts'],
    },
  },
});
