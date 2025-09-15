import path from 'path';
// FIX: Corrected import for `process.cwd()`. The `cwd` function is a method on the `process` object, not a named export. Changed to import `process` and call `process.cwd()`.
import process from 'node:process';
import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';

// FIX: Defined `__dirname` for ES module scope. `__dirname` is not available by default in ES modules, so it is derived from `import.meta.url`.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  // Carga las variables de entorno del directorio raíz
  const env = loadEnv(mode, process.cwd(), '');
  return {
    define: {
      // Expone la variable de entorno API_KEY al código del lado del cliente
      // para que la aplicación pueda usarla.
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
