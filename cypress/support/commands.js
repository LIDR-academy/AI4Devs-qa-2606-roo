import '@testing-library/cypress/add-commands';

/**
 * Simula un drag-and-drop mediante el sensor de teclado de react-beautiful-dnd.
 *
 * react-beautiful-dnd v13 usa PointerEvents internamente, lo que hace que los
 * métodos de mouse/touch de Cypress no disparen el ciclo de DnD correctamente.
 * El sensor de teclado es el mecanismo oficial de accesibilidad de RBD y el
 * más fiable para tests E2E.
 *
 * Flujo del sensor de teclado de RBD:
 *   1. [Space]      → lift (inicia el arrastre sobre el elemento enfocado)
 *   2. [ArrowRight] → mueve el ítem al siguiente droppable (columna) a la derecha
 *   3. [Space]      → drop (confirma la posición y llama onDragEnd)
 *
 * @param {string | number} columnsMoved - número de columnas a desplazar hacia la derecha (>0) o izquierda (<0)
 *
 * Uso:
 *   cy.findAllByTestId('candidate-card').first().dragToNextColumnViaKeyboard(1);
 */
Cypress.Commands.add(
    'dragToNextColumnViaKeyboard',
    { prevSubject: 'element' },
    (subject, columnsMoved = 1) => {
        const arrowKey = columnsMoved > 0 ? 'ArrowRight' : 'ArrowLeft';
        const steps = Math.abs(columnsMoved);

        // 1. Enfocar el elemento (drag handle tiene tabIndex="0" vía RBD dragHandleProps)
        cy.wrap(subject).focus();

        // 2. Space → lift
        cy.wrap(subject).trigger('keydown', {
            key: ' ',
            code: 'Space',
            keyCode: 32,
            which: 32,
            bubbles: true,
        });

        // 3. ArrowRight/ArrowLeft × N → mover entre columnas
        // { force: true } es necesario: mientras el ítem está en vuelo ("lifted"),
        // RBD aplica pointer-events: none al nodo arrastrado. Cypress rechaza
        // trigger() sobre elementos con pointer-events: none salvo que se fuerce.
        // El sensor de teclado de RBD escucha keydown a nivel de window, así que
        // el evento sigue siendo procesado correctamente pese al force.
        for (let i = 0; i < steps; i++) {
            cy.wrap(subject).trigger('keydown', {
                key: arrowKey,
                code: arrowKey,
                keyCode: columnsMoved > 0 ? 39 : 37,
                which: columnsMoved > 0 ? 39 : 37,
                bubbles: true,
                force: true,
            });
        }

        // 4. Space → drop (confirma y dispara onDragEnd → PUT al servidor)
        cy.wrap(subject).trigger('keydown', {
            key: ' ',
            code: 'Space',
            keyCode: 32,
            which: 32,
            bubbles: true,
            force: true,
        });
    }
);
