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

describe('Pantalla de Position - cambio de fase de un candidato', () => {
  beforeEach(() => {
    cy.visitPositionBoard(1);
  });

  it('mueve un candidato de una columna a la siguiente y persiste el cambio', () => {
    // Estado inicial: el candidato 1 (Alice) está en la primera columna.
    cy.get('[data-rbd-droppable-id="0"]')
      .find('[data-rbd-draggable-id="1"]')
      .should('exist');

    // Mover la tarjeta a la columna de la derecha (Technical Interview).
    cy.moveCandidateByKeyboard('1', 'right');

    // La tarjeta YA NO está en la primera columna.
    cy.get('[data-rbd-droppable-id="0"]')
      .find('[data-rbd-draggable-id="1"]')
      .should('not.exist');

    // La tarjeta SÍ está ahora en la segunda columna.
    cy.get('[data-rbd-droppable-id="1"]')
      .find('[data-rbd-draggable-id="1"]')
      .should('exist');

    // El backend recibe el PUT correcto.
    cy.wait('@updateCandidate').then(({ request }) => {
      expect(request.method).to.equal('PUT');
      expect(request.url).to.match(/\/candidates\/1$/);
      // applicationId del candidato 1 en el fixture.
      expect(request.body.applicationId).to.equal(101);
      // id de la fase DESTINO (Technical Interview = 2), no el índice ni el nombre.
      expect(request.body.currentInterviewStep).to.equal(2);
    });
  });

  it('no deja rastro si se cancela el arrastre con Escape', () => {
    const handle = '[data-rbd-drag-handle-draggable-id="1"]';

    // Levantar, mover a la derecha y CANCELAR con Escape (27).
    cy.get(handle).focus().trigger('keydown', { keyCode: 32 });
    cy.wait(200);
    cy.get(handle).trigger('keydown', { keyCode: 39, force: true });
    cy.wait(200);
    cy.get(handle).trigger('keydown', { keyCode: 27, force: true });
    cy.wait(200);

    // La tarjeta sigue en la columna original.
    cy.get('[data-rbd-droppable-id="0"]')
      .find('[data-rbd-draggable-id="1"]')
      .should('exist');
    cy.get('[data-rbd-droppable-id="1"]')
      .find('[data-rbd-draggable-id="1"]')
      .should('not.exist');

    // No se ha llamado al endpoint de actualización.
    cy.get('@updateCandidate.all').should('have.length', 0);
  });
});
