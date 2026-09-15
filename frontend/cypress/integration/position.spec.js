const POSITION_ID = '1';

const setupPositionIntercepts = ({ stubPut = false } = {}) => {
  cy.fixture('position-kanban.json').then((fixture) => {
    cy.intercept('GET', `**/positions/${POSITION_ID}/interview*`, {
      body: fixture.interviewFlowResponse,
    }).as('getInterviewFlow');

    cy.intercept('GET', `**/positions/${POSITION_ID}/candidates`, (req) => {
      req.reply({ delay: 150, body: fixture.candidatesResponse });
    }).as('getCandidates');

    if (stubPut) {
      cy.intercept('PUT', 'http://localhost:3010/candidates/*', (req) => {
        expect(req.url).to.include('/candidates/3');
        expect(req.body).to.deep.include({
          applicationId: 4,
          currentInterviewStep: 2,
        });
        req.reply({ statusCode: 200, body: { message: 'ok', data: {} } });
      }).as('updateStage');
    }
  });
};

const visitPositionPage = (options = {}) => {
  setupPositionIntercepts(options);
  cy.visit(`/positions/${POSITION_ID}`);
  cy.wait('@getInterviewFlow');
  cy.wait('@getCandidates');
};

describe('Position Page — Carga', () => {
  beforeEach(() => {
    visitPositionPage();
  });

  it('muestra el título de la posición', () => {
    cy.get('h2').should('contain', 'Senior Full-Stack Engineer');
  });

  it('muestra una columna por fase del proceso', () => {
    cy.get('.card-header').should('have.length', 3);
    cy.contains('.card-header', 'Initial Screening').should('be.visible');
    cy.contains('.card-header', 'Technical Interview').should('be.visible');
    cy.contains('.card-header', 'Manager Interview').should('be.visible');
  });

  it('ubica cada candidato en la columna de su fase', () => {
    cy.contains('.card-header', 'Technical Interview')
      .parents('.card')
      .find('.card-title')
      .should('contain', 'John Doe')
      .and('contain', 'Jane Smith');

    cy.contains('.card-header', 'Initial Screening')
      .parents('.card')
      .find('.card-title')
      .should('contain', 'Carlos García');
  });
});

describe('Position Page — Cambio de fase', () => {
  beforeEach(() => {
    visitPositionPage({ stubPut: true });
  });

  it('mueve la tarjeta y actualiza el backend', () => {
    // Carlos García (candidateId 3): Initial Screening → Technical Interview
    cy.get('[data-rbd-draggable-id="3"]').scrollIntoView().realMouseDown({ button: 'left' });

    cy.get('[data-rbd-droppable-id="1"]')
      .realMouseMove(10, 10)
      .realMouseMove(120, 60)
      .realMouseMove(200, 100)
      .wait(400)
      .realMouseUp();

    cy.wait('@updateStage', { timeout: 10000 });

    cy.contains('.card-header', 'Technical Interview')
      .parents('.card')
      .find('.card-title')
      .should('contain', 'Carlos García');
  });
});
