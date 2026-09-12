const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    specPattern: 'cypress/e2e/**/*.{cy,spec}.{js,jsx,ts,tsx}',
    viewportWidth: 1280,
    viewportHeight: 800,
    video: false,
    defaultCommandTimeout: 8000,
    setupNodeEvents(on, config) {
      return config;
    },
  },
  env: {
    apiUrl: 'http://localhost:3010',
  },
});