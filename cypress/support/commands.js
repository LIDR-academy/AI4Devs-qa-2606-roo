// ***********************************************
// Custom commands para las pruebas E2E.
// Docs: https://on.cypress.io/custom-commands
// ***********************************************

/**
 * Carga el tablero kanban de una posición con las tres respuestas de red
 * interceptadas por fixtures, dejando los tests deterministas (no dependen del
 * estado real de la base de datos).
 *
 * Intercepta:
 *  - GET  **\/positions/*\/interviewFlow  → fixture interviewFlow.json  (alias @interviewFlow)
 *  - GET  **\/positions/*\/candidates     → fixture candidates.json     (alias @candidates)
 *  - PUT  **\/candidates/*                → 200 { message: 'ok' }        (alias @updateCandidate)
 *
 * OJO: el endpoint de actualización es /candidates/:id en PLURAL. El enunciado del
 * ejercicio dice /candidate/:id (singular) y es incorrecto respecto al código real
 * (frontend/src/components/PositionDetails.js:61 y backend/src/index.ts).
 *
 * Tras visitar la ruta espera a @interviewFlow y @candidates, de modo que al devolver
 * el control el tablero ya está pintado con los datos del fixture.
 *
 * @param {number|string} positionId - id de la posición a abrir (/positions/{id}).
 */
Cypress.Commands.add('visitPositionBoard', (positionId) => {
  cy.intercept('GET', '**/positions/*/interviewFlow', {
    fixture: 'interviewFlow.json',
  }).as('interviewFlow');

  // delay para que interviewFlow gane SIEMPRE la carrera. El componente lanza ambos
  // fetch en paralelo y fetchCandidates hace setStages(prevStages => prevStages.map()):
  // si candidates resolviera antes que interviewFlow, prevStages sería [] y los
  // candidatos se perderían. Es una condición de carrera real de la app; se estabiliza
  // desde el test sin tocar código de producción.
  cy.intercept('GET', '**/positions/*/candidates', {
    fixture: 'candidates.json',
    delay: 150,
  }).as('candidates');

  cy.intercept('PUT', '**/candidates/*', {
    statusCode: 200,
    body: { message: 'ok' },
  }).as('updateCandidate');

  cy.visit(`/positions/${positionId}`);

  cy.wait('@interviewFlow');
  cy.wait('@candidates');
});

/**
 * Mueve una tarjeta de candidato entre columnas usando el SENSOR DE TECLADO de
 * react-beautiful-dnd.
 *
 * Por qué teclado y no ratón: react-beautiful-dnd NO implementa la API HTML5 de
 * drag & drop, así que cy.trigger('dragstart'), los plugins genéricos de drag o un
 * mousedown+mouseup simple no hacen nada. La librería sí soporta arrastre por teclado
 * de forma nativa y determinista: enfocar el asa, espacio para levantar, flecha para
 * cambiar de columna, espacio para soltar.
 *
 * Detalles que importan:
 *  - Se pasa keyCode (no key): react-beautiful-dnd v13 lee event.keyCode.
 *  - Las columnas son listas verticales colocadas en horizontal (<Col> dentro de
 *    <Row>), así que cambiar de columna es flecha derecha (39) / izquierda (37).
 *  - Se espera entre eventos para que las transiciones/anuncios de la librería
 *    terminen antes del siguiente paso.
 *  - Se usa { force: true } en los eventos posteriores al lift porque durante el
 *    arrastre el elemento puede quedar cubierto por overlays de la propia librería.
 *
 * @param {number|string} draggableId - valor de data-rbd-drag-handle-draggable-id
 *   (es el candidateId en string).
 * @param {'right'|'left'} direction - 'right' mueve a la columna de la derecha (39),
 *   'left' a la de la izquierda (37).
 */
Cypress.Commands.add('moveCandidateByKeyboard', (draggableId, direction) => {
  const arrowKeyCode = direction === 'left' ? 37 : 39;
  const handle = `[data-rbd-drag-handle-draggable-id="${draggableId}"]`;

  // Levantar la tarjeta (espacio) con el asa enfocada.
  cy.get(handle).focus().trigger('keydown', { keyCode: 32 });
  cy.wait(200);

  // Mover a la columna contigua (flecha derecha/izquierda).
  cy.get(handle).trigger('keydown', { keyCode: arrowKeyCode, force: true });
  cy.wait(200);

  // Soltar la tarjeta (espacio).
  cy.get(handle).trigger('keydown', { keyCode: 32, force: true });
});
