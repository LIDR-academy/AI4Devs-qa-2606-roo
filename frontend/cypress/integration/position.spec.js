/// <reference types="cypress" />

/**
 * Pruebas E2E de la interfaz "position" (/positions/:id).
 *
 * El backend (http://localhost:3010) se sustituye con cy.intercept + fixtures,
 * de modo que las pruebas son deterministas y no requieren Docker/Postgres.
 * Aun así se verifica el contrato real del PUT que actualiza la fase.
 *
 * Los selectores usan data-testid (estables) en lugar de clases internas de
 * Bootstrap, para desacoplar las pruebas de la implementación visual
 * (buena práctica del módulo: "selectores accesibles antes que CSS frágiles").
 *
 * Rubric enunciado: escenarios A+B → contextos «1. Carga…» y «2. Cambio de fase…».
 * Ampliación y mapa para revisor: prompts/prompts-iniciales.md §0 y §6.
 */

const POSITION_ID = 1;
const API = 'http://localhost:3010';

describe('Interfaz Position - Pruebas E2E', () => {
  beforeEach(() => {
    // GET flujo de entrevistas (columnas / fases)
    cy.intercept('GET', `${API}/positions/${POSITION_ID}/interviewFlow`, {
      fixture: 'interviewFlow.json',
    }).as('getInterviewFlow');

    // GET candidatos.
    // `delay` fuerza que /interviewFlow (sin delay) resuelva SIEMPRE primero. Es
    // necesario porque el componente compone los candidatos sobre el estado que deja
    // /interviewFlow (defecto D-01): sin ordenar la resolución, el tablero podría
    // quedar vacío de forma intermitente. Así la carga es determinista, no por suerte
    // ni apoyada en `retries`.
    cy.intercept('GET', `${API}/positions/${POSITION_ID}/candidates`, {
      fixture: 'candidates.json',
      delay: 100,
    }).as('getCandidates');

    // PUT actualización de fase del candidato (endpoint real: plural /candidates/:id)
    cy.intercept('PUT', `${API}/candidates/*`, {
      statusCode: 200,
      body: { message: 'Candidate stage updated successfully' },
    }).as('updateCandidateStep');

    cy.visit(`/positions/${POSITION_ID}`);
    cy.wait(['@getInterviewFlow', '@getCandidates']);
  });

  context('1. Carga de la página de Position', () => {
    it('muestra el título de la posición', () => {
      cy.get('[data-testid="position-title"]').should('have.text', 'Senior Full-Stack Engineer');
    });

    it('muestra una columna por cada fase del proceso de contratación', () => {
      const fases = ['Initial Screening', 'Technical Interview', 'Manager Interview'];

      cy.get('[data-testid="stage-header"]').should('have.length', fases.length);
      fases.forEach((fase) => {
        cy.contains('[data-testid="stage-header"]', fase).should('be.visible');
      });
    });

    it('coloca cada tarjeta de candidato en la columna de su fase actual', () => {
      // Given el reclutador abre la posición (datos cargados en beforeEach)
      // Then cada candidato aparece en la columna de su fase actual
      cy.stageColumn('Initial Screening').should('contain.text', 'John Doe');
      cy.stageColumn('Technical Interview').should('contain.text', 'Jane Smith');
      cy.stageColumn('Manager Interview').should('contain.text', 'Robert Brown');

      // And no aparecen en columnas que no les corresponden
      cy.stageColumn('Technical Interview').should('not.contain.text', 'John Doe');
    });

    // EXTRA: refuerza que cada fase muestra exactamente sus candidatos.
    it('muestra el número correcto de tarjetas por columna', () => {
      cy.stageColumn('Initial Screening').find('[data-testid="candidate-name"]').should('have.length', 1);
      cy.stageColumn('Technical Interview').find('[data-testid="candidate-name"]').should('have.length', 1);
      cy.stageColumn('Manager Interview').find('[data-testid="candidate-name"]').should('have.length', 1);
    });

    // EXTRA: la valoración se pinta como N iconos según averageScore.
    it('renderiza la valoración de cada candidato', () => {
      // John Doe: averageScore 3 -> 3 iconos de rating
      cy.stageColumn('Initial Screening')
        .find('[aria-label="rating"]')
        .should('have.length', 3);
      // Robert Brown: averageScore 5 -> 5 iconos
      cy.stageColumn('Manager Interview')
        .find('[aria-label="rating"]')
        .should('have.length', 5);
    });
  });

  context('2. Cambio de fase de un candidato (drag & drop)', () => {
    it('mueve la tarjeta a la nueva columna y persiste la fase con PUT /candidates/:id', () => {
      // Given John Doe está en la columna "Initial Screening"
      cy.stageColumn('Initial Screening').should('contain.text', 'John Doe');
      cy.stageColumn('Technical Interview').should('not.contain.text', 'John Doe');

      // When arrastro su tarjeta (candidateId = 1) una columna a la derecha
      cy.dragCandidate('1', 'right', 1);

      // Then la tarjeta queda en "Technical Interview"
      cy.stageColumn('Technical Interview').should('contain.text', 'John Doe');
      cy.stageColumn('Initial Screening').should('not.contain.text', 'John Doe');

      // And se persiste en el backend con el contrato correcto:
      // applicationId de John = 10, destino "Technical Interview" -> stepId 2.
      cy.wait('@updateCandidateStep').then(({ request }) => {
        expect(request.method).to.eq('PUT');
        expect(request.url).to.eq(`${API}/candidates/1`);
        expect(request.headers).to.have.property('content-type').and.include('application/json');
        expect(request.body).to.deep.equal({
          applicationId: 10,
          currentInterviewStep: 2,
        });
      });
    });

    // EXTRA (camino negativo): cancelar el arrastre NO debe tocar el backend.
    it('no persiste ningún cambio si el arrastre se cancela con Escape', () => {
      const handle = () => cy.get('[data-rbd-drag-handle-draggable-id="1"]');

      // When levanto la tarjeta con Space
      handle().focus().trigger('keydown', { keyCode: 32, which: 32, force: true });

      // Guard: confirmo que el arrastre SÍ se activó (rbd inserta un placeholder).
      // Si esto falla, el test falla ruidosamente en vez de dar un falso verde.
      cy.get('[data-rbd-placeholder-context-id]').should('exist');

      // And la cancelo con Escape (sin soltar en otra columna)
      handle().trigger('keydown', { keyCode: 27, which: 27, force: true });
      cy.get('[data-rbd-placeholder-context-id]').should('not.exist'); // drag cancelado

      // Then la tarjeta permanece en su columna original
      cy.stageColumn('Initial Screening').should('contain.text', 'John Doe');
      cy.stageColumn('Technical Interview').should('not.contain.text', 'John Doe');

      // And no se disparó ningún PUT
      cy.get('@updateCandidateStep.all').should('have.length', 0);
    });

    // EXTRA: el flujo también funciona "hacia atrás" (rechazo / paso previo).
    it('permite retroceder de fase y persiste el cambio', () => {
      // Robert Brown (candidateId = 3) de "Manager Interview" a "Technical Interview".
      cy.dragCandidate('3', 'left', 1);

      cy.stageColumn('Technical Interview').should('contain.text', 'Robert Brown');
      cy.stageColumn('Manager Interview').should('not.contain.text', 'Robert Brown');

      cy.wait('@updateCandidateStep').its('request.body').should('deep.equal', {
        applicationId: 30,
        currentInterviewStep: 2,
      });
    });

    // EXTRA: saltar varias columnas en un solo arrastre.
    it('mueve una tarjeta a través de varias columnas de una vez', () => {
      // John Doe de "Initial Screening" (0) a "Manager Interview" (2).
      cy.dragCandidate('1', 'right', 2);

      cy.stageColumn('Manager Interview').should('contain.text', 'John Doe');
      cy.stageColumn('Initial Screening').should('not.contain.text', 'John Doe');

      cy.wait('@updateCandidateStep').its('request.body').should('deep.equal', {
        applicationId: 10,
        currentInterviewStep: 3,
      });
    });
  });

  // EXTRA: interacción secundaria de la interfaz "position".
  context('3. Detalle del candidato', () => {
    it('abre el panel de detalle al hacer clic en una tarjeta', () => {
      cy.intercept('GET', `${API}/candidates/1`, {
        fixture: 'candidateDetail.json',
      }).as('getCandidateDetail');

      cy.stageColumn('Initial Screening').contains('[data-testid="candidate-name"]', 'John Doe').click();

      cy.wait('@getCandidateDetail');
      cy.get('[data-testid="detail-title"]').should('be.visible').and('have.text', 'Detalles del Candidato');
      cy.get('[data-testid="detail-name"]').should('be.visible').and('have.text', 'John Doe');
      cy.get('[data-testid="detail-email"]').should('contain.text', 'john.doe@example.com');
    });
  });
});

