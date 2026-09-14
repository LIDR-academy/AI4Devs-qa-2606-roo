import seed from '../fixtures/seedData.json';

const { position, positionWithoutStages, stages, candidates } = seed;
const { john, carlos } = candidates;
const apiUrl = () => Cypress.expose('apiUrl');

const visitPositionBoard = (options = {}) => {
  cy.intercept('GET', `${apiUrl()}/positions/${position.id}/interviewFlow`).as('getInterviewFlow');
  cy.intercept('GET', `${apiUrl()}/positions/${position.id}/candidates`).as('getCandidates');
  cy.visit(`/positions/${position.id}`, options);
  cy.wait(['@getInterviewFlow', '@getCandidates']);
};

describe('MND - Interfaz Position: tablero del proceso de contratación', () => {
  beforeEach(() => {
    cy.resetDb();
    visitPositionBoard();
  });

  context('Carga de la página de Position', () => {
    it('MND-01 - muestra correctamente el título de la posición', () => {
      cy.get('h2').should('have.text', position.title);
    });

    it('MND-02 - muestra una columna por cada fase del proceso de contratación, en el orden del flujo', () => {
      cy.get('[data-rbd-droppable-id] > .card-header')
        .should('have.length', stages.length)
        .then(($headers) => {
          const headerTitles = [...$headers].map((header) => header.innerText.trim());
          expect(headerTitles).to.deep.equal(stages.map((stage) => stage.name));
        });
    });

    it('MND-03 - muestra cada tarjeta de candidato en la columna de su fase actual', () => {
      stages.forEach((stage) => {
        const expectedNames = Object.values(candidates)
          .filter((candidate) => candidate.stage === stage.name)
          .map((candidate) => candidate.name);

        cy.getStageColumn(stage.name)
          .find('[data-rbd-draggable-id]')
          .should('have.length', expectedNames.length);

        expectedNames.forEach((name) => {
          cy.getStageColumn(stage.name).contains('[data-rbd-draggable-id]', name).should('be.visible');
        });
      });
    });
  });

  context('Cambio de fase de un candidato', () => {
    const targetStage = stages.find((stage) => stage.name === 'Manager Interview');

    beforeEach(() => {
      cy.intercept('PUT', `${apiUrl()}/candidates/${carlos.candidateId}`).as('updateCandidateStage');
    });

    it('MND-04 - al arrastrar la tarjeta a otra columna, la tarjeta se mueve a la nueva columna', () => {
      // Given
      cy.getStageColumn(carlos.stage).should('contain', carlos.name);

      // When
      cy.dragCardWithMouse(carlos.name, () => cy.getStageColumn(targetStage.name));

      // Then
      cy.getStageColumn(targetStage.name).should('contain', carlos.name);
      cy.getStageColumn(carlos.stage).should('not.contain', carlos.name);
    });

    it('MND-05 - el cambio de fase se envía al backend mediante PUT /candidates/:id', () => {
      // When
      cy.dragCardWithMouse(carlos.name, () => cy.getStageColumn(targetStage.name));

      // Then
      cy.wait('@updateCandidateStage').then(({ request, response }) => {
        expect(request.body).to.deep.equal({
          applicationId: carlos.applicationId,
          currentInterviewStep: targetStage.id
        });
        expect(response.statusCode).to.eq(200);
        expect(response.body.message).to.eq('Candidate stage updated successfully');
        expect(response.body.data).to.include({
          id: carlos.applicationId,
          candidateId: carlos.candidateId,
          currentInterviewStep: targetStage.id
        });
      });
    });

    it('MND-06 - la nueva fase del candidato queda persistida en el backend', () => {
      // When
      cy.dragCardWithMouse(carlos.name, () => cy.getStageColumn(targetStage.name));
      cy.wait('@updateCandidateStage');

      // Then
      cy.request('GET', `${apiUrl()}/positions/${position.id}/candidates`)
        .its('body')
        .then((applications) => {
          const application = applications.find((app) => app.applicationId === carlos.applicationId);
          expect(application.currentInterviewStep).to.eq(targetStage.name);
        });

      cy.reload();
      cy.wait(['@getInterviewFlow', '@getCandidates']);
      cy.getStageColumn(targetStage.name).should('contain', carlos.name);
      cy.getStageColumn(carlos.stage).should('not.contain', carlos.name);
    });
  });
});

