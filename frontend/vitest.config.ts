import { defineConfig } from 'vitest/config';

// The builder's own options stay in angular.json; this file only adds what it cannot express.
export default defineConfig({
  test: {
    server: {
      deps: {
        // @material/material-color-utilities 0.4.0 imports '../dynamiccolor/dynamic_scheme' without
        // '.js', which Node's ESM loader rejects: Vite resolves it when the package is inlined.
        inline: ['@material/material-color-utilities'],
      },
    },
  },
});
