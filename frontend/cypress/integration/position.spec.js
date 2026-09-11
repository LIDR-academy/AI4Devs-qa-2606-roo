/// <reference types="cypress" />

/**
 * Pruebas E2E de la interfaz "position" (tablero kanban del proceso de contratacion).
 *
 * Estrategia: las respuestas de la API se controlan con cy.intercept + fixtures.
 * Esto da tests deterministas e independientes (no dependen de Docker, Postgres ni
 * del seed), y permite verificar el contrato HTTP exacto que el frontend envia al
 * backend cuando un candidato cambia de fase.
 */

const API = 'http://localhost:3010';
const POSITION_ID = 1;

const POSITION_NAME = 'Senior Full-Stack Engineer';
const STAGES = ['Initial Screening', 'Technical Interview', 'Manager Interview'];

// Distribucion esperada segun cypress/fixtures/candidates.json
const EXPECTED_BOARD = {
  'Initial Screening': ['John Doe', 'Ana Torres'],
  'Technical Interview': ['Jane Smith'],
  'Manager Interview': ['Carlos Ruiz'],
};

/**
 * Carga la pagina de la posicion con la API interceptada.
 *
 * El delay en /candidates no es un sleep arbitrario: PositionDetails lanza
 * fetchInterviewFlow() y fetchCandidates() en paralelo y fetchCandidates depende
 * del estado que produce el primero. El delay garantiza el orden de resolucion.
 * (Ver nota sobre esta condicion de carrera en prompts/prompts-iniciales.md.)
 */
const visitPosition = () => {
  cy.intercept('GET', `${API}/positions/${POSITION_ID}/interviewFlow`, {
    fixture: 'interviewFlow.json',
  }).as('getInterviewFlow');

  cy.intercept('GET', `${API}/positions/${POSITION_ID}/candidates`, {
    fixture: 'candidates.json',
    delay: 250,
  }).as('getCandidates');

  cy.visit(`/positions/${POSITION_ID}`);
  cy.wait('@getInterviewFlow');
  cy.wait('@getCandidates');
};

describe('Interfaz "position" - tablero de proceso de contratacion', () => {
  describe('1. Carga de la pagina de Position', () => {
    beforeEach(visitPosition);

    it('muestra correctamente el titulo de la posicion', () => {
      cy.get('h2').should('be.visible').and('have.text', POSITION_NAME);
    });

    it('muestra una columna por cada fase del proceso de contratacion', () => {
      cy.get('[data-rbd-droppable-id]').should('have.length', STAGES.length);

      cy.get('[data-rbd-droppable-id] .card-header').should(($headers) => {
        const titles = $headers.toArray().map((el) => el.textContent.trim());
        expect(titles).to.deep.equal(STAGES);
      });
    });

    it('coloca cada tarjeta de candidato en la columna de su fase actual', () => {
      Object.entries(EXPECTED_BOARD).forEach(([stage, candidates]) => {
        cy.stageColumn(stage).within(() => {
          cy.get('.card-title').should('have.length', candidates.length);
          candidates.forEach((name) => cy.contains('.card-title', name).should('be.visible'));
        });
      });
    });

    it('no muestra un candidato en una columna que no le corresponde', () => {
      cy.stageColumn('Technical Interview').should('not.contain', 'John Doe');
      cy.stageColumn('Manager Interview').should('not.contain', 'John Doe');
    });

    it('renderiza la valoracion de cada candidato', () => {
      cy.stageColumn('Manager Interview').within(() => {
        cy.contains('.card-title', 'Carlos Ruiz')
          .closest('.card-body')
          .find('[aria-label="rating"]')
          .should('have.length', 5);
      });
    });
  });

  describe('2. Cambio de fase de un candidato', () => {
    beforeEach(() => {
      cy.intercept('PUT', `${API}/candidates/*`, {
        statusCode: 200,
        body: {
          message: 'Candidate stage updated successfully',
          data: { id: 1, applicationId: 1, currentInterviewStep: 2 },
        },
      }).as('updateCandidateStage');

      visitPosition();
    });

    it('mueve la tarjeta a la nueva columna al arrastrarla', () => {
      // Precondicion
      cy.stageColumn('Initial Screening').should('contain', 'John Doe');
      cy.stageColumn('Technical Interview').should('not.contain', 'John Doe');

      // Arrastre: "John Doe" (draggableId = candidateId) a la columna contigua
      cy.dragCandidate('1', { direction: 'right' });

      // La tarjeta ya no esta en el origen y si en el destino
      cy.stageColumn('Technical Interview').should('contain', 'John Doe');
      cy.stageColumn('Initial Screening').should('not.contain', 'John Doe');
    });

    it('actualiza la fase en el backend con PUT /candidates/:id', () => {
      cy.dragCandidate('1', { direction: 'right' });

      cy.wait('@updateCandidateStage').then(({ request, response }) => {
        expect(request.method).to.equal('PUT');
        expect(request.url).to.match(/\/candidates\/1$/);
        expect(request.headers['content-type']).to.include('application/json');
        expect(request.body).to.deep.equal({
          applicationId: 1,
          currentInterviewStep: 2, // id de "Technical Interview"
        });
        expect(response.statusCode).to.equal(200);
      });
    });

    it('envia el id de fase correcto al saltar dos columnas', () => {
      cy.dragCandidate('1', { direction: 'right', steps: 2 });

      cy.stageColumn('Manager Interview').should('contain', 'John Doe');
      cy.wait('@updateCandidateStage')
        .its('request.body.currentInterviewStep')
        .should('equal', 3); // id de "Manager Interview"
    });

    it('permite devolver la tarjeta a su fase anterior', () => {
      cy.dragCandidate('1', { direction: 'right' });
      cy.wait('@updateCandidateStage');

      cy.dragCandidate('1', { direction: 'left' });

      cy.stageColumn('Initial Screening').should('contain', 'John Doe');
      cy.stageColumn('Technical Interview').should('not.contain', 'John Doe');
      cy.wait('@updateCandidateStage')
        .its('request.body.currentInterviewStep')
        .should('equal', 1); // id de "Initial Screening"
    });
  });
});
