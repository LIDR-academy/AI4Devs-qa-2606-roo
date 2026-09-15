// These specs run against the real local environment (frontend :3000,
// backend :3010, Postgres via docker-compose) and rely on the known,
// deterministic data produced by `backend/prisma/seed.ts` after a FRESH
// `npx prisma migrate reset --force` (run manually, outside these tests -
// see prompts/prompts-iniciales.md). With a fresh reset, autoincrement ids
// start at 1 per table, so for position 1 ("Senior Full-Stack Engineer"):
//   - Initial Screening (interviewStep id 1): Carlos García (candidateId 3,
//     applicationId 4)
//   - Technical Interview (interviewStep id 2): John Doe, Jane Smith
//   - Manager Interview (interviewStep id 3): no candidates
const POSITION_ID = 1;
const POSITION_TITLE = 'Senior Full-Stack Engineer';

describe('Position detail page - load', () => {
  it('shows the position title, every hiring phase column and candidates in their current phase', () => {
    cy.visit(`/positions/${POSITION_ID}`);

    cy.contains('h2', POSITION_TITLE).should('be.visible');

    cy.get('[data-cy="stage-column"]').should('have.length', 3);
    cy.get('[data-cy-stage="Initial Screening"]').should('exist');
    cy.get('[data-cy-stage="Technical Interview"]').should('exist');
    cy.get('[data-cy-stage="Manager Interview"]').should('exist');

    cy.get('[data-cy-stage="Initial Screening"]')
      .find('[data-cy="candidate-card"]')
      .should('have.length', 1)
      .and('contain.text', 'Carlos García');

    cy.get('[data-cy-stage="Technical Interview"]')
      .find('[data-cy="candidate-card"]')
      .should('have.length', 2)
      .and('contain.text', 'John Doe')
      .and('contain.text', 'Jane Smith');

    cy.get('[data-cy-stage="Manager Interview"]')
      .find('[data-cy="candidate-card"]')
      .should('have.length', 0);
  });
});

describe('Position detail page - change candidate phase', () => {
  it('moves a candidate card to a new column via drag & drop and persists it with a real PUT request', () => {
    cy.intercept('PUT', '**/candidates/*', (req) => {
      req.continue();
    }).as('updateCandidate');

    cy.visit(`/positions/${POSITION_ID}`);

    cy.get('[data-cy-stage="Initial Screening"]')
      .find('[data-cy="candidate-card"]')
      .should('contain.text', 'Carlos García');

    cy.dragAndDrop(
      '[data-cy-stage="Initial Screening"] [data-cy="candidate-card"]',
      '[data-cy-stage="Technical Interview"]'
    );

    cy.wait('@updateCandidate').then((interception) => {
      expect(interception.request.url).to.match(/\/candidates\/3$/);
      expect(interception.request.body).to.deep.equal({
        applicationId: 4,
        currentInterviewStep: 2,
      });
      expect(interception.response.statusCode).to.eq(200);
    });

    cy.get('[data-cy-stage="Technical Interview"]')
      .find('[data-cy="candidate-card"]')
      .should('contain.text', 'Carlos García');
  });
});
