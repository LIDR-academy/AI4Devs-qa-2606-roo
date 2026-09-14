Cypress.Commands.add('resetDb', () => {
  cy.task('db:reset', null, { timeout: 60000 });
});

Cypress.Commands.add('fillCandidateForm', (candidate) => {
  cy.get('input[name="firstName"]').type(candidate.firstName);
  cy.get('input[name="lastName"]').type(candidate.lastName);
  if (candidate.email) {
    cy.get('input[name="email"]').type(candidate.email);
  }
  if (candidate.phone) {
    cy.get('input[name="phone"]').type(candidate.phone);
  }
  if (candidate.address) {
    cy.get('input[name="address"]').type(candidate.address);
  }
});

Cypress.Commands.add('getStageColumn', (stageName) =>
  cy.contains('[data-rbd-droppable-id] > .card-header', stageName).parent()
);

Cypress.Commands.add('getCandidateCard', (candidateName) =>
  cy.contains('[data-rbd-draggable-id]', candidateName)
);

const pointer = (x, y) => ({ button: 0, clientX: x, clientY: y, force: true, scrollBehavior: false });

const centerOf = (element) => {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
};

// react-beautiful-dnd fija la tarjeta con position: fixed mientras dura el arrastre y la animación de soltado
const waitForDropToFinish = (candidateName) =>
  cy.getCandidateCard(candidateName).should(($card) => {
    expect($card[0].style.position, 'animación de soltado finalizada').not.to.eq('fixed');
  });

Cypress.Commands.add('dragCardWithMouse', (candidateName, getDropTarget) => {
  getDropTarget().then(($target) => {
    const end = centerOf($target[0]);
    cy.getCandidateCard(candidateName).then(($card) => {
      const start = centerOf($card[0]);
      // el arrastre solo empieza tras superar 5px de movimiento y las posiciones se procesan con requestAnimationFrame
      cy.wrap($card)
        .trigger('mousedown', pointer(start.x, start.y))
        .trigger('mousemove', pointer(start.x + 10, start.y))
        .wait(100)
        .trigger('mousemove', pointer(end.x, end.y))
        .wait(300)
        .trigger('mouseup', pointer(end.x, end.y));
    });
  });
  waitForDropToFinish(candidateName);
});

const KEYS = {
  space: { key: ' ', code: 'Space', keyCode: 32 },
  left: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
  up: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
  right: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
  down: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 }
};

const pressKey = ($element, keyName) =>
  cy.wrap($element).trigger('keydown', { ...KEYS[keyName], which: KEYS[keyName].keyCode, force: true });

Cypress.Commands.add('dragCardWithKeyboard', (candidateName, moves) => {
  cy.getCandidateCard(candidateName)
    .focus()
    .then(($card) => {
      pressKey($card, 'space').wait(200);
      moves.forEach((move) => pressKey($card, move).wait(200));
      pressKey($card, 'space');
    });
  waitForDropToFinish(candidateName);
});
