# Prompts iniciales — Pruebas E2E con Cypress

## Descripción

Registro de prompts, decisiones, discrepancias y correcciones usadas para el ejercicio de pruebas End-to-End de la interfaz `position` con Cypress. Incluye cómo ejecutar las pruebas y por qué cada hallazgo de revisión se resolvió (o se dejó fuera de alcance).

---

## Índice

- [Contexto entregado al agente](#contexto-entregado-al-agente)
  - [Archivos leídos](#archivos-leídos)
  - [Restricciones](#restricciones)
- [Prompt de planificación](#prompt-de-planificación)
- [Prompt de exploración del contrato](#prompt-de-exploración-del-contrato)
  - [Discrepancias del enunciado frente al código](#discrepancias-del-enunciado-frente-al-código)
  - [Datos del seed usados en las pruebas](#datos-del-seed-usados-en-las-pruebas)
- [Prompt de implementación](#prompt-de-implementación)
- [Prompt de corrección tras revisión](#prompt-de-corrección-tras-revisión)
- [Decisiones técnicas](#decisiones-técnicas)
- [Hallazgos de revisión y justificación](#hallazgos-de-revisión-y-justificación)
- [Cómo ejecutar las pruebas](#cómo-ejecutar-las-pruebas)
  - [Navegador de verificación](#navegador-de-verificación)
- [Checklist de verificación](#checklist-de-verificación)
- [Lo que no se delegó a la IA](#lo-que-no-se-delegó-a-la-ia)
- [Inventario de archivos](#inventario-de-archivos)

---

## Contexto entregado al agente

Antes de pedir código se entregó el material del Módulo 11, se levantó la aplicación sin cambios y se pidió un **plan** antes de implementar. Tras una primera entrega se pidió corregir hallazgos de revisión y documentar el porqué.

### Archivos leídos

| Ruta | Para qué |
|---|---|
| `frontend/src/App.js` | Ruta real `/positions/:id` |
| `frontend/src/components/PositionDetails.js` | Carga del Kanban y PUT al cambiar de fase |
| `frontend/src/components/StageColumn.js` | Columnas de fase |
| `frontend/src/components/CandidateCard.js` | Tarjetas arrastrables |
| `backend/src/index.ts` | Prefijo `/candidates` |
| `backend/src/routes/candidateRoutes.ts` | `PUT /:id` |
| `backend/src/routes/positionRoutes.ts` | `GET /:id/interviewflow` y `GET /:id/candidates` |
| `backend/prisma/seed.ts` | Nombres de posición, fases y candidatos |

### Restricciones

- No reescribir el Kanban; solo cambios de frontend necesarios para tests estables y para los hallazgos de revisión.
- No tocar el backend (rutas ni seed).
- Spec en `cypress/integration/position.spec.js`, como pide el enunciado.
- No hacer commit, push ni Pull Request hasta que se pida.

---

## Prompt de planificación

```
Lee el enunciado de Pruebas E2E con Cypress y el código actual de position.
Dame un plan para el ejercicio: escenarios, archivos, riesgos y orden de trabajo.
No implementes todavía.
```

**Salida:** plan con instalación de Cypress, dos bloques de pruebas (carga y cambio de fase), intercept del PUT real, `prompts-iniciales.md` y entrega Git al final.

---

## Prompt de exploración del contrato

```
Contrasta el PDF del ejercicio con las rutas reales del backend y con PositionDetails.js.
Lista discrepancias de URL, body del PUT y datos del seed de la posición 1.
No escribas código todavía.
```

### Discrepancias del enunciado frente al código

| Enunciado (PDF) | Código real | Qué debe usar el test y por qué |
|---|---|---|
| `PUT /candidate/:id` | `PUT /candidates/:id` | **La ruta real.** El PDF está desactualizado. Un intercept al singular nunca vería la petición del frontend |
| Carpeta `/cypress/integration` | Cypress 10+ usa `e2e` por defecto | `specPattern` apunta a `cypress/integration/**/*.spec.js` para cumplir el enunciado |
| GET de flujo | `GET /positions/:id/interviewflow` (minúsculas en la ruta Express) | Frontend e intercept alineados a `interviewflow`; el intercept es case-insensitive por si el servidor no distingue mayúsculas |
| GET de candidatos | `GET /positions/:id/candidates` | Igual |
| Fase en GET | `currentInterviewStep` es el **nombre** | Las aserciones de UI buscan el nombre en la columna |
| Fase en PUT | `currentInterviewStep` es el **id numérico** | El body se comprueba con el id resuelto desde el GET de flujo, no hardcodeado |

### Datos del seed usados en las pruebas

Posición `id=1`, título **Senior Full-Stack Engineer**. Los tests identifican fases y candidatos **por nombre**; los ids se leen de la API para no romper si el autoincremento cambia.

| Fase (nombre) | Candidatos esperados al inicio |
|---|---|
| Initial Screening | Carlos García |
| Technical Interview | John Doe, Jane Smith |
| Manager Interview | (vacía) |

`beforeEach` y `afterEach` restauran a Carlos García en Initial Screening buscando su `candidateId` y el id de esa fase en la API.

Ese lookup asume **nombres únicos dentro de la posición 1** (como en el seed). `.find()` se queda con el primer match: dos “Carlos García” en la misma vacante podrían hacer que el test mueva al candidato equivocado. El GET de candidatos no trae email, así que no hay otra clave natural. El acento cuenta: `Carlos García` no es `Carlos Garcia`.

**Por qué no se dejaron los ids 3 y 4 fijos.** Había otra opción: hardcodear `candidateId = 3`, `applicationId = 4`, `stepId = 1` y documentar “solo válido con BD nueva + seed una vez” (Postgres asigna 1, 2, 3… si la tabla estaba vacía). Esa nota no hace el test más correcto: si alguien reutiliza una BD con filas previas, el autoincremento ya no empieza en 1 y el `PUT /candidates/3` da 404 o mueve a otra persona. Buscar por nombre y leer el id de la API es más verboso, pero no depende de ese arranque. El riesgo que sí queda es el de **nombres duplicados** en la misma posición, no el del autoincremento.

---

## Prompt de implementación

```
Implementa el plan de Cypress.

Requisitos:
- Instalar Cypress y dejar el spec en cypress/integration/position.spec.js
- Probar carga: título, columnas y tarjetas en la columna correcta
- Probar drag & drop: la tarjeta cambia de columna y el PUT real actualiza el backend
- Añadir data-testid si hace falta
- Corregir condiciones de carrera que hagan flaky el tablero
- Documentar prompts, discrepancias y cómo ejecutar en prompts/prompts-iniciales.md
- No hagas commit, push ni PR
```

---

## Prompt de corrección tras revisión

```
Arregla los hallazgos de la revisión doble.
Documenta cada cambio y su justificación.
Del PDF vs código: sigue usando PUT /candidates/:id (ruta real).
No toques el backend/seed.
No hagas commit, push ni PR.
Al final vuelve a correr los tests.
```

---

## Decisiones técnicas

| Decisión | Motivo |
|---|---|
| Cypress en la raíz del repo | El enunciado pide `/cypress/integration/position.spec.js`. No se movió a `frontend/` para no romper esa ruta |
| `data-testid` en título, columnas y tarjetas | Selectores estables; un cambio de clase Bootstrap no debe romper E2E |
| `Promise.all` al cargar el tablero | Evitar que candidatos y fases lleguen en distinto orden y dejen el Kanban vacío |
| Comprobar `response.ok` en esa carga | Un 404/500 no debe parsearse como tablero |
| Fetch a `/interviewflow` | Coincide con `positionRoutes.ts`; Express no distingue mayúsculas por defecto, pero el cliente queda alineado al contrato declarado |
| PUT siempre a `/candidates/:id` | Es la ruta montada en Express. El PDF singular no se implementa |
| Rollback si el PUT falla | El arrastre ya movió la tarjeta en el cliente; sin rollback la UI miente |
| Ids de fase/candidato desde la API | Evita tests rotos si el autoincremento no empieza en 1. La alternativa (ids 3 y 4 fijos + “requiere BD nueva”) es más corta y más frágil |
| `afterEach` además de `beforeEach` | El último test no debe dejar la BD distinta al seed |
| `requestAnimationFrame` en vez de `cy.wait(80)` | El drag de `react-beautiful-dnd` necesita un frame de pintado, no un timeout mágico |
| Cypress 16.0.0 sin `^` | Evitar que un `npm install` suba de versión y rompa el runner |
| `cypress:run` con Chrome | Cypress 16 depreca Electron; Chrome es el navegador de verificación |
| `cypress open` no fuerza Chrome | La UI del PDF deja elegir navegador; la evidencia de esta entrega es Chrome headless |
| Intercept GET case-insensitive | Cubre `interviewFlow` e `interviewflow` |

---

## Hallazgos de revisión y justificación

| Hallazgo | Qué se hizo | Por qué |
|---|---|---|
| PDF `PUT /candidate/:id` vs código `PUT /candidates/:id` | Se **sigue** la ruta real. El `it` y un comentario lo explican | El frontend llama a `/candidates`. Testear el singular daría falso negativo |
| Cypress solo en Electron | Script `cypress:run` usa `--browser chrome` | Electron 146 está deprecado en Cypress 16 |
| Suite deja a Carlos en otra fase | `afterEach` lo restaura por nombre | El siguiente run o una revisión manual de la UI verían el seed sucio |
| Checklist todo en `[ ]` | Se marca lo verificado | El documento debe reflejar la evidencia, no un plan vacío |
| `cy.wait(80)` flaky | Espera a frames de pintado + `cy.wait('@updateStage')` | Los waits fijos son la causa típica de flakiness en E2E |
| IDs de seed hardcodeados | Lookup por nombre en GET. No se dejó “ids fijos + seed vacío” | Ids 3/4 solo valen si la BD nació vacía. El nombre no depende del autoincremento; sí asume nombres únicos en la posición 1 |
| `interviewFlow` vs `interviewflow` | Frontend usa `interviewflow`; intercept con `/i` | Alinea cliente y ruta Express sin tocar backend |
| Sin rollback si el PUT falla | Snapshot + `setStages` en el `catch` + test E2E de 500 | Evita que la UI muestre un movimiento que el backend rechazó |
| Cypress `^16.0.0` | Versión fija `16.0.0` | Reproducibilidad |
| Constante de Jane sin usar | Eliminada | Ruido |
| `orderIndex: 2` duplicado en el seed | **No se cambió** | El enunciado y la restricción dicen no tocar backend. El test no ordena por `orderIndex`; usa los nombres de fase que devuelve la API |

---

## Cómo ejecutar las pruebas

Prerrequisitos (tres procesos):

1. PostgreSQL: `docker compose up -d`
2. Backend: `cd backend && npm run dev` → http://localhost:3010
3. Frontend: `cd frontend && npm start` → http://localhost:3000

Desde la **raíz** del repositorio (no desde `frontend/`):

```bash
npx cypress open
```

Modo interactivo: E2E Testing → Chrome → `position.spec.js`.

Headless (el usado para verificar):

```bash
npx cypress run --browser chrome
```

Scripts en el `package.json` raíz: `npm run cypress:open` y `npm run cypress:run`.

Cypress vive en la raíz a propósito: el PDF pide `/cypress/integration/position.spec.js`.

### Navegador de verificación

El enunciado pide `npx cypress open`. Ese comando abre la UI y **tú eliges** el navegador; no está “mal configurado” por no fijar Chrome.

| Comando | Navegador | Uso |
|---|---|---|
| `npm run cypress:run` / `npx cypress run --browser chrome` | Chrome (headless) | Verificación de esta entrega. Pasó 5/5, dos veces |
| `npx cypress open` | El que se seleccione en la UI | Seguir el PDF. Elegir **Chrome** para alinearlo con la verificación |
| Electron | Disponible en la UI | También pasó en un run anterior. Cypress 16 lo marca deprecado |
| Firefox / Edge | No se ejecutaron | El drag sintético puede comportarse distinto; no hay evidencia de fallo ni de que pasen |

No significa que el spec falle en otros navegadores. Significa que **solo se validó Chrome (y antes Electron)**. Un revisor que en `cypress open` elija Firefox no está usando el mismo motor que la evidencia del PR.

---

## Checklist de verificación

- [x] Frontend en http://localhost:3000 y backend en http://localhost:3010
- [x] Spec en `cypress/integration/position.spec.js`
- [x] Carga: título `Senior Full-Stack Engineer`
- [x] Carga: columnas por nombre de fase (Initial Screening, Technical Interview, Manager Interview)
- [x] Carga: Carlos García en Initial Screening; John Doe y Jane Smith en Technical Interview
- [x] Drag: intercept `PUT /candidates/:id` (ruta real, no la del PDF) con `applicationId` y `currentInterviewStep` resueltos desde la API
- [x] Drag: tras recargar, Carlos García sigue en Technical Interview
- [x] Rollback: si el PUT responde 500, la tarjeta vuelve a Initial Screening
- [x] `beforeEach` + `afterEach` restauran a Carlos García por nombre
- [x] `npx cypress run --browser chrome` (re-ejecutado tras las correcciones)
- [x] Documentado: `cypress open` deja elegir navegador; la evidencia es Chrome

---

## Lo que no se delegó a la IA

- Contrastar `PUT /candidate/:id` del PDF con `PUT /candidates/:id` del código y **quedarse con el código**
- No “arreglar” el PDF implementando la ruta singular
- No modificar el seed (`orderIndex` duplicado) porque el backend está fuera de alcance
- Confirmar que GET habla de **nombres** de fase y PUT de **ids**
- No hacer commit ni PR hasta aprobación
- Revisar el resultado de Cypress en máquina local, no solo el spec generado

---

## Inventario de archivos

| Archivo | Cambio |
|---|---|
| `cypress.config.js` | Configuración E2E, `baseUrl` y `specPattern` |
| `cypress/integration/position.spec.js` | Carga, persistencia del PUT real, rollback y lookup por nombre |
| `cypress/support/e2e.js` | Soporte de Cypress |
| `cypress/support/commands.js` | Drag con `requestAnimationFrame`, reset y board por nombre |
| `package.json` | Cypress 16.0.0 fijo y `cypress:run` con Chrome |
| `.gitignore` | Vídeos y capturas de Cypress |
| `frontend/src/components/PositionDetails.js` | Carga atómica, `interviewflow`, rollback, `data-testid` del título |
| `frontend/src/components/StageColumn.js` | `data-testid` de columna |
| `frontend/src/components/CandidateCard.js` | `data-testid` de tarjeta |
| `prompts/prompts-iniciales.md` | Este archivo |
