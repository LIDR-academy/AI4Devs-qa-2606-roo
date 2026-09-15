
## PROMPT_1 (generación de la primera tarea en formato Gherkin): 

Actúa como un Ingeniero de QA Automation experto en Cypress y metodología BDD. 
Dame en formato Gherkin ('Given/When/Then') la siguiente especificación:

Carga de la Página de Position:
 * Verifica que el título de la posición se muestra correctamente.
 * Verifica que se muestran las columnas correspondientes a cada fase del proceso de contratación.
 * Verifica que las tarjetas de los candidatos se muestran en la columna correcta según su fase actual.

---

## PROMPT_2 (Creación de la primera tarea): 

Actúa como un Ingeniero de QA Automation experto en Cypress y metodología BDD.

Tu objetivo es generar el test necesario para cubrir la feature dada.

### Reglas y Buenas Prácticas de Selección:
1. Utiliza prioritariamente la estrategia de Testing Library / Cypress Queries accesible:
   - cy.findByRole / getByRole
   - cy.findByLabelText / getByLabel
   - cy.findByTestId / getByTestId (data-testid)
2. PROHIBIDO usar selectores por clase CSS (ej. .btn-primary) o IDs dinámicos/auto-generados.
3. El escenario debe ser claro, declarativo y centrado en el comportamiento del usuario.


### Feature: Carga de la página de Position

**Scenario**: Visualización correcta del título, fases y candidatos en la página de posición
* Given que el reclutador navega a la página del detalle de la posición. Por ejemmplo la página /positions/1
* When la página finaliza su carga
* Then el título de la posición se debe mostrar correctamente en el encabezado <br>
  And se deben visualizar las columnas correspondientes a cada fase del proceso de contratación <br>
  And las tarjetas de los candidatos se deben mostrar en la columna correcta según su fase actual

---

## PROMPT_3 (generación de la segunda tarea en formato Gherkin): 

Actúa como un Ingeniero de QA Automation experto en Cypress y metodología BDD. 
Dame en formato Gherkin ('Given/When/Then') la siguiente especificación:

Cambio de Fase de un Candidato:
* Simula el arrastre de una tarjeta de candidato de una columna a otra.
* Verifica que la tarjeta del candidato se mueve a la nueva columna.
* Verifica que la fase del candidato se actualiza correctamente en el backend mediante el endpoint PUT /candidate/:id.

---

## PROMPT_4 (Creación de la segunda tarea): 

Actúa como un Ingeniero de QA Automation experto en Cypress y metodología BDD.

Tu objetivo es generar el test necesario para cubrir la feature dada.

### Reglas y Buenas Prácticas de Selección:
1. Utiliza prioritariamente la estrategia de Testing Library / Cypress Queries accesible:
   - cy.findByRole / getByRole
   - cy.findByLabelText / getByLabel
   - cy.findByTestId / getByTestId (data-testid)
2. PROHIBIDO usar selectores por clase CSS (ej. .btn-primary) o IDs dinámicos/auto-generados.
3. El escenario debe ser claro, declarativo y centrado en el comportamiento del usuario.

### Feature: Gestión de candidatos en el tablero Kanban

**Scenario**: Cambio de fase de un candidato mediante arrastrar y soltar (Drag and Drop)
* Given que el reclutador se encuentra en la página de la posición con candidatos asignados (tablero Kanban de Positoin) <br>
    And el endpoint "PUT /candidate/:id" está interceptado para monitorear las peticiones
* When arrastra la tarjeta del candidato a la columna de la nueva fase
* Then la tarjeta del candidato se debe visualizar dentro de la nueva columna de destino <br>
    And se debe realizar una petición HTTP "PUT" al endpoint "/candidate/:id" con la nueva fase actualizada <br>
    And la respuesta del servidor debe confirmar la actualización correcta del estado del candidato

---
