/**
 * Feature: Carga de la página de Position
 *
 * Scenario: Visualización correcta del título, fases y candidatos en la página de posición
 *   Given que el reclutador navega a la página del detalle de la posición (/positions/1)
 *   When la página finaliza su carga
 *   Then el título de la posición se debe mostrar correctamente en el encabezado
 *   And se deben visualizar las columnas correspondientes a cada fase del proceso de contratación
 *   And las tarjetas de los candidatos se deben mostrar en la columna correcta según su fase actual
 */

describe('Feature: Carga de la página de Position', () => {
    const POSITION_ID = 1;
    const POSITION_NAME = 'Senior Frontend Developer';
    const STAGES = ['CV Review', 'Phone Screen', 'Technical Interview', 'HR Interview'];

    beforeEach(() => {
        // El interviewFlow debe resolverse antes que candidates para evitar la race condition
        // del componente: fetchCandidates usa setStages(prevStages => ...) y necesita que
        // las fases ya estén en el estado antes de asignar candidatos a columnas.
        cy.intercept('GET', `**/positions/${POSITION_ID}/interviewFlow`, {
            fixture: 'position-details/interviewFlow.json',
        }).as('getInterviewFlow');

        cy.intercept('GET', `**/positions/${POSITION_ID}/candidates`, (req) => {
            req.reply({
                delay: 100, // Garantiza que interviewFlow procesa primero
                fixture: 'position-details/candidates.json',
            });
        }).as('getCandidates');
    });

    it('Scenario: Visualización correcta del título, fases y candidatos en la página de posición', () => {
        // Given: el reclutador navega a la página del detalle de la posición
        cy.visit(`/positions/${POSITION_ID}`);

        // When: la página finaliza su carga (ambas llamadas a la API completan)
        cy.wait('@getInterviewFlow');
        cy.wait('@getCandidates');

        // Then: el título de la posición se debe mostrar correctamente en el encabezado
        cy.findByRole('heading', { level: 2, name: POSITION_NAME })
            .should('be.visible');

        // And: se deben visualizar las columnas correspondientes a cada fase del proceso de contratación
        cy.findAllByTestId('stage-title')
            .should('have.length', STAGES.length);

        STAGES.forEach((stageName) => {
            cy.findAllByTestId('stage-title')
                .contains(stageName)
                .should('be.visible');
        });

        // And: las tarjetas de los candidatos se deben mostrar en la columna correcta según su fase actual

        // CV Review → Alice García (score: 3) y Clara López (score: 2)
        cy.findAllByTestId('stage-column').eq(0).within(() => {
            cy.findAllByTestId('candidate-card').should('have.length', 2);
            cy.contains('Alice García').should('be.visible');
            cy.contains('Clara López').should('be.visible');
        });

        // Phone Screen → Bob Martínez (score: 4)
        cy.findAllByTestId('stage-column').eq(1).within(() => {
            cy.findAllByTestId('candidate-card').should('have.length', 1);
            cy.contains('Bob Martínez').should('be.visible');
        });

        // Technical Interview → sin candidatos
        cy.findAllByTestId('stage-column').eq(2).within(() => {
            cy.findAllByTestId('candidate-card').should('have.length', 0);
        });

        // HR Interview → sin candidatos
        cy.findAllByTestId('stage-column').eq(3).within(() => {
            cy.findAllByTestId('candidate-card').should('have.length', 0);
        });
    });
});
