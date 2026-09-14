import seed from '../../fixtures/seedData.json';

const { position, positionWithoutStages } = seed;
const apiUrl = () => Cypress.expose('apiUrl');

describe('EXT - Interfaz Positions: listado de posiciones', () => {
  beforeEach(() => {
    cy.resetDb();
    cy.intercept('GET', `${apiUrl()}/positions`).as('getPositions');
  });

  it('EXT-18 - lista únicamente las posiciones visibles', () => {
    // Given
    cy.task('db:updatePosition', { id: positionWithoutStages.id, data: { isVisible: false } });

    // When
    cy.visit('/positions');

    // Then
    cy.wait('@getPositions').then(({ response }) => {
      expect(response.statusCode).to.eq(200);
      expect(response.body.map((pos) => pos.title)).to.deep.equal([position.title]);
    });
    cy.get('.card').should('have.length', 1).and('contain', position.title);
    cy.contains('.card', positionWithoutStages.title).should('not.exist');
  });

  it('EXT-19 - cada tarjeta muestra título, manager, fecha límite, estado y acciones', () => {
    cy.visit('/positions');
    cy.wait('@getPositions');

    cy.contains('.card', position.title).within(() => {
      cy.contains('.card-title', position.title);
      cy.contains(`Manager: ${position.contactInfo}`);
      cy.get('.card-text').invoke('text').should('match', /Deadline:\s*\d{2}\/\d{2}\/\d{4}/);
      cy.get('.badge').should('have.text', position.status);
      cy.contains('button', 'Ver proceso').should('be.visible');
      cy.contains('button', 'Editar').should('be.visible');
    });
  });

  it('EXT-20 - "Ver proceso" navega al tablero del proceso de la posición', () => {
    cy.visit('/positions');
    cy.wait('@getPositions');

    cy.contains('.card', position.title).contains('button', 'Ver proceso').click();

    cy.location('pathname').should('eq', `/positions/${position.id}`);
    cy.get('h2').should('have.text', position.title);
  });

  it('EXT-21 - "Volver al Dashboard" regresa al dashboard del reclutador', () => {
    cy.visit('/positions');
    cy.wait('@getPositions');

    cy.contains('button', 'Volver al Dashboard').click();

    cy.location('pathname').should('eq', '/');
    cy.contains('h1', 'Dashboard del Reclutador').should('be.visible');
  });

  it.skip('EXT-22 - [PENDIENTE DE DESARROLLO] filtra las posiciones por título', () => {
    cy.visit('/positions');
    cy.wait('@getPositions');

    cy.get('input[placeholder="Buscar por título"]').type('Data');

    cy.get('.card').should('have.length', 1).and('contain', positionWithoutStages.title);
  });

  it.skip('EXT-23 - [PENDIENTE DE DESARROLLO] filtra las posiciones por fecha límite', () => {
    cy.task('db:updatePosition', {
      id: positionWithoutStages.id,
      data: { applicationDeadline: '2025-06-30T12:00:00.000Z' }
    });
    cy.visit('/positions');
    cy.wait('@getPositions');

    cy.get('input[type="date"]').type('2025-06-30');

    cy.get('.card').should('have.length', 1).and('contain', positionWithoutStages.title);
  });

  it.skip('EXT-24 - [PENDIENTE DE DESARROLLO] filtra las posiciones por estado', () => {
    cy.task('db:updatePosition', { id: positionWithoutStages.id, data: { status: 'Borrador' } });
    cy.visit('/positions');
    cy.wait('@getPositions');

    cy.get('select').eq(0).select('draft');

    cy.get('.card').should('have.length', 1).and('contain', positionWithoutStages.title);
  });

  it.skip('EXT-25 - [PENDIENTE DE DESARROLLO] filtra las posiciones por manager', () => {
    cy.task('db:updatePosition', { id: positionWithoutStages.id, data: { contactInfo: 'John Doe' } });
    cy.visit('/positions');
    cy.wait('@getPositions');

    cy.get('select').eq(1).select('john_doe');

    cy.get('.card').should('have.length', 1).and('contain', positionWithoutStages.title);
  });

  it.skip('EXT-26 - [PENDIENTE DE DESARROLLO] "Editar" abre el formulario de edición de la posición', () => {
    cy.visit('/positions');
    cy.wait('@getPositions');

    cy.contains('.card', position.title).contains('button', 'Editar').click();

    cy.location('pathname').should('eq', `/positions/${position.id}/edit`);
    cy.get('input[name="title"]').should('have.value', position.title);
  });
});
