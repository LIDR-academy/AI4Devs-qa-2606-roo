/// <reference types="cypress" />

// Nombres y orden de las fases, tal y como los define cypress/fixtures/interviewFlow.json.
const STAGES = ['Initial Screening', 'Technical Interview', 'Manager Interview'];

// Reparto esperado de candidatos por columna (índice de columna → nombres).
// Coincide con cypress/fixtures/candidates.json.
const CANDIDATES_BY_COLUMN = [
  ['Alice Johnson', 'Bob Martinez'], // columna 0: Initial Screening
  ['Carla Nguyen'], // columna 1: Technical Interview
  ['David Okafor'], // columna 2: Manager Interview
];

describe('Pantalla de Position - carga inicial', () => {
  beforeEach(() => {
    cy.visitPositionBoard(1);
  });

  it('muestra el título de la posición', () => {
    cy.get('h2').should('have.text', 'Senior Backend Engineer');
  });

  it('muestra una columna por cada fase del proceso', () => {
    cy.get('[data-rbd-droppable-id]').should('have.length', STAGES.length);

    STAGES.forEach((stageName, index) => {
      cy.get(`[data-rbd-droppable-id="${index}"]`)
        .find('.card-header')
        .should('have.text', stageName);
    });
  });

  it('coloca cada candidato en la columna de su fase actual', () => {
    CANDIDATES_BY_COLUMN.forEach((names, index) => {
      cy.get(`[data-rbd-droppable-id="${index}"]`).within(() => {
        // Recuento exacto de tarjetas en la columna: 2, 1 y 1.
        cy.get('.card-title').should('have.length', names.length);

        // Cada candidato aparece DENTRO de su columna, no solo en la página.
        names.forEach((name) => {
          cy.contains('.card-title', name).should('be.visible');
        });
      });
    });
  });
});
