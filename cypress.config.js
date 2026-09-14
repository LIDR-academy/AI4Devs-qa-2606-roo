const { defineConfig } = require("cypress");

module.exports = defineConfig({
  e2e: {
    baseUrl: "http://localhost:3000",
    // Cypress 16 eliminó Cypress.env(); para valores públicos la doc recomienda expose + Cypress.expose().
    expose: { apiUrl: "http://localhost:3010" },
    setupNodeEvents(on) {
      on("task", {
        log(message) {
          console.log(message);
          return null;
        },
      });
    },
  },
});