describe('EXT - Interfaz Position: interacciones del tablero', () => {
  beforeEach(() => {
    cy.resetDb();
    visitPositionBoard({
      onBeforeLoad(win) {
        cy.spy(win.console, 'error').as('consoleError');
      }
    });
  });

  it('EXT-27 - mueve un candidato a la fase contigua usando el teclado (arrastre accesible) y lo persiste', () => {
    const targetStage = stages.find((stage) => stage.name === 'Technical Interview');
    cy.intercept('PUT', `${apiUrl()}/candidates/${carlos.candidateId}`).as('updateCandidateStage');

    // When
    cy.dragCardWithKeyboard(carlos.name, ['right']);

    // Then
    cy.getStageColumn(targetStage.name).should('contain', carlos.name);
    cy.getStageColumn(carlos.stage).should('not.contain', carlos.name);
    cy.wait('@updateCandidateStage').then(({ request, response }) => {
      expect(request.body).to.deep.equal({
        applicationId: carlos.applicationId,
        currentInterviewStep: targetStage.id
      });
      expect(response.statusCode).to.eq(200);
    });
  });

  it('EXT-28 - soltar la tarjeta fuera de cualquier columna no cambia su fase ni llama al backend', () => {
    cy.intercept('PUT', `${apiUrl()}/candidates/*`).as('updateCandidateStage');

    // When
    cy.dragCardWithMouse(carlos.name, () => cy.get('h2'));

    // Then
    cy.getStageColumn(carlos.stage).should('contain', carlos.name);
    cy.get('@updateCandidateStage.all').should('have.length', 0);
  });

  it('EXT-29 - cada tarjeta muestra la puntuación media del candidato', () => {
    Object.values(candidates).forEach((candidate) => {
      cy.getCandidateCard(candidate.name)
        .find('[aria-label="rating"]')
        .should('have.length', Math.floor(candidate.averageScore));
    });
  });

  it('EXT-30 - al hacer clic en una tarjeta se abre el panel con el detalle del candidato', () => {
    cy.intercept('GET', `${apiUrl()}/candidates/${john.candidateId}`).as('getCandidateDetails');

    // When
    cy.getCandidateCard(john.name).click();

    // Then
    cy.wait('@getCandidateDetails').its('response.statusCode').should('eq', 200);
    cy.get('.offcanvas')
      .should('be.visible')
      .within(() => {
        cy.contains('.offcanvas-title', 'Detalles del Candidato');
        cy.contains('h5', john.name);
        cy.contains(`Email: ${john.email}`);
        cy.contains(`Teléfono: ${john.phone}`);
        cy.contains('University A - BSc Computer Science');
        cy.contains('Eventbrite - Software Developer');
        cy.contains('a', 'Descargar Curriculum');
        cy.contains(`Posición: ${position.title}`);
        cy.contains('Notas: Good technical skills');
      });
  });

  it('EXT-31 - el panel de detalle del candidato se cierra con el botón de cerrar', () => {
    // Given
    cy.getCandidateCard(john.name).click();
    cy.get('.offcanvas').should('be.visible');

    // When
    cy.get('.offcanvas .btn-close').click();

    // Then
    cy.get('.offcanvas').should('not.exist');
  });

  it.skip('EXT-32 - [PENDIENTE DE DESARROLLO] registra una nueva entrevista desde el panel de detalle (POST /candidates/:id/interviews)', () => {
    const notes = 'Buena comunicación y experiencia sólida';
    const score = 4;
    cy.intercept('POST', `${apiUrl()}/candidates/${carlos.candidateId}/interviews`).as('createInterview');

    // Given
    cy.getCandidateCard(carlos.name).click();

    // When
    cy.get('.offcanvas').within(() => {
      cy.get('textarea[name="notes"]').type(notes);
      cy.contains('label', 'Puntuación').parent().find('span').eq(score - 1).click();
      cy.contains('button', 'Registrar').click();
    });

    // Then
    cy.wait('@createInterview').then(({ request, response }) => {
      expect(request.body).to.deep.equal({ notes, score });
      expect(response.statusCode).to.eq(201);
    });
    cy.get('.offcanvas').should('not.exist');
    cy.request('GET', `${apiUrl()}/positions/${position.id}/candidates`)
      .its('body')
      .then((applications) => {
        const application = applications.find((app) => app.applicationId === carlos.applicationId);
        expect(application.averageScore).to.eq(score);
      });
    cy.reload();
    cy.getCandidateCard(carlos.name).find('[aria-label="rating"]').should('have.length', score);
  });

  it('EXT-33 - si el backend rechaza el cambio de fase, el error se registra y la interfaz no se rompe', () => {
    cy.intercept('PUT', `${apiUrl()}/candidates/${carlos.candidateId}`, {
      statusCode: 500,
      body: { message: 'Error updating candidate stage' }
    }).as('updateCandidateStage');

    // When
    cy.dragCardWithKeyboard(carlos.name, ['right']);

    // Then
    cy.wait('@updateCandidateStage');
    cy.get('@consoleError').should('have.been.calledWithMatch', /Error updating candidate step/);
    cy.get('h2').should('have.text', position.title);
    cy.get('[data-rbd-droppable-id]').should('have.length', stages.length);
    cy.getCandidateCard(carlos.name).should('be.visible');
  });

  it('EXT-34 - el botón "Volver a Posiciones" regresa al listado de posiciones', () => {
    cy.contains('button', 'Volver a Posiciones').click();

    cy.location('pathname').should('eq', '/positions');
    cy.contains('h2', 'Posiciones').should('be.visible');
  });
});

