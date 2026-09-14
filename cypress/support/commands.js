const API_URL = 'http://localhost:3010';
const POSITION_ID = 1;

const waitForPaint = () =>
  cy.wrap(null, { log: false }).then(
    () =>
      new Cypress.Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      })
  );

const mouseMove = (clientX, clientY) => {
  cy.get('body').trigger('mousemove', {
    button: 0,
    clientX,
    clientY,
    pageX: clientX,
    pageY: clientY,
    screenX: clientX,
    screenY: clientY,
    force: true,
  });
};

Cypress.Commands.add('getPositionBoard', () => {
  return cy.request(`${API_URL}/positions/${POSITION_ID}/interviewflow`).then((flowResponse) => {
    return cy.request(`${API_URL}/positions/${POSITION_ID}/candidates`).then((candidatesResponse) => ({
      steps: flowResponse.body.interviewFlow.interviewFlow.interviewSteps,
      candidates: candidatesResponse.body,
    }));
  });
});

Cypress.Commands.add('resetCandidateByName', (fullName, stageName) => {
  cy.getPositionBoard().then(({ steps, candidates }) => {
    const candidate = candidates.find((item) => item.fullName === fullName);
    const step = steps.find((item) => item.name === stageName);

    expect(candidate, `candidato ${fullName} en posición ${POSITION_ID}`).to.exist;
    expect(step, `fase ${stageName}`).to.exist;

    cy.request({
      method: 'PUT',
      url: `${API_URL}/candidates/${candidate.candidateId}`,
      body: {
        applicationId: candidate.applicationId,
        currentInterviewStep: step.id,
      },
    });
  });
});

Cypress.Commands.add('dragCandidateToColumn', (candidateTestId, columnTestId) => {
  cy.get(`[data-testid="${candidateTestId}"]`).then(($card) => {
    const card = $card[0].getBoundingClientRect();
    const startX = card.x + card.width / 2;
    const startY = card.y + card.height / 2;

    cy.get(`[data-testid="${columnTestId}"]`).then(($column) => {
      const column = $column[0].getBoundingClientRect();
      const endX = column.x + column.width / 2;
      const endY = column.y + Math.min(80, column.height / 2);

      cy.wrap($card).trigger('mousedown', {
        button: 0,
        which: 1,
        clientX: startX,
        clientY: startY,
        pageX: startX,
        pageY: startY,
        force: true,
      });

      waitForPaint();
      mouseMove(startX + 12, startY);
      waitForPaint();
      mouseMove(endX, endY);
      waitForPaint();

      cy.get('body').trigger('mouseup', {
        button: 0,
        which: 1,
        clientX: endX,
        clientY: endY,
        pageX: endX,
        pageY: endY,
        force: true,
      });
    });
  });
});
