# Pruebas E2E (Cypress) — Interfaz "Position"

## Qué se prueba

El tablero kanban de una posición (`/positions/:id`, componente `src/components/PositionDetails.js`):

- **Carga de la página**: título de la posición, columnas por fase del proceso de contratación, tarjetas de candidato en la columna correcta y valoración de cada candidato.
- **Cambio de fase**: arrastre de una tarjeta entre columnas, persistencia mediante `PUT /candidates/:id`, salto de varias fases, retroceso de fase y arrastre cancelado.

## Requisitos previos

```bash
cd frontend
npm install
npm start          # deja el frontend sirviendo en http://localhost:3000
```

El backend **no** es necesario: los tres endpoints se sustituyen por stubs (`cy.intercept`) servidos desde `cypress/fixtures/`.

## Ejecución

| Comando | Modo |
|---------|------|
| `npm run cypress:open` | Interactivo (Test Runner) |
| `npm run cypress:run` | Headless (CI) |
| `npm run test:e2e` | Alias de `cypress:run` |

## Organización

```
cypress/
├── fixtures/
│   ├── interviewFlow.json   # respuesta de GET /positions/:id/interviewFlow
│   └── candidates.json      # respuesta de GET /positions/:id/candidates
├── integration/
│   └── position.spec.js     # specs E2E
└── support/
    ├── commands.js          # stubPositionApi, visitPosition, stageColumn, dragCandidate
    └── e2e.js
```

`cypress.config.js` fija `specPattern: 'cypress/integration/**/*.spec.js'` porque el enunciado pide los specs en `/cypress/integration`, mientras que Cypress 10+ usa `cypress/e2e` por defecto.

## Notas de implementación

### Simulación del drag & drop

`react-beautiful-dnd` ignora los eventos de ratón sintéticos salvo que se supere su umbral de *sloppy click* con varios `mousemove`, lo que produce tests inestables. Las pruebas usan su **sensor de teclado**, que es API pública y determinista:

```
foco en el drag handle → espacio (levantar) → flecha ←/→ (mover de columna) → espacio (soltar)
```

Encapsulado en `cy.dragCandidate(draggableId, steps)`.

### Condición de carrera en la carga

`PositionDetails.js` lanza `fetchInterviewFlow()` y `fetchCandidates()` en paralelo, y el segundo reparte los candidatos sobre las columnas ya presentes en el estado. Si la respuesta de candidatos llegara primero, las tarjetas no se pintarían. Por eso el stub de `candidates` lleva `delay: 300`, garantizando el orden de llegada.

### Selectores

Se usan los atributos que genera react-beautiful-dnd en lugar de clases de Bootstrap para columnas y tarjetas:

| Elemento | Selector |
|----------|----------|
| Columna (fase) | `[data-rbd-droppable-id="<índice>"]` |
| Tarjeta | `[data-rbd-draggable-id="<candidateId>"]` |
| Asa de arrastre | `[data-rbd-drag-handle-draggable-id="<candidateId>"]` |

## Fallos comunes

| Síntoma | Causa probable |
|---------|----------------|
| `cy.visit()` falla con `ECONNREFUSED` | El frontend no está levantado en `http://localhost:3000` |
| Las columnas aparecen vacías | El stub de candidatos llegó antes que el de `interviewFlow`; revisar el `delay` en `stubPositionApi` |
| El drag no mueve la tarjeta | El navegador perdió el foco del drag handle; ejecutar con la ventana de Cypress en primer plano |
| `self-signed certificate in certificate chain` al instalar | Proxy corporativo interceptando TLS; ver la sección correspondiente en `prompts/prompts-iniciales.md` |
