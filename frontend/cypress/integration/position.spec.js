/// <reference types="cypress" />

/**
 * Pruebas E2E de la interfaz "position" (kanban del proceso de contratación).
 *
 * Los tres endpoints del backend se sustituyen por stubs (cy.intercept) para que
 * las pruebas sean deterministas y no dependan de la base de datos:
 *   GET  /positions/:id/interviewFlow
 *   GET  /positions/:id/candidates
 *   PUT  /candidates/:id
 */

const POSITION_ID = 1;
const POSITION_NAME = 'Senior Backend Engineer';
const STAGES = ['Initial Screening', 'Technical Interview', 'Manager Interview'];

describe('Interfaz de Position - proceso de contratación', () => {
  beforeEach(() => {
    cy.stubPositionApi(POSITION_ID);
    cy.visitPosition(POSITION_ID);
  });

  describe('Carga de la página de Position', () => {
    it('muestra el título de la posición', () => {
      cy.get('h2').should('be.visible').and('have.text', POSITION_NAME);
    });

    it('muestra una columna por cada fase del proceso de contratación', () => {
      cy.get('.card-header').should('have.length', STAGES.length);

      STAGES.forEach((stage, index) => {
        cy.get('.card-header').eq(index).should('have.text', stage);
      });
    });

    it('muestra cada tarjeta de candidato en la columna de su fase actual', () => {
      // Fase 0: Initial Screening
      cy.stageColumn(0).within(() => {
        cy.contains('.card-title', 'John Doe').should('be.visible');
        cy.contains('.card-title', 'Ana Lopez').should('be.visible');
        cy.get('.card-title').should('have.length', 2);
      });

      // Fase 1: Technical Interview
      cy.stageColumn(1).within(() => {
        cy.contains('.card-title', 'Jane Smith').should('be.visible');
        cy.get('.card-title').should('have.length', 1);
      });

      // Fase 2: Manager Interview
      cy.stageColumn(2).within(() => {
        cy.contains('.card-title', 'Carlos Ruiz').should('be.visible');
        cy.get('.card-title').should('have.length', 1);
      });
    });

    it('pinta la valoración de cada candidato con tantos círculos como puntuación media', () => {
      cy.get('[data-rbd-draggable-id="1"]')
        .find('[aria-label="rating"]')
        .should('have.length', 3); // John Doe -> averageScore 3
    });
  });

  describe('Cambio de fase de un candidato', () => {
    it('mueve la tarjeta a la columna destino al arrastrarla', () => {
      // John Doe (id 1) empieza en "Initial Screening".
      cy.stageColumn(0).contains('.card-title', 'John Doe').should('exist');

      cy.dragCandidate('1', 1); // una columna a la derecha

      cy.stageColumn(1).contains('.card-title', 'John Doe').should('be.visible');
      cy.stageColumn(0).should('not.contain', 'John Doe');
      cy.stageColumn(0).find('.card-title').should('have.length', 1);
      cy.stageColumn(1).find('.card-title').should('have.length', 2);
    });

    it('actualiza la fase en el backend mediante PUT /candidates/:id', () => {
      cy.dragCandidate('1', 1);

      cy.wait('@updateCandidateStage').then(({ request }) => {
        expect(request.method).to.eq('PUT');
        expect(request.url).to.match(/\/candidates\/1$/);
        expect(request.body).to.deep.equal({
          applicationId: 11, // applicationId de John Doe
          currentInterviewStep: 2, // id de la fase "Technical Interview"
        });
      });
    });

    it('permite mover una tarjeta varias fases y envía la fase final', () => {
      cy.dragCandidate('1', 2); // Initial Screening -> Manager Interview

      cy.stageColumn(2).contains('.card-title', 'John Doe').should('be.visible');

      cy.wait('@updateCandidateStage')
        .its('request.body.currentInterviewStep')
        .should('eq', 3); // id de la fase "Manager Interview"
    });

    it('permite devolver una tarjeta a una fase anterior', () => {
      cy.dragCandidate('2', -1); // Jane Smith: Technical Interview -> Initial Screening

      cy.stageColumn(0).contains('.card-title', 'Jane Smith').should('be.visible');

      cy.wait('@updateCandidateStage').then(({ request }) => {
        expect(request.url).to.match(/\/candidates\/2$/);
        expect(request.body).to.deep.equal({
          applicationId: 12,
          currentInterviewStep: 1,
        });
      });
    });

    it('no llama al backend si la tarjeta se suelta fuera de una columna', () => {
      cy.get('[data-rbd-drag-handle-draggable-id="1"]')
        .focus()
        .trigger('keydown', { keyCode: 32, force: true }); // levantar
      cy.wait(250);
      cy.get('[data-rbd-drag-handle-draggable-id="1"]')
        .trigger('keydown', { keyCode: 27, force: true }); // ESC: cancelar
      cy.wait(250);

      cy.stageColumn(0).contains('.card-title', 'John Doe').should('be.visible');
      cy.get('@updateCandidateStage.all').should('have.length', 0);
    });
  });
});