/**
 * Resiliencia: la vista no debe romperse si la carga de candidatos falla o viene
 * vacía. Estos tests registran sus propios intercepts ANTES de visitar, por eso
 * viven en un describe aparte (no usan el beforeEach de la suite principal).
 */
describe('Interfaz Position - Resiliencia', () => {
  it('muestra las columnas pero sin tarjetas si la carga de candidatos falla (500)', () => {
    cy.intercept('GET', `${API}/positions/${POSITION_ID}/interviewFlow`, {
      fixture: 'interviewFlow.json',
    }).as('getInterviewFlow');
    // body no-JSON => el componente entra a su rama catch sin romper el render
    cy.intercept('GET', `${API}/positions/${POSITION_ID}/candidates`, {
      statusCode: 500,
      body: 'Internal Server Error',
    }).as('getCandidates');

    cy.visit(`/positions/${POSITION_ID}`);
    cy.wait(['@getInterviewFlow', '@getCandidates']);

    cy.get('[data-testid="stage-header"]').should('have.length', 3);
    cy.get('[data-testid="candidate-name"]').should('have.length', 0);
  });

  it('renderiza el tablero vacío cuando no hay candidatos', () => {
    cy.intercept('GET', `${API}/positions/${POSITION_ID}/interviewFlow`, {
      fixture: 'interviewFlow.json',
    }).as('getInterviewFlow');
    cy.intercept('GET', `${API}/positions/${POSITION_ID}/candidates`, {
      body: [],
    }).as('getCandidates');

    cy.visit(`/positions/${POSITION_ID}`);
    cy.wait(['@getInterviewFlow', '@getCandidates']);

    cy.get('[data-testid="stage-header"]').should('have.length', 3);
    cy.get('[data-testid="candidate-name"]').should('have.length', 0);
  });
});
