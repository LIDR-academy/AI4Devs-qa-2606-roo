/**
 * Feature: Gestión de candidatos en el tablero Kanban
 *
 * Scenario: Cambio de fase de un candidato mediante arrastrar y soltar (Drag and Drop)
 *   Given que el reclutador se encuentra en la página de la posición con candidatos asignados
 *   And el endpoint "PUT /candidates/:id" está interceptado para monitorear las peticiones
 *   When arrastra la tarjeta del candidato a la columna de la nueva fase
 *   Then la tarjeta del candidato se debe visualizar dentro de la nueva columna de destino
 *   And se debe realizar una petición HTTP "PUT" al endpoint "/candidates/:id" con la nueva fase actualizada
 *   And la respuesta del servidor debe confirmar la actualización correcta del estado del candidato
 */

describe('Feature: Gestión de candidatos en el tablero Kanban', () => {
    const POSITION_ID = 1;

    // Candidato que se arrastrará: Alice García está en "CV Review" (columna 0, step id=1)
    // Destino: "Phone Screen" (columna 1, step id=2)
    const DRAGGED_CANDIDATE = {
        name: 'Alice García',
        candidateId: 1,
        applicationId: 1,
    };
    const SOURCE_STAGE = 'CV Review';
    const TARGET_STAGE = 'Phone Screen';

    // El PUT body usa el `id` del step de destino (no el nombre).
    // Fixture interviewFlow: Phone Screen → id: 2
    const TARGET_STEP_ID = 2;

    beforeEach(() => {
        // --- Intercepts de carga inicial ---
        cy.intercept('GET', `**/positions/${POSITION_ID}/interviewFlow`, {
            fixture: 'position-details/interviewFlow.json',
        }).as('getInterviewFlow');

        cy.intercept('GET', `**/positions/${POSITION_ID}/candidates`, (req) => {
            req.reply({
                delay: 100, // Asegura que interviewFlow procesa primero (evita race condition)
                fixture: 'position-details/candidates.json',
            });
        }).as('getCandidates');

        // --- Intercept del PUT (monitorización del escenario) ---
        // La URL dinámica incluye el candidateId real de la tarjeta arrastrada.
        cy.intercept(
            'PUT',
            `**/candidates/${DRAGGED_CANDIDATE.candidateId}`,
            {
                statusCode: 200,
                fixture: 'position-details/updateCandidateStep.json',
            }
        ).as('updateCandidateStep');

        // Given: el reclutador navega a la página del tablero Kanban de la posición
        cy.visit(`/positions/${POSITION_ID}`);
        cy.wait('@getInterviewFlow');
        cy.wait('@getCandidates');
    });

    it('Scenario: Cambio de fase de un candidato mediante arrastrar y soltar (Drag and Drop)', () => {
        // --- Precondición: verificar estado inicial del tablero ---
        // La tarjeta debe estar en la columna de origen antes de arrastrarla
        cy.findAllByTestId('stage-column').eq(0).within(() => {
            cy.findAllByTestId('stage-title').should('have.text', SOURCE_STAGE);
            cy.findByText(DRAGGED_CANDIDATE.name).should('be.visible');
        });

        // --- And: el endpoint PUT está interceptado (configurado en beforeEach) ---

        // --- When: el reclutador arrastra la tarjeta al destino via teclado (API de accesibilidad de RBD) ---
        // react-beautiful-dnd v13 usa PointerEvents internamente, haciendo infiable
        // la simulación vía mousedown/mousemove. El sensor de teclado de RBD es el
        // método oficial y fiable para E2E: Space=lift, Arrow=mover, Space=drop.
        cy.findAllByTestId('stage-column').eq(0)
            .findAllByTestId('candidate-card')
            .first()
            .dragToNextColumnViaKeyboard(1); // 1 columna a la derecha → "Phone Screen"

        // --- Then: la tarjeta debe aparecer en la columna de destino ---
        cy.findAllByTestId('stage-column').eq(1).within(() => {
            cy.findAllByTestId('stage-title').should('have.text', TARGET_STAGE);
            cy.findByText(DRAGGED_CANDIDATE.name).should('be.visible');
        });

        // La tarjeta ya no debe estar en la columna de origen
        cy.findAllByTestId('stage-column').eq(0).within(() => {
            cy.findByText(DRAGGED_CANDIDATE.name).should('not.exist');
        });

        // --- And: se realiza la petición PUT con la nueva fase actualizada ---
        cy.wait('@updateCandidateStep').then((interception) => {
            // Verificar método HTTP
            expect(interception.request.method).to.equal('PUT');

            // Verificar URL dinámica con el candidateId correcto
            expect(interception.request.url).to.include(
                `/candidates/${DRAGGED_CANDIDATE.candidateId}`
            );

            // Verificar el body de la petición:
            // - applicationId: identificador de la solicitud de empleo (Number)
            // - currentInterviewStep: id numérico del step de destino (NO el nombre)
            expect(interception.request.body).to.deep.equal({
                applicationId: DRAGGED_CANDIDATE.applicationId,
                currentInterviewStep: TARGET_STEP_ID,
            });
        });

        // --- And: la respuesta del servidor confirma la actualización correcta ---
        cy.get('@updateCandidateStep').then((interception) => {
            expect(interception.response.statusCode).to.equal(200);

            // Confirmar que la respuesta refleja el estado actualizado
            expect(interception.response.body).to.include({
                candidateId: DRAGGED_CANDIDATE.candidateId,
                applicationId: DRAGGED_CANDIDATE.applicationId,
                currentInterviewStep: TARGET_STEP_ID,
            });
        });
    });
});
