/// <reference types="cypress" />

// Códigos de tecla usados por el sensor de teclado de react-beautiful-dnd.
const SPACE = 32;
const ARROW_LEFT = 37;
const ARROW_RIGHT = 39;

/**
 * Arrastra una tarjeta de react-beautiful-dnd usando el sensor de TECLADO,
 * que es la vía fiable en Cypress (el sensor de mouse depende de timings de
 * animación difíciles de reproducir).
 *
 * Secuencia: focus + Space (levantar) -> Arrow N veces (mover) -> Space (soltar).
 *
 * Sincronización: el levantar y el soltar se esperan POR ESTADO del DOM (aparición
 * y desaparición del placeholder de rbd), no por tiempo. El único `cy.wait` fijo es
 * el tick entre movimientos de flecha: rbd procesa cada paso en un requestAnimationFrame
 * y no expone una señal de "paso aplicado" fiable; es una excepción acotada y
 * justificada, no sincronización de red.
 *
 * @param {string} draggableId  valor de data-rbd-drag-handle-draggable-id (id del candidato)
 * @param {'left'|'right'} direction  hacia dónde mover entre columnas
 * @param {number} steps  cuántas columnas mover (por defecto 1)
 */
Cypress.Commands.add('dragCandidate', (draggableId, direction = 'right', steps = 1) => {
  const arrow = direction === 'left' ? ARROW_LEFT : ARROW_RIGHT;
  const handle = () => cy.get(`[data-rbd-drag-handle-draggable-id="${draggableId}"]`);

  // Levantar la tarjeta y esperar por estado a que rbd entre en modo "dragging".
  handle().focus().trigger('keydown', { keyCode: SPACE, which: SPACE, force: true });
  cy.get('[data-rbd-placeholder-context-id]').should('exist');

  // Mover columna por columna (tick de rAF entre pasos; ver nota arriba).
  for (let i = 0; i < steps; i += 1) {
    handle().trigger('keydown', { keyCode: arrow, which: arrow, force: true });
    cy.wait(150);
  }

  // Soltar y esperar por estado a que termine el arrastre.
  handle().trigger('keydown', { keyCode: SPACE, which: SPACE, force: true });
  cy.get('[data-rbd-placeholder-context-id]').should('not.exist');
});

/**
 * Devuelve la columna cuyo encabezado coincide con el título de la fase.
 * Selecciona por data-testid (estable) en vez de por clases internas de Bootstrap.
 * @param {string} title  título de la fase (p.ej. "Technical Interview")
 */
Cypress.Commands.add('stageColumn', (title) => {
  return cy
    .contains('[data-testid="stage-header"]', title)
    .closest('[data-testid="stage-column"]');
});