describe('EXT - Interfaz Position: casos límite y contrato de la API', () => {
  before(() => {
    cy.resetDb();
  });

  it('EXT-35 - una posición sin fases configuradas muestra su título y ninguna columna', () => {
    cy.intercept('GET', `${apiUrl()}/positions/${positionWithoutStages.id}/interviewFlow`).as('getInterviewFlow');

    cy.visit(`/positions/${positionWithoutStages.id}`);
    cy.wait('@getInterviewFlow');

    cy.get('h2').should('have.text', positionWithoutStages.title);
    cy.get('[data-rbd-droppable-id]').should('not.exist');
  });

  it('EXT-36 - una posición inexistente responde 404 y la página no muestra título ni columnas', () => {
    const missingPositionId = 999999;
    cy.intercept('GET', `${apiUrl()}/positions/${missingPositionId}/interviewFlow`).as('getInterviewFlow');

    cy.request({
      url: `${apiUrl()}/positions/${missingPositionId}/interviewflow`,
      failOnStatusCode: false
    }).then((response) => {
      expect(response.status).to.eq(404);
      expect(response.body.message).to.eq('Position not found');
    });

    cy.visit(`/positions/${missingPositionId}`);
    cy.wait('@getInterviewFlow');
    cy.get('h2').should('have.text', '');
    cy.get('[data-rbd-droppable-id]').should('not.exist');
    cy.contains('button', 'Volver a Posiciones').should('be.visible');
  });

  it('EXT-37 - PUT /candidates/:id con una aplicación inexistente responde 404', () => {
    cy.request({
      method: 'PUT',
      url: `${apiUrl()}/candidates/${john.candidateId}`,
      body: { applicationId: 999999, currentInterviewStep: 2 },
      failOnStatusCode: false
    }).then((response) => {
      expect(response.status).to.eq(404);
      expect(response.body.message).to.eq('Application not found');
    });
  });

  it('EXT-38 - PUT /candidates/:id con datos no numéricos responde 400', () => {
    cy.request({
      method: 'PUT',
      url: `${apiUrl()}/candidates/${john.candidateId}`,
      body: { applicationId: 'abc', currentInterviewStep: 2 },
      failOnStatusCode: false
    }).then((response) => {
      expect(response.status).to.eq(400);
      expect(response.body.error).to.eq('Invalid position ID format');
    });

    cy.request({
      method: 'PUT',
      url: `${apiUrl()}/candidates/${john.candidateId}`,
      body: { applicationId: john.applicationId, currentInterviewStep: 'abc' },
      failOnStatusCode: false
    }).then((response) => {
      expect(response.status).to.eq(400);
      expect(response.body.error).to.eq('Invalid currentInterviewStep format');
    });
  });
});
