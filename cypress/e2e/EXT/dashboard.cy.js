const apiUrl = () => Cypress.expose('apiUrl');

describe('EXT - Interfaz Dashboard del reclutador', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('EXT-01 - muestra el logo, el título y los accesos a las funcionalidades principales', () => {
    cy.get('img[alt="LTI Logo"]').should('be.visible');
    cy.contains('h1', 'Dashboard del Reclutador').should('be.visible');
    cy.contains('.card', 'Añadir Candidato').contains('button', 'Añadir Nuevo Candidato').should('be.visible');
    cy.contains('.card', 'Ver Posiciones').contains('button', 'Ir a Posiciones').should('be.visible');
  });

  it('EXT-02 - "Añadir Nuevo Candidato" navega al formulario de alta', () => {
    cy.contains('button', 'Añadir Nuevo Candidato').click();

    cy.location('pathname').should('eq', '/add-candidate');
    cy.contains('h1', 'Agregar Candidato').should('be.visible');
  });

  it('EXT-03 - "Ir a Posiciones" navega al listado de posiciones', () => {
    cy.contains('button', 'Ir a Posiciones').click();

    cy.location('pathname').should('eq', '/positions');
    cy.contains('h2', 'Posiciones').should('be.visible');
  });
});

describe('EXT - Disponibilidad del backend', () => {
  it('EXT-04 - el endpoint de health check responde', () => {
    cy.request(`${apiUrl()}/`).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.eq('Hola LTI!');
    });
  });
});
