/// <reference types="cypress" />

/**
 * Tests de CARACTERIZACIÓN de defectos conocidos (D-01 y D-02 de informe-defectos.md).
 *
 * ⚠️ IMPORTANTE: estos tests congelan el COMPORTAMIENTO ACTUAL (defectuoso) del
 * producto, NO el comportamiento deseado. Están en verde porque el defecto EXISTE.
 *
 * ¿Por qué viven en la suite? Para que el defecto sea (1) reproducible y auditable
 * desde el repo y (2) fácil de convertir en prueba de regresión: cuando D-01 y D-02
 * se corrijan, se INVIERTEN las aserciones y pasan a este mismo archivo como garantía
 * de que el bug no vuelve. Es la técnica de characterization testing sobre legacy.
 *
 * Cubren además el caso de error del drag (estado tras fallo 5xx), que de otro modo
 * quedaría sin cobertura.
 */

const POSITION_ID = 1;
const API = 'http://localhost:3010';

describe('Caracterización de defectos conocidos (interfaz position)', () => {
  it('D-01: si /candidates responde antes que /interviewFlow, el tablero queda sin candidatos', () => {
    // Forzamos el orden inverso al sano: candidates primero, interviewFlow tarde.
    cy.intercept('GET', `${API}/positions/${POSITION_ID}/interviewFlow`, {
      fixture: 'interviewFlow.json',
      delay: 400,
    }).as('flow');
    cy.intercept('GET', `${API}/positions/${POSITION_ID}/candidates`, {
      fixture: 'candidates.json',
      delay: 0,
    }).as('cands');

    cy.visit(`/positions/${POSITION_ID}`);
    cy.wait('@cands');
    cy.wait('@flow');

    cy.get('[data-testid="stage-header"]').should('have.length', 3); // columnas OK
    // Comportamiento ACTUAL (defecto D-01): 0 tarjetas. Al corregir D-01 → 3.
    cy.get('[data-testid="candidate-name"]').should('have.length', 0);
  });

  it('D-02: si el PUT falla (500), la tarjeta queda movida sin rollback ni aviso', () => {
    cy.intercept('GET', `${API}/positions/${POSITION_ID}/interviewFlow`, {
      fixture: 'interviewFlow.json',
    }).as('flow');
    cy.intercept('GET', `${API}/positions/${POSITION_ID}/candidates`, {
      fixture: 'candidates.json',
      delay: 100, // orden sano (evita que D-01 interfiera con este caso)
    }).as('cands');
    cy.intercept('PUT', `${API}/candidates/*`, {
      statusCode: 500,
      body: { message: 'boom' },
    }).as('put');

    cy.visit(`/positions/${POSITION_ID}`);
    cy.wait(['@flow', '@cands']);

    cy.dragCandidate('1', 'right', 1);
    cy.wait('@put').its('response.statusCode').should('eq', 500);

    // Comportamiento ACTUAL (defecto D-02): permanece movida y sin aviso.
    // Al corregir D-02 → debería revertir el movimiento y mostrar role="alert".
    cy.stageColumn('Technical Interview').should('contain.text', 'John Doe');
    cy.get('[role="alert"], .alert').should('not.exist');
  });
});
