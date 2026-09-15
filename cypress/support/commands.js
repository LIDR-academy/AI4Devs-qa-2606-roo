// react-beautiful-dnd does not use the native HTML5 drag & drop events
// (dragstart/dragover/drop). It relies on its own mouse-sensor system, so a
// drag must be simulated as a mousedown -> mousemove (with waits so the
// sensor detects movement past its threshold) -> mouseup sequence.
Cypress.Commands.add('dragAndDrop', (sourceSelector, targetSelector) => {
  cy.get(sourceSelector).then(($source) => {
    const sourceRect = $source[0].getBoundingClientRect();
    const sourceCenter = {
      x: sourceRect.left + sourceRect.width / 2,
      y: sourceRect.top + sourceRect.height / 2,
    };

    cy.get(targetSelector).then(($target) => {
      const targetRect = $target[0].getBoundingClientRect();
      const targetCenter = {
        x: targetRect.left + targetRect.width / 2,
        y: targetRect.top + targetRect.height / 2,
      };

      cy.wrap($source)
        .trigger('mousedown', {
          button: 0,
          clientX: sourceCenter.x,
          clientY: sourceCenter.y,
          force: true,
        })
        .wait(200)
        .trigger('mousemove', {
          button: 0,
          clientX: sourceCenter.x + 10,
          clientY: sourceCenter.y + 10,
          force: true,
        })
        .wait(200)
        .trigger('mousemove', {
          button: 0,
          clientX: targetCenter.x,
          clientY: targetCenter.y,
          force: true,
        })
        .wait(200)
        .trigger('mouseup', { force: true });
    });
  });
});
