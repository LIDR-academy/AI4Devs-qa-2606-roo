// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })

// react-beautiful-dnd v13 lee event.keyCode en su sensor de teclado, no event.key.
const KEY_CODES = { space: 32, left: 37, right: 39 };

Cypress.Commands.add('getCandidateCard', (candidateId) =>
  cy.get(`[data-testid="candidate-card-${candidateId}"]`)
);

Cypress.Commands.add('liftCardByKeyboard', (candidateId) =>
  cy
    .getCandidateCard(candidateId)
    .focus()
    .should('have.focus')
    .trigger('keydown', { keyCode: KEY_CODES.space, key: ' ', code: 'Space' })
);

Cypress.Commands.add('moveCardByKeyboard', (candidateId, direction, steps = 1) => {
  if (direction !== 'left' && direction !== 'right') {
    throw new Error(`moveCardByKeyboard: direction inválida "${direction}"`);
  }
  const keyCode = KEY_CODES[direction];

  cy.liftCardByKeyboard(candidateId);
  // Mientras está levantada, la librería aplica pointer-events: none a la tarjeta;
  // force evita el chequeo de actionability de Cypress (el listener está en window).
  for (let i = 0; i < steps; i++) {
    cy.getCandidateCard(candidateId).trigger('keydown', { keyCode, force: true });
  }
  cy.getCandidateCard(candidateId).trigger('keydown', {
    keyCode: KEY_CODES.space,
    key: ' ',
    code: 'Space',
    force: true,
  });
});

// ---------------------------------------------------------------------------
// Orden forzado /interviewFlow -> /candidates en PositionDetails.js
//
// El front lanza ambos GET en paralelo; si /candidates resuelve primero, las tarjetas se
// pierden. Cada navegación (visit o reload) arma una compuerta NUEVA: /candidates queda
// retenido hasta que la respuesta de /interviewFlow de ESA carga se entregó al navegador.
// ---------------------------------------------------------------------------
const FLOW_URL = /\/positions\/\d+\/interviewflow$/i;
const CANDIDATES_URL = /\/positions\/\d+\/candidates$/;
// Si after:response nunca se dispara, se libera igual y queda registrado como 'timeout',
// para que el test falle por aserción en vez de colgarse.
const GATE_TIMEOUT_MS = 10000;

let currentGate = null;
let gateCount = 0;
let lastFlowEtag = null;

function armFlowGate({ flowDelayMs = 0, forceConditional = false } = {}) {
  let release;
  const released = new Promise((resolve) => (release = resolve));
  gateCount += 1;
  currentGate = {
    id: gateCount,
    flowDelayMs,
    forceConditional,
    release,
    released,
    injectedEtag: null,
    flowIfNoneMatch: null,
    flowStatus: null,
    flowEtag: null,
    flowDeliveredAt: null,
    candidatesArrivedAt: null,
    candidatesReleasedAt: null,
    releasedBy: null,
  };
  return currentGate;
}

Cypress.Commands.add('interceptPositionRequests', () => {
  currentGate = null;
  gateCount = 0;
  lastFlowEtag = null;

  cy.intercept({ method: 'GET', url: FLOW_URL }, (req) => {
    const gate = currentGate;
    if (!gate) return;

    if (gate.forceConditional) {
      // Sin ETag real de la respuesta anterior no hay 304 que probar: fallar, no degradar.
      if (!lastFlowEtag) {
        throw new Error('forceConditional: la respuesta anterior de /interviewFlow no trajo header ETag');
      }
      gate.injectedEtag = lastFlowEtag;
      req.headers['if-none-match'] = lastFlowEtag;
    }
    gate.flowIfNoneMatch = req.headers['if-none-match'] || null;

    req.on('response', (res) => {
      gate.flowStatus = res.statusCode;
      gate.flowEtag = res.headers.etag || null;
      // Siempre el de la respuesta INMEDIATAMENTE anterior (null si no vino), nunca uno viejo.
      lastFlowEtag = gate.flowEtag;
      if (gate.flowDelayMs) res.setDelay(gate.flowDelayMs);
    });
    req.on('after:response', () => {
      gate.flowDeliveredAt = Date.now();
      gate.release('flow');
    });
  }).as('interviewFlow');

  cy.intercept({ method: 'GET', url: CANDIDATES_URL }, (req) => {
    const gate = currentGate;
    if (!gate) return;

    gate.candidatesArrivedAt = Date.now();
    const timeout = new Promise((resolve) => setTimeout(() => resolve('timeout'), GATE_TIMEOUT_MS));
    return Promise.race([gate.released, timeout]).then((releasedBy) => {
      gate.releasedBy = releasedBy;
      gate.candidatesReleasedAt = Date.now();
      req.continue();
    });
  }).as('candidates');

  cy.intercept('PUT', '**/candidates/*').as('updateStep');
});

const waitPositionLoad = (gate) =>
  cy.wait('@interviewFlow').then((flow) =>
    cy.wait('@candidates').then((candidates) => ({ gate, flow, candidates }))
  );

// Requiere cy.interceptPositionRequests() antes. Yields { gate, flow, candidates }.
Cypress.Commands.add('visitPosition', (positionId, gateOptions) => {
  const gate = armFlowGate(gateOptions);
  cy.visit(`/positions/${positionId}`);
  return waitPositionLoad(gate);
});

// Rearma la compuerta ANTES de recargar: la de la carga anterior ya está resuelta.
Cypress.Commands.add('reloadPosition', (gateOptions) => {
  const gate = armFlowGate(gateOptions);
  cy.reload();
  return waitPositionLoad(gate);
});

Cypress.Commands.add('logFlowGate', (gate, label) => {
  const heldMs = gate.candidatesReleasedAt - gate.candidatesArrivedAt;
  const msg =
    `[flow-gate #${gate.id} ${label}] interviewFlow status=${gate.flowStatus} ` +
    `If-None-Match=${gate.flowIfNoneMatch ? 'sí' : 'no'} delay=${gate.flowDelayMs}ms | ` +
    `candidates retenido ${heldMs}ms, liberado por=${gate.releasedBy}, ` +
    `llegó ${gate.flowDeliveredAt - gate.candidatesArrivedAt}ms antes de entregarse el flow`;
  cy.log(msg);
  cy.task('log', msg, { log: false });
});