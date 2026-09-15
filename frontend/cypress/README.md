# Pruebas E2E con Cypress — Interfaz *Position*

Pruebas End-to-End de la vista `/positions/:id` (`src/components/PositionDetails.js`):
tablero Kanban de candidatos por fase del proceso de contratación.

## Cómo ejecutar

Requiere Node.js. **No** se necesita backend ni base de datos: las llamadas a
`http://localhost:3010` están mockeadas con `cy.intercept` + fixtures.

Un solo comando (levanta el frontend, corre las pruebas y lo apaga):

```bash
npm install        # postinstall: descarga el binario de Cypress
npm run e2e        # headless — suite completa (14)
npm run e2e:enunciado   # solo position.spec.js (12) — rubric estricto del enunciado
npm run e2e:open   # modo interactivo
```

Si Cypress no arranca tras clonar, ejecuta una vez: `npx cypress install`.

### Windows / puerto 3000 ocupado

Si aparece `Something is already running on port 3000` o un error de `taskkill` al
final, cierra el proceso que usa el puerto 3000 y vuelve a ejecutar `npm run e2e`.
Alternativa: terminal 1 `npm start`, terminal 2 `npm run cy:run` (sin
`start-server-and-test`).

O en dos terminales (control manual):

```bash
npm start          # terminal 1  -> http://localhost:3000
npm run cy:run     # terminal 2  (o npm run cy:open)
```

### Modo integración real (opcional)

La suite E2E **no** lo necesita —el borde HTTP está mockeado—, pero si se quisiera correr
contra el backend real basta con levantarlo antes (`docker compose up -d` para Postgres y
`npm run dev` en `backend/`, con seed si hace falta) y **retirar los `cy.intercept`**. La
aserción del contrato del `PUT` seguiría siendo válida; solo cambiaría la fuente de datos.

**Sin Docker** (solo ver la UI en el navegador): en otra terminal, desde `frontend/`:

```bash
npm run mock:api
```

Sirve en `:3010` las mismas fixtures que Cypress. Recarga `http://localhost:3000/positions/1`.

## Enunciado vs ampliación

| Alcance | Archivo | Pruebas |
|---------|---------|---------|
| **Rubric estricto** (carga + drag/PUT) | `integration/position.spec.js` | 12 |
| Caracterización de defectos (D-01, D-02) | `integration/defectos-conocidos.spec.js` | 2 |
| **Total** | `npm run e2e` | **14** |

Lo extra no sustituye al enunciado: lo **envuelve** (resiliencia, caminos negativos, contrato HTTP completo, informe de producto).

## Qué se cubre

| # | Escenario | Verifica |
|---|-----------|----------|
| 1 | Carga de la página | Título de la posición, una columna por fase, tarjetas en su columna correcta, conteo por columna y valoración por candidato |
| 2 | Cambio de fase (drag & drop) | La tarjeta se mueve a la nueva columna **y** se persiste con `PUT /candidates/:id` (URL, método, **headers** y cuerpo) — incluye avanzar, **retroceder**, **saltar varias columnas** y **cancelar con Escape** (no dispara PUT) |
| 3 | Detalle del candidato | Al hacer clic en una tarjeta se abre el panel lateral con sus datos |
| 4 | Resiliencia | El tablero no se rompe si la carga de candidatos falla (500) o viene vacía: muestra las columnas sin tarjetas |
| 5 | Caracterización de defectos | Congela el comportamiento actual de D-01 (carga sin candidatos por carrera) y D-02 (sin rollback tras `PUT` 500), cubriendo el **caso de error del drag** — en `defectos-conocidos.spec.js` |

Total: **14 pruebas** = 12 de regresión (`position.spec.js`) + 2 de caracterización
(`defectos-conocidos.spec.js`).

Los defectos de producto encontrados al construir la suite están en
[`informe-defectos.md`](informe-defectos.md) (9 defectos; 2 reproducidos con Cypress).

## Decisiones de diseño

- **Selectores por `data-testid`.** Las pruebas seleccionan por atributos
  `data-testid` añadidos a los componentes (`position-title`, `stage-header`,
  `stage-column` con `data-stage-id`, `candidate-card`, `candidate-name`,
  `detail-title`, `detail-name`, `detail-email`) más `aria-label="rating"` para la
  valoración, no por clases internas de Bootstrap. Así los tests no se rompen si cambia
  el maquetado/CSS. El arrastre usa el atributo estable propio de `react-beautiful-dnd`
  (`data-rbd-drag-handle-draggable-id`) y su placeholder (`data-rbd-placeholder-context-id`)
  para sincronizar por estado.
- **Backend mockeado (`cy.intercept` + fixtures).** Pruebas deterministas,
  independientes del estado de la BD y ejecutables en cualquier entorno/CI. Aun
  así se valida el **contrato real** del `PUT` (cuerpo `{ applicationId,
  currentInterviewStep }` con `currentInterviewStep` = **id numérico de la fase**,
  no el nombre).
- **Endpoint real:** el código llama a `PUT /candidates/:id` (plural). El
  enunciado lo cita como `/candidate/:id`; se usa el real.
- **Drag & drop por teclado.** La vista usa `react-beautiful-dnd`, cuyo sensor de
  mouse depende de timings de animación difíciles de reproducir en Cypress. El
  arrastre se hace con el sensor de teclado (`Space` levantar → `Arrow` mover →
  `Space` soltar), encapsulado en `cy.dragCandidate(id, direction, steps)`.

## Comandos personalizados (`cypress/support/commands.js`)

- `cy.dragCandidate(draggableId, direction, steps)` — arrastra una tarjeta entre
  columnas por teclado.
- `cy.stageColumn(title)` — devuelve la columna (Card) cuyo encabezado coincide
  con el título de la fase.

## Estructura

```
frontend/
├─ cypress.config.js
└─ cypress/
   ├─ integration/position.spec.js
   ├─ integration/defectos-conocidos.spec.js
   ├─ fixtures/{interviewFlow,candidates,candidateDetail}.json
   ├─ support/{e2e,commands}.js
   ├─ README.md
   └─ informe-defectos.md
```

## Integración continua

`.github/workflows/e2e.yml` ejecuta estas pruebas en cada push a `main` y en cada
Pull Request (GitHub Actions + `cypress-io/github-action`), subiendo capturas si
algún test falla.
