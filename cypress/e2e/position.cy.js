const API_URL = Cypress.expose('apiUrl');
if (!API_URL) {
  throw new Error('Falta expose.apiUrl en cypress.config.js');
}
const POSITION_TITLE = 'Senior Full-Stack Engineer';

const exactText = (text) => new RegExp(`^\\s*${Cypress._.escapeRegExp(text)}\\s*$`);
const cardSelector = (candidateId) => `[data-testid="candidate-card-${candidateId}"]`;
// Columna de fase = Card cuyo header tiene exactamente el nombre de la fase.
const column = (stepName) => cy.contains('.card-header', exactText(stepName)).parent();

describe('Position view', () => {
  let positionId;

  before(() => {
    cy.request(`${API_URL}/positions`).then(({ body }) => {
      const position = body.find((p) => p.title === POSITION_TITLE);
      expect(position, `posición "${POSITION_TITLE}" en el seed`).to.exist;
      positionId = position.id;
    });
  });

  beforeEach(() => {
    cy.interceptPositionRequests();
  });

  describe('Carga de página', () => {
    it('muestra el título, una columna por fase y cada tarjeta en la columna de su fase', () => {
      // Fuente de verdad directa del backend (sin caché del navegador ni intercepts).
      cy.request(`${API_URL}/positions/${positionId}/interviewFlow`).then(({ body: flowBody }) => {
        const { positionName } = flowBody.interviewFlow;
        const steps = flowBody.interviewFlow.interviewFlow.interviewSteps;

        cy.request(`${API_URL}/positions/${positionId}/candidates`).then(({ body: candidates }) => {
          expect(steps, 'fases del interviewFlow').to.not.be.empty;
          expect(candidates, 'candidatos de la posición').to.not.be.empty;

          cy.visitPosition(positionId);

          // Título
          cy.contains('h2', exactText(positionName)).should('be.visible');

          // Una columna por fase (el front no ordena por orderIndex: no se valida el orden)
          cy.get('.card-header').should('have.length', steps.length);
          steps.forEach((step) => column(step.name).should('be.visible'));

          // Cada tarjeta en la columna de su currentInterviewStep, y ninguna de más
          steps.forEach((step) => {
            const expected = candidates.filter((c) => c.currentInterviewStep === step.name);
            column(step.name)
              .find('[data-testid^="candidate-card-"]')
              .should('have.length', expected.length);
            expected.forEach((c) => {
              column(step.name)
                .find(cardSelector(c.candidateId))
                .should('be.visible')
                .and('contain', c.fullName);
            });
          });
        });
      });
    });
  });

  it('retiene /candidates hasta /interviewFlow en el visit y en cada reload (incluido 304)', () => {
    // Retrasar /interviewFlow garantiza que /candidates llegue antes y TENGA que esperar;
    // sin esto la retención podría ser de 0ms y no probaría nada.
    const FLOW_DELAY_MS = 800;
    let cardCount;
    let previousFlowEtag;

    const expectHeld = ({ gate }, label) => {
      cy.logFlowGate(gate, label).then(() => {
        expect(gate.releasedBy, `${label}: /candidates liberado por`).to.eq('flow');
        expect(
          gate.candidatesArrivedAt,
          `${label}: /candidates llegó antes de entregarse /interviewFlow`
        ).to.be.lessThan(gate.flowDeliveredAt);
        expect(
          gate.candidatesReleasedAt,
          `${label}: /candidates liberado después de entregarse /interviewFlow`
        ).to.be.at.least(gate.flowDeliveredAt);
      });
    };

    // 1) Primera carga
    cy.visitPosition(positionId, { flowDelayMs: FLOW_DELAY_MS }).then((load) => {
      expect(load.gate.id).to.eq(1);
      expect(load.gate.flowStatus, 'visit: status de /interviewFlow').to.eq(200);
      expectHeld(load, 'visit');
      cardCount = load.candidates.response.body.length;
      expect(cardCount, 'candidatos de la posición').to.be.greaterThan(0);
      cy.get('[data-testid^="candidate-card-"]').should('have.length', cardCount);
    });

    // 2) Reload natural: compuerta nueva; se registra si el navegador revalidó (304) o no
    cy.reloadPosition({ flowDelayMs: FLOW_DELAY_MS }).then((load) => {
      expect(load.gate.id, 'reload usa una compuerta nueva').to.eq(2);
      expectHeld(load, 'reload natural');
      // Fuente independiente de commands.js: el header ETag que Cypress registró en la
      // intercepción de ESTA respuesta real. Es el que el reload forzado debe reenviar.
      previousFlowEtag = load.flow.response.headers.etag;
      expect(previousFlowEtag, 'reload natural: header ETag en la respuesta de /interviewFlow')
        .to.be.a('string').and.not.be.empty;
      cy.get('[data-testid^="candidate-card-"]').should('have.length', cardCount);
    });

    // 3) Reload con 304 garantizado: se inyecta If-None-Match con el ETag anterior.
    //    Solo se verifica la compuerta; la UI no, porque un 304 a una petición que el
    //    navegador no hizo condicional no es un escenario que el front pueda consumir.
    cy.reloadPosition({ flowDelayMs: FLOW_DELAY_MS, forceConditional: true }).then((load) => {
      expect(load.gate.id, 'reload forzado usa una compuerta nueva').to.eq(3);
      expect(load.gate.injectedEtag, 'reload forzado: ETag inyectado = ETag de la respuesta anterior')
        .to.eq(previousFlowEtag);
      // Lo que efectivamente salió en la petición, según la intercepción de Cypress.
      expect(load.flow.request.headers['if-none-match'], 'reload forzado: If-None-Match enviado al servidor')
        .to.eq(previousFlowEtag);
      // Si el servidor no reconociera el ETag devolvería 200 y esto falla: no hay verde falso.
      expect(load.flow.response.statusCode, 'reload forzado: status real de /interviewFlow').to.eq(304);
      expect(load.gate.flowStatus, 'reload forzado: status visto por la compuerta').to.eq(304);
      expectHeld(load, 'reload 304 forzado');
    });
  });

  describe('Cambio de fase', () => {
    // Datos para revertir la DB; se guardan ANTES de arrastrar para que afterEach
    // revierta aunque el test falle a mitad de camino.
    let restore = null;

    afterEach(() => {
      if (!restore) return;
      const { candidateId, applicationId, originalStepId } = restore;
      restore = null;
      cy.request('PUT', `${API_URL}/candidates/${candidateId}`, {
        applicationId,
        currentInterviewStep: originalStepId,
      })
        .its('status')
        .should('eq', 200);
    });

    it('mueve una tarjeta a la columna siguiente y el backend persiste la nueva fase', () => {
      // Fuente de verdad directa del backend (sin caché del navegador ni intercepts).
      cy.request(`${API_URL}/positions/${positionId}/interviewFlow`).then(({ body: flowBody }) => {
        const steps = flowBody.interviewFlow.interviewFlow.interviewSteps;

        cy.request(`${API_URL}/positions/${positionId}/candidates`).then(({ body: candidates }) => {
          const columnIndex = (c) => steps.findIndex((s) => s.name === c.currentInterviewStep);
          const candidate = candidates.find((c) => {
            const i = columnIndex(c);
            return i >= 0 && i < steps.length - 1;
          });
          expect(candidate, 'candidato con una columna a su derecha').to.exist;

          const { candidateId, applicationId } = candidate;
          const source = steps[columnIndex(candidate)];
          const target = steps[columnIndex(candidate) + 1];

          // El candidato no está fijo (el orden de la API cambia tras cada update): dejar
          // registrado cuál se movió, en el Command Log y en la terminal de `cypress run`.
          const moveMsg =
            `[cambio-de-fase] ${candidate.fullName} (candidateId=${candidateId}, ` +
            `applicationId=${applicationId}): "${source.name}" (step ${source.id}) → ` +
            `"${target.name}" (step ${target.id})`;
          cy.log(moveMsg);
          cy.task('log', moveMsg, { log: false });

          cy.visitPosition(positionId);
          column(source.name).find(cardSelector(candidateId)).should('be.visible');

          restore = { candidateId, applicationId, originalStepId: source.id };
          cy.moveCardByKeyboard(candidateId, 'right', 1);

          // 1) Respuesta REAL del backend, no el estado optimista del front.
          cy.wait('@updateStep').then(({ request, response }) => {
            expect(request.url, 'path del PUT').to.match(new RegExp(`/candidates/${candidateId}$`));
            expect(request.body, 'body del PUT').to.deep.equal({
              applicationId,
              currentInterviewStep: target.id,
            });
            expect(response.statusCode, 'status del PUT').to.eq(200);
            expect(response.body.message).to.eq('Candidate stage updated successfully');
            expect(response.body.data).to.include({
              id: applicationId,
              candidateId,
              currentInterviewStep: target.id,
            });
          });

          // 2) Movimiento visual.
          column(target.name).find(cardSelector(candidateId)).should('be.visible');
          column(source.name).find(cardSelector(candidateId)).should('not.exist');

          // 3) Persistencia en el backend, consultada directamente.
          cy.request(`${API_URL}/positions/${positionId}/candidates`).then(({ body }) => {
            const updated = body.find((c) => c.applicationId === applicationId);
            expect(updated.currentInterviewStep, 'fase persistida en el backend').to.eq(target.name);
          });

          // 4) Persistencia tras recargar: la UI se reconstruye solo con datos del servidor.
          cy.reloadPosition();
          column(target.name).find(cardSelector(candidateId)).should('be.visible');
          column(source.name).find(cardSelector(candidateId)).should('not.exist');
          cy.get('@updateStep.all').should('have.length', 1);
        });
      });
    });
  });
});
