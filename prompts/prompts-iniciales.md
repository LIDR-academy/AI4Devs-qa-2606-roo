# Prompts iniciales — E2E Cypress sobre Position Detail

Decisiones tomadas para el ejercicio, tras diagnosticar el repo real antes de escribir código.

## Endpoint real de cambio de fase

El enunciado sugería `PUT /candidate/:id`. El endpoint real (verificado en
`backend/src/routes/candidateRoutes.ts` y `candidateController.ts`) es
**`PUT /candidates/:id`**, con body `{ applicationId, currentInterviewStep }`
(`currentInterviewStep` es el id numérico del `InterviewStep`, no un string).
Los tests usan esta ruta real.

## Estructura de carpetas de Cypress

Cypress 14.5.4 usa por defecto `cypress/e2e/`; `cypress/integration/` es la
convención pre-v10, descontinuada. Se mantiene `cypress/integration/position.spec.js`
tal como pide el enunciado, configurando `specPattern` en `cypress.config.js`
para que Cypress 14 la reconozca.

## Estrategia de datos: entorno real, sin mocks

Los tests corren contra frontend + backend + Postgres reales (sin `cy.intercept`
como stub para los GET). Los asserts de carga de página (título, columnas,
candidatos) se escriben contra los valores conocidos del seed
(`backend/prisma/seed.ts`), no derivándolos dinámicamente vía `cy.request`.

Para el PUT de cambio de fase, `cy.intercept('PUT', '**/candidates/*', req => req.continue())`
se usa como **spy**, no como stub: la petición real llega al backend, y el
test verifica `request.url`, `request.body` y `response.statusCode` sobre la
respuesta real antes de comprobar que la tarjeta quedó en la columna destino.

## Reproducibilidad del entorno

`backend/prisma/seed.ts` no es idempotente (usa `.create()` sin limpieza
previa). Antes de correr la suite, es un **prerrequisito manual**:

```
docker-compose up -d
cd backend
npx prisma migrate reset --force
npx ts-node prisma/seed.ts
npm run build && npm start   # :3010
cd ../frontend
npm start                     # :3000
```

Este reset no se automatiza dentro de Cypress (nada de `before()`/`cy.exec()`
destructivo en el spec): es un paso manual previo, documentado en el propio
spec y aquí.

## Drag & drop

`react-beautiful-dnd` no usa eventos HTML5 nativos (`dragstart`/`drop`), sino
su propio sistema de sensores basado en `mousedown`/`mousemove`/`mouseup`. Se
implementó un comando custom mínimo (`cy.dragAndDrop`, en
`cypress/support/commands.js`) con esa secuencia de eventos y pausas cortas
entre ellos, sin añadir dependencias de terceros.

## Cambios de frontend

Se añadieron atributos `data-cy` únicamente donde hacían falta para localizar
columnas y tarjetas de forma estable: `StageColumn.js` (`data-cy="stage-column"`,
`data-cy-stage`) y `CandidateCard.js` (`data-cy="candidate-card"`,
`data-cy-candidate`). El título de la posición se verifica por su texto
existente (`<h2>`), sin modificar `PositionDetails.js`.

## Fuera de alcance

No se corrigieron bugs preexistentes no relacionados con estos dos escenarios
(p. ej. `GET /candidates/:id/interviews` inexistente, `frontend/jest.config.js`
faltante, mutación in-place en `onDragEnd`).
