const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    // El enunciado pide la ruta legacy /cypress/integration.
    // Cypress 10+ usa /cypress/e2e por defecto, pero specPattern permite
    // conservar la ruta solicitada sin renunciar a la version moderna.
    specPattern: 'cypress/integration/**/*.spec.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/e2e.js',
    fixturesFolder: 'cypress/fixtures',
    viewportWidth: 1400,
    viewportHeight: 900,
    video: false,
    retries: { runMode: 2, openMode: 0 },
  },
});
