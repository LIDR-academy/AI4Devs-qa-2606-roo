const POSITION_ID = 1;
const POSITION_TITLE = 'Senior Full-Stack Engineer';
const STAGE_NAMES = {
  initialScreening: 'Initial Screening',
  technicalInterview: 'Technical Interview',
  managerInterview: 'Manager Interview',
};
const CANDIDATE_NAMES = {
  johnDoe: 'John Doe',
  janeSmith: 'Jane Smith',
  carlosGarcia: 'Carlos García',
};

const column = (stageId) => `[data-testid="stage-column-${stageId}"]`;
const header = (stageId) => `[data-testid="stage-header-${stageId}"]`;
const card = (candidateId) => `[data-testid="candidate-card-${candidateId}"]`;

const stepByName = (steps, name) => steps.find((step) => step.name === name);
const candidateByName = (candidates, name) => candidates.find((item) => item.fullName === name);

describe('Página de Position', () => {
  const restoreCarlosToInitialScreening = () => {
    cy.resetCandidateByName(CANDIDATE_NAMES.carlosGarcia, STAGE_NAMES.initialScreening);
  };

  beforeEach(() => {
    restoreCarlosToInitialScreening();

    cy.intercept('GET', /\/positions\/\d+\/interviewflow/i).as('interviewFlow');
    cy.intercept('GET', /\/positions\/\d+\/candidates/i).as('candidates');
    cy.visit(`/positions/${POSITION_ID}`);
    cy.wait(['@interviewFlow', '@candidates']);
    cy.get('[data-testid="position-title"]').should('be.visible');
  });

  afterEach(() => {
    restoreCarlosToInitialScreening();
  });

  describe('Carga de la página', () => {
    it('muestra el título de la posición', () => {
      cy.get('[data-testid="position-title"]').should('have.text', POSITION_TITLE);
    });

    it('muestra una columna por cada fase del proceso', () => {
      cy.get('@interviewFlow').then(({ response }) => {
        const steps = response.body.interviewFlow.interviewFlow.interviewSteps;
        const initial = stepByName(steps, STAGE_NAMES.initialScreening);
        const technical = stepByName(steps, STAGE_NAMES.technicalInterview);
        const manager = stepByName(steps, STAGE_NAMES.managerInterview);

        expect(initial).to.exist;
        expect(technical).to.exist;
        expect(manager).to.exist;

        cy.get(header(initial.id)).should('have.text', STAGE_NAMES.initialScreening);
        cy.get(header(technical.id)).should('have.text', STAGE_NAMES.technicalInterview);
        cy.get(header(manager.id)).should('have.text', STAGE_NAMES.managerInterview);
        cy.get('[data-testid^="stage-column-"]').should('have.length', steps.length);
      });
    });

    it('coloca cada tarjeta de candidato en la columna de su fase actual', () => {
      cy.get('@interviewFlow').then(({ response }) => {
        const steps = response.body.interviewFlow.interviewFlow.interviewSteps;
        cy.wrap(steps).as('steps');
      });
      cy.get('@candidates').then(({ response }) => {
        cy.wrap(response.body).as('loadedCandidates');
      });
      cy.get('@steps').then((steps) => {
        cy.get('@loadedCandidates').then((candidates) => {
          const carlos = candidateByName(candidates, CANDIDATE_NAMES.carlosGarcia);
          const initial = stepByName(steps, STAGE_NAMES.initialScreening);
          const technical = stepByName(steps, STAGE_NAMES.technicalInterview);
          const manager = stepByName(steps, STAGE_NAMES.managerInterview);

          cy.get(column(initial.id)).within(() => {
            cy.contains(CANDIDATE_NAMES.carlosGarcia).should('be.visible');
            cy.get(card(carlos.candidateId)).should('exist');
            cy.contains(CANDIDATE_NAMES.johnDoe).should('not.exist');
            cy.contains(CANDIDATE_NAMES.janeSmith).should('not.exist');
          });

          cy.get(column(technical.id)).within(() => {
            cy.contains(CANDIDATE_NAMES.johnDoe).should('be.visible');
            cy.contains(CANDIDATE_NAMES.janeSmith).should('be.visible');
            cy.contains(CANDIDATE_NAMES.carlosGarcia).should('not.exist');
          });

          cy.get(column(manager.id)).within(() => {
            cy.contains(CANDIDATE_NAMES.carlosGarcia).should('not.exist');
            cy.contains(CANDIDATE_NAMES.johnDoe).should('not.exist');
            cy.contains(CANDIDATE_NAMES.janeSmith).should('not.exist');
          });
        });
      });
    });
  });

  describe('Cambio de fase de un candidato', () => {
    // El PDF pide PUT /candidate/:id (singular). El backend real es PUT /candidates/:id.
    it('mueve la tarjeta y persiste la fase con PUT /candidates/:id (ruta real; el PDF usa /candidate/:id)', () => {
      cy.get('@candidates').then(({ response }) => {
        const carlos = candidateByName(response.body, CANDIDATE_NAMES.carlosGarcia);
        cy.wrap(carlos.candidateId).as('carlosId');
        cy.wrap(carlos.applicationId).as('carlosApplicationId');
      });
      cy.get('@interviewFlow').then(({ response }) => {
        const steps = response.body.interviewFlow.interviewFlow.interviewSteps;
        cy.wrap(stepByName(steps, STAGE_NAMES.initialScreening).id).as('initialId');
        cy.wrap(stepByName(steps, STAGE_NAMES.technicalInterview).id).as('technicalId');
      });

      cy.get('@carlosId').then((carlosId) => {
        cy.intercept('PUT', new RegExp(`/candidates/${carlosId}$`)).as('updateStage');
      });

      cy.get('@initialId').then((initialId) => {
        cy.get(column(initialId)).should('contain', CANDIDATE_NAMES.carlosGarcia);
      });

      cy.then(function () {
        cy.dragCandidateToColumn(`candidate-card-${this.carlosId}`, `stage-column-${this.technicalId}`);
      });

      cy.wait('@updateStage').then(function ({ request, response }) {
        expect(request.method).to.eq('PUT');
        expect(request.url).to.match(new RegExp(`/candidates/${this.carlosId}$`));
        expect(request.url).to.include('/candidates/');
        expect(request.body).to.deep.include({
          applicationId: this.carlosApplicationId,
          currentInterviewStep: this.technicalId,
        });
        expect(response.statusCode).to.eq(200);
      });

      cy.then(function () {
        cy.get(column(this.technicalId)).should('contain', CANDIDATE_NAMES.carlosGarcia);
        cy.get(column(this.initialId)).should('not.contain', CANDIDATE_NAMES.carlosGarcia);
      });

      cy.reload();
      cy.wait(['@interviewFlow', '@candidates']);
      cy.then(function () {
        cy.get(column(this.technicalId)).should('contain', CANDIDATE_NAMES.carlosGarcia);
        cy.get(column(this.initialId)).should('not.contain', CANDIDATE_NAMES.carlosGarcia);
      });
    });

    it('revierte la tarjeta a su columna original si el PUT falla', () => {
      cy.get('@candidates').then(({ response }) => {
        const carlos = candidateByName(response.body, CANDIDATE_NAMES.carlosGarcia);
        cy.wrap(carlos.candidateId).as('carlosId');
      });
      cy.get('@interviewFlow').then(({ response }) => {
        const steps = response.body.interviewFlow.interviewFlow.interviewSteps;
        cy.wrap(stepByName(steps, STAGE_NAMES.initialScreening).id).as('initialId');
        cy.wrap(stepByName(steps, STAGE_NAMES.technicalInterview).id).as('technicalId');
      });

      cy.get('@carlosId').then((carlosId) => {
        cy.intercept('PUT', new RegExp(`/candidates/${carlosId}$`), {
          statusCode: 500,
          body: { message: 'Error updating candidate stage' },
        }).as('failedUpdate');
      });

      cy.then(function () {
        cy.dragCandidateToColumn(`candidate-card-${this.carlosId}`, `stage-column-${this.technicalId}`);
      });

      cy.wait('@failedUpdate');
      cy.then(function () {
        cy.get(column(this.initialId)).should('contain', CANDIDATE_NAMES.carlosGarcia);
        cy.get(column(this.technicalId)).should('not.contain', CANDIDATE_NAMES.carlosGarcia);
      });
    });
  });
});
