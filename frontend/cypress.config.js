const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    // El enunciado del ejercicio pide los specs en /cypress/integration,
    // por lo que sobreescribimos el specPattern por defecto (cypress/e2e).
    specPattern: 'cypress/integration/**/*.spec.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/e2e.js',
    fixturesFolder: 'cypress/fixtures',
    video: false,
    viewportWidth: 1400,
    viewportHeight: 900,
    defaultCommandTimeout: 8000,
    retries: {
      runMode: 2,
      openMode: 0,
    },
    setupNodeEvents(on, config) {
      return config;
    },
  },
});
