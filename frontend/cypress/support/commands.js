// URL del API que consume el frontend (ver PositionDetails.js).
const API_URL = 'http://localhost:3010';

const KEY_SPACE = 32;
const KEY_ARROW_RIGHT = 39;
const KEY_ARROW_LEFT = 37;

/**
 * Registra los stubs de los tres endpoints que consume la pantalla de posición.
 * Al `interviewFlow` no se le añade retardo y a `candidates` sí, porque
 * PositionDetails.js lanza ambas peticiones en paralelo y la de candidatos
 * necesita que las columnas ya estén en el estado para poder repartirlas.
 */
Cypress.Commands.add('stubPositionApi', (positionId = 1) => {
  cy.intercept('GET', `${API_URL}/positions/${positionId}/interviewFlow`, {
    fixture: 'interviewFlow.json',
  }).as('getInterviewFlow');

  cy.intercept('GET', `${API_URL}/positions/${positionId}/candidates`, {
    fixture: 'candidates.json',
    delay: 300,
  }).as('getCandidates');

  cy.intercept('PUT', `${API_URL}/candidates/*`, {
    statusCode: 200,
    body: { message: 'Candidate stage updated successfully' },
  }).as('updateCandidateStage');
});

/**
 * Abre la pantalla de la posición y espera a que ambas cargas hayan terminado.
 */
Cypress.Commands.add('visitPosition', (positionId = 1) => {
  cy.visit(`/positions/${positionId}`);
  cy.wait('@getInterviewFlow');
  cy.wait('@getCandidates');
});

/**
 * Devuelve la columna (droppable) correspondiente a la fase indicada por índice.
 */
Cypress.Commands.add('stageColumn', (index) =>
  cy.get(`[data-rbd-droppable-id="${index}"]`)
);

/**
 * Arrastra una tarjeta de candidato usando el sensor de teclado de
 * react-beautiful-dnd: espacio para levantar, flechas para mover y espacio
 * para soltar. Es mucho más estable en Cypress que simular el ratón, que
 * exige superar el umbral de "sloppy click" con varios mousemove.
 *
 * @param {string} draggableId id del candidato (atributo data-rbd-drag-handle-draggable-id)
 * @param {number} steps número de columnas a desplazar (negativo = hacia la izquierda)
 */
Cypress.Commands.add('dragCandidate', (draggableId, steps = 1) => {
  const handle = () =>
    cy.get(`[data-rbd-drag-handle-draggable-id="${draggableId}"]`);
  const arrowKey = steps >= 0 ? KEY_ARROW_RIGHT : KEY_ARROW_LEFT;

  handle().focus().trigger('keydown', { keyCode: KEY_SPACE, force: true });
  cy.wait(250); // rbd necesita un frame para registrar el "lift"

  Cypress._.times(Math.abs(steps), () => {
    handle().trigger('keydown', { keyCode: arrowKey, force: true });
    cy.wait(250);
  });

  handle().trigger('keydown', { keyCode: KEY_SPACE, force: true });
  cy.wait(250); // animación de "drop"
});
