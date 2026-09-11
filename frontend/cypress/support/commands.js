/**
 * Comandos reutilizables para las pruebas E2E de la interfaz "position".
 */

/**
 * Devuelve la columna (Droppable) cuyo encabezado coincide con el titulo de la fase.
 */
Cypress.Commands.add('stageColumn', (stageTitle) =>
  cy
    .contains('.card-header', stageTitle)
    .closest('[data-rbd-droppable-id]')
);

/**
 * Arrastra una tarjeta de candidato a la columna contigua usando el sensor de
 * teclado nativo de react-beautiful-dnd (Space = levantar/soltar, flechas = mover).
 *
 * Se prefiere el sensor de teclado sobre la simulacion de mouse porque no depende
 * de coordenadas ni de la animacion de arrastre, lo que elimina flakiness.
 */
Cypress.Commands.add('dragCandidate', (draggableId, { direction = 'right', steps = 1 } = {}) => {
  const SPACE = 32;
  const ARROW = direction === 'left' ? 37 : 39;
  const handle = () => cy.get(`[data-rbd-drag-handle-draggable-id="${draggableId}"]`);

  handle().focus().trigger('keydown', { keyCode: SPACE, which: SPACE, force: true });

  for (let i = 0; i < steps; i += 1) {
    handle().trigger('keydown', { keyCode: ARROW, which: ARROW, force: true });
  }

  handle().trigger('keydown', { keyCode: SPACE, which: SPACE, force: true });
});
