const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    specPattern: 'cypress/integration/**/*.spec.js',
    supportFile: 'cypress/support/e2e.js',
    fixturesFolder: 'cypress/fixtures',
    video: false,
    viewportWidth: 1280,
    viewportHeight: 800,
    // Reintentos solo en CI (headless); en modo interactivo, 0 para depurar.
    // Son un COLCHÓN de CI ante ruido de infraestructura, NO el mecanismo de
    // determinismo: el orden de la carga se garantiza en el beforeEach (delay) y el
    // drag se sincroniza por estado del placeholder de rbd, no por estos reintentos.
    retries: { runMode: 2, openMode: 0 },
  },
});
