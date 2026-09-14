const { defineConfig } = require('cypress');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const backendDir = path.join(__dirname, 'backend');
// multer guarda los CVs en '../uploads/' relativo al cwd del backend (backend/)
const uploadsDir = path.join(__dirname, 'uploads');
let uploadsDirCreatedByTests = false;
let prisma;

const getPrisma = () => {
  if (!prisma) {
    const { PrismaClient } = require(path.join(backendDir, 'node_modules', '@prisma/client'));
    prisma = new PrismaClient();
  }
  return prisma;
};

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    supportFile: 'cypress/support/e2e.js',
    specPattern: ['cypress/integration/**/*.spec.js', 'cypress/e2e/**/*.cy.js'],
    fixturesFolder: 'cypress/fixtures',
    viewportWidth: 1280,
    viewportHeight: 800,
    video: false,
    expose: {
      apiUrl: 'http://localhost:3010'
    },
    setupNodeEvents(on) {
      on('task', {
        'db:reset'() {
          execSync('npx prisma migrate reset --force --skip-generate --skip-seed', { cwd: backendDir, stdio: 'pipe' });
          execSync('npx ts-node --transpile-only prisma/seed.ts', { cwd: backendDir, stdio: 'pipe' });
          return null;
        },
        async 'db:updatePosition'({ id, data }) {
          await getPrisma().position.update({ where: { id }, data });
          return null;
        },
        'uploads:ensureDir'() {
          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir);
            uploadsDirCreatedByTests = true;
          }
          return null;
        },
        'uploads:cleanup'(marker) {
          if (!fs.existsSync(uploadsDir)) {
            return null;
          }
          fs.readdirSync(uploadsDir)
            .filter((file) => file.includes(marker))
            .forEach((file) => fs.unlinkSync(path.join(uploadsDir, file)));
          if (uploadsDirCreatedByTests && fs.readdirSync(uploadsDir).length === 0) {
            fs.rmdirSync(uploadsDir);
            uploadsDirCreatedByTests = false;
          }
          return null;
        }
      });
    }
  }
});
