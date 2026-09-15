# Prompts iniciales — Pruebas E2E con Cypress (position kanban)

**Alumna:** Grizelle Montoya  
**Modelo:** Cursor (agente Composer)  
**Repositorio:** `AI4Devs-qa-2606-roo` · rama `cypress-integration`  
**Fecha:** 14 de septiembre de 2026 (México)

---

## Índice

1. [Descripción del ejercicio](#descripción-del-ejercicio)
2. [Discrepancias enunciado vs código](#discrepancias-enunciado-vs-código)
3. [Prompts utilizados](#prompts-utilizados)
4. [Plan aprobado](#plan-aprobado)
5. [Hallazgos observados (sin corregir en este PR)](#hallazgos-observados-sin-corregir-en-este-pr)
6. [Instrucciones de ejecución](#instrucciones-de-ejecución)
7. [Estructura de archivos](#estructura-de-archivos)
8. [Decisiones técnicas](#decisiones-técnicas)
9. [Resultado de las pruebas](#resultado-de-las-pruebas)
10. [Checklist de verificación](#checklist-de-verificación)
11. [Decisiones propias en el ejercicio](#decisiones-propias-en-el-ejercicio)
12. [Inventario de archivos](#inventario-de-archivos)
13. [Apéndice — Marco M11 y método](#apéndice--marco-m11-y-método)

---

## Descripción del ejercicio

Automatizar con **Cypress** la página de detalle de posición (`/positions/:id`) — tablero kanban del proceso de contratación — mediante pruebas **End-to-End**.

El fork ya incluye el kanban (`PositionDetails.js` + `StageColumn` + `CandidateCard` con react-beautiful-dnd). Este ejercicio **solo añade tests**; no reescribe UI ni backend.

**Escenarios cubiertos (4 tests):**

| Bloque | Qué verifica |
|---|---|
| **Carga** | Título de la posición; una columna por fase (3 headers); tarjetas en la columna correcta |
| **Cambio de fase** | Drag & drop entre columnas; tarjeta en destino; `PUT /candidates/:id` con URL + body correctos |

**Entrega:** PR en `cypress-integration` con cambios en `frontend/` + este archivo. Spec en `frontend/cypress/integration/position.spec.js`.

**Fuera de alcance:** Playwright, BDD/Gherkin, CI, self-healing, modificar kanban/backend, añadir `data-testid`.

---

## Discrepancias enunciado vs código

| Enunciado del curso | Código real del fork | Qué usa el test |
|---|---|---|
| `PUT /candidate/:id` (singular) | `PUT http://localhost:3010/candidates/:id` (plural) | Intercept al **plural** — el singular nunca vería la petición del FE |
| Carpeta `/cypress/integration/…` | Cypress 13+ busca `e2e/` por defecto | `specPattern: 'cypress/integration/**/*.js'` en `cypress.config.js` |
| GET de fases (no detalla shape) | Doble anidamiento `interviewFlow.interviewFlow.interviewSteps` | Fixture replica el shape real |
| URL `interviewFlow` vs `interviewflow` | Express en Windows acepta ambos | Wildcard `**/interview*` en intercept |
| Fase en GET | `currentInterviewStep` = **nombre** (string) | Asserts de UI por nombre de columna |
| Fase en PUT | `currentInterviewStep` = **id numérico** | Assert body `{ applicationId: 4, currentInterviewStep: 2 }` |
| Ruta `/stage` | No existe | Solo `PUT /candidates/:id` |

**Datos del mock (`positionId = 1`):** título *Senior Full-Stack Engineer*; fases Initial Screening, Technical Interview, Manager Interview; Carlos García en Initial Screening; John Doe y Jane Smith en Technical Interview.

---

## Prompts utilizados

Método: prompts cortos (explorar → planear → implementar por fases → cerrar). Gate humano entre plan y código (feedback S10).

> Los bloques usan `npm` genérico (transcripción histórica). El [runbook](#instrucciones-de-ejecución) usa `npm.cmd` / `npx.cmd` en Windows.

### Prompt 1 — Exploración del fork (solo lectura)

**Rol:** Agente de exploración. **Non-goals:** no proponer solución ni escribir tests.

```
Explora el repo AI4Devs-qa-2606-roo (solo este fork). No edites archivos.

Contexto del ejercicio (Módulo 11): automatizar E2E con Cypress la pantalla
/positions/:id — kanban de candidatos por fase, drag & drop que persiste vía PUT.

Necesito contrastar el enunciado del curso con el código real:

1. Rutas UI en App.js — ¿/positions/:id → PositionDetails.js? ¿/, /positions, /add-candidate intactas?
2. Componentes kanban: PositionDetails, StageColumn, CandidateCard; librería DnD y atributos data-rbd-*.
3. URLs exactas FE → BE:
   - GET interview flow (nota: FE puede llamar interviewFlow, BE interviewflow)
   - GET candidates por positionId
   - PUT cambio de fase — ¿existe /stage o solo PUT /candidates/:id?
4. Shape JSON real (doble anidamiento interviewFlow.interviewFlow.interviewSteps).
5. Campos del array candidates: fullName, currentInterviewStep (string nombre fase), candidateId, applicationId.
6. Selectores DOM disponibles sin data-testid: h2, .card-header, .card-title, droppableId por índice.
7. ¿Cypress instalado en frontend/? Puerto CRA.

Non-goals: no proponer solución, no generar tests, no asumir paths del enunciado del curso si el código dice otra cosa.

Formato de salida:
- Tabla hallazgos (aspecto | valor verificado | archivo fuente)
- Diferencias enunciado curso vs runtime (ej. /candidate/:id singular vs /candidates/:id plural)
- Preguntas abiertas que deba resolver yo antes de planear
- Si no estás seguro de un contrato, dilo; no inventes.
```

---

### Prompt 2 — Plan técnico con escenarios Given/When/Then (sin implementar)

**Rol:** Arquitecto de pruebas E2E.

**Outcome:** Plan aprobable con escenarios traducibles a `it()` y estrategia de mocks en frontera.

**Non-goals:** No escribir código. No Playwright. No Gherkin/Cucumber. No CI. No modificar kanban ni backend.

```
Con los hallazgos del Prompt 1 y el enunciado Módulo 11, genera un PLAN DE
IMPLEMENTACIÓN E2E Cypress. NO escribas código todavía.

Primero, escribe los escenarios en Given/When/Then (lenguaje de dominio, no
clicks genéricos). Luego tradúcelos a bloques describe/it:

Escenario 1 — Título de posición
  Given mocks de interview flow y candidates cargados para positionId=1
  When visito /positions/1
  Then veo el título "Senior Full-Stack Engineer" en el h2

Escenario 2 — Columnas por fase
  Given la misma página cargada
  Then veo exactamente 3 columnas con headers Initial Screening, Technical Interview, Manager Interview

Escenario 3 — Tarjetas en fase correcta
  Given candidatos mockeados (John Doe y Jane Smith en Technical Interview; Carlos García en Initial Screening)
  Then cada .card-title está dentro del .card cuyo .card-header coincide con su fase

Escenario 4 — Cambio de fase por drag
  Given Carlos García en Initial Screening (draggable-id=3, droppable-id=0)
  When arrastro la tarjeta a Technical Interview (droppable-id=1)
  Then la tarjeta queda visible en la columna destino
  And el frontend envía PUT /candidates/3 con body { applicationId: 4, currentInterviewStep: 2 }

Setup obligatorio
- npm install cypress@13 --save-dev en frontend/
- cypress.config.js: baseUrl http://localhost:3000, specPattern cypress/integration/**/*.js, video false
- Scripts npm cypress:open y cypress:run

Estabilidad e independencia (Módulo 11)
- cy.intercept() para GET (wildcard **/positions/*/interview*) y GET candidates
- Fixture JSON position-kanban.json con doble anidamiento interviewFlow
- Stub PUT 200 — backend y Postgres NO obligatorios para la suite principal
- Helpers reutilizables setupPositionIntercepts({ stubPut }) + visitPositionPage()
- Cada test ejecutable en aislamiento (beforeEach con visit propio)

DnD (react-beautiful-dnd)
- Escalera: @4tw/cypress-drag-drop → si no dispara PUT → cypress-real-events
- No stubear onDragEnd (bypasea UI = test theater)
- Assert crítico = payload PUT (URL + body), no animación

Restricciones / regresión del PR
- Sin cambios en PositionDetails.js, StageColumn.js, CandidateCard.js
- Sin cambios en backend/src/routes/candidateRoutes.ts
- Diff solo frontend/ + prompts/

Formato de salida:
1. Tabla G/W/T → describe/it propuesto
2. Tabla archivos a crear/modificar
3. Fixture JSON completo (shape real del fork)
4. Selectores y snippet intercept PUT
5. Orden de implementación por fases
6. Riesgos (DnD flaky, path plural, Cypress 13 carpeta e2e vs integration)

Espera mi OK antes de implementar.
```

---

### Plan aprobado

> Respuesta al Prompt 2. Revisé escenario DnD y path plural del PUT; di **OK** antes de pedir código.

- Cypress en **`frontend/`** (CRA + `npm start`). Sin tocar `PositionDetails`, `StageColumn`, `CandidateCard` ni backend.
- **4 tests** en dos `describe`: 3 carga + 1 cambio de fase.
- **Mocks** vía `cy.intercept()` + `position-kanban.json` (GET flow + candidates; stub PUT).
- **DnD:** probar `@4tw/cypress-drag-drop`; si no dispara PUT → `cypress-real-events` (`realMouseDown` → `realMouseMove` encadenados → `realMouseUp`). No stubear `onDragEnd`.
- **Assert crítico:** URL y body del PUT, no solo animación visual.
- **Estabilidad:** 3 runs headless consecutivos antes de cerrar.

---

### Prompt 3 — Setup + suite Carga

**Rol:** Implementador Cypress.

**Outcome:** 3 tests de carga verdes headless, sin DnD todavía.

**Non-goals:** No implementar drag & drop. No tocar componentes React ni backend.

```
Plan aprobado. Implementa la fase 1 del plan (setup + suite Carga, sin DnD):

1. npm install cypress@13 cypress-real-events --save-dev en frontend/
2. cypress.config.js según snippet acordado (specPattern integration/, video false)
3. cypress/support/e2e.js — sin importar plugins DnD todavía
4. position-kanban.json con fixture completo (doble anidamiento interviewFlow)
5. position.spec.js — helpers setupPositionIntercepts + visitPositionPage
6. Solo describe "Position Page — Carga" (Escenarios G/W/T 1–3):
   - título h2 "Senior Full-Stack Engineer"
   - .card-header length 3 + tres nombres de fase
   - John Doe y Jane Smith en columna Technical Interview; Carlos García en Initial Screening

Intercept GET con **/positions/1/interview* y GET candidates; cy.wait aliases antes de asserts.
Cada it() independiente vía beforeEach.

Verificación: npm run cypress:run -- --spec cypress/integration/position.spec.js → 3 passing.
No implementes DnD todavía.
```

---

### Prompt 4 — Suite Cambio de fase + estabilidad

**Rol:** Implementador Cypress + depurador de flakiness.

**Outcome:** 4/4 tests passing, **3 ejecuciones headless consecutivas** sin fallos.

**Non-goals:** No desactivar tests para “hacerlos pasar”. No stubear handlers React.

```
Implementa describe "Position Page — Cambio de fase" (Escenario G/W/T 4):

- visitPositionPage({ stubPut: true }) con intercept PUT y alias @updateStage
- Escenario: Carlos García [data-rbd-draggable-id="3"] → [data-rbd-droppable-id="1"]
  (Initial Screening → Technical Interview, currentInterviewStep: 2 en body)
- Escalera DnD: probar @4tw/cypress-drag-drop; si PUT no se dispara, cypress-real-events
  con realMouseDown, realMouseMove encadenados hacia droppable, wait, realMouseUp
- Validar en intercept:
  expect(req.url).to.include('/candidates/3')
  expect(req.body).to.deep.include({ applicationId: 4, currentInterviewStep: 2 })
- cy.wait('@updateStage', { timeout: 10000 })
- Assert Carlos García visible en columna "Technical Interview"

Quitar imports de plugins no usados. Documentar qué enfoque DnD funcionó.

Verificación de estabilidad (Módulo 11):
  npm run cypress:run -- --spec cypress/integration/position.spec.js
  → repetir 3 veces seguidas; si falla alguna, ajustar y reiniciar contador.

Entrega: 4 passing estables + nota de qué iteración DnD resolvió el PUT.
```

---

### Prompt 5 — Verificación pre-PR

**Rol:** Revisor final antes de abrir el PR.

**Outcome:** Diff acotado, suite estable, evidencia de terminal.

```
Antes de abrir el PR en cypress-integration, confirma:

Checklist regresión
- npm start + navegación manual /positions/1 — kanban funciona igual que antes
- Diff sin cambios en backend/src/routes/candidateRoutes.ts
- Rutas / y /positions cargan sin error de build
- Intercept PUT apunta a http://localhost:3010/candidates/* (plural)

Estabilidad
- npm run cypress:run -- --spec cypress/integration/position.spec.js
- Ejecutar 3 veces seguidas → 12/12 passing

Entrega
- Lista de archivos tocados (solo frontend/ + prompts/)
- Evidencia de terminal del último run
- Decisiones DnD documentadas (qué plugin funcionó, escenario Carlos → derecha)
```

---

## Hallazgos observados (sin corregir en este PR)

Documentados para no mezclar QA con cambios de producto (criterio similar a entregas de peers que reportan bugs sin fix):

| Hallazgo | Impacto | Acción en este PR |
|---|---|---|
| Posible **condición de carrera** en `PositionDetails.js`: `fetchInterviewFlow` y `fetchCandidates` en paralelo; si candidates responde antes, `setStages` puede operar sobre `[]` | Kanban sin tarjetas de forma no determinista | **No corregido** — fuera de alcance (solo tests) |
| Enunciado `PUT /candidate/:id` vs runtime `/candidates/:id` | Test al singular daría falso negativo | Tests usan ruta **real** (plural) |
| `@4tw/cypress-drag-drop` no dispara `onDragEnd` en headless | DnD no llegaba al intercept | Sustituido por `cypress-real-events` |

---

## Instrucciones de ejecución

### Requisitos previos

- Node.js instalado
- **Frontend en `:3000`** (requerido para Cypress)
- **Backend / Postgres no obligatorios** — la suite usa `cy.intercept()` + fixtures

```powershell
cd D:\GitHub\AI4Devs-qa-2606-roo\frontend
npm.cmd install
npx.cmd cypress install    # solo primera vez en Windows si falta Cypress.exe
```

> **PowerShell:** usar `npm.cmd` y `npx.cmd` si `npm` falla por política de ejecución de scripts.

### Scripts disponibles

| Script | Qué hace |
|---|---|
| `npm.cmd start` | CRA en http://localhost:3000 (**requerido**) |
| `npm.cmd run cypress:open` | UI interactiva (enunciado: `npx cypress open`) |
| `npm.cmd run cypress:run -- --spec cypress/integration/position.spec.js` | Headless — evidencia del PR |

**Estabilidad 3× (Módulo 11):**

```powershell
cd D:\GitHub\AI4Devs-qa-2606-roo\frontend
1..3 | ForEach-Object {
  Write-Host "`n========== RUN $_ / 3 =========="
  npm.cmd run cypress:run -- --spec cypress/integration/position.spec.js
  if ($LASTEXITCODE -ne 0) { break }
}
```

**Por qué no `e2e:open` / `start-server-and-test`:** el enunciado pide el mínimo; con mocks no hace falta orquestar backend ni auto-levantar el servidor más allá de `npm start`.

### Modo integración real (opcional)

| Modo | Backend :3010 | Postgres |
|---|---|---|
| **Por defecto (tests)** | No | No — mocks en GET y PUT |
| **Integración real** | `cd backend && npm.cmd run dev` | `docker-compose up -d` + seed si hace falta |

---

## Estructura de archivos

```
frontend/
├── cypress.config.js                 # baseUrl 3000, specPattern → integration/
├── cypress/
│   ├── integration/
│   │   └── position.spec.js          # 4 tests E2E
│   ├── fixtures/
│   │   └── position-kanban.json      # mock interviewFlow + candidates
│   └── support/
│       └── e2e.js                    # cypress-real-events
└── package.json                      # cypress@^13, cypress-real-events; @4tw instalado pero no usado (ver Decisiones técnicas)

prompts/
└── prompts-iniciales.md              # entrega M11
```

---

## Decisiones técnicas

| Decisión | Motivo |
|---|---|
| Cypress en `frontend/` | Ahí vive el CRA; el spec queda en `frontend/cypress/integration/` |
| `cy.intercept()` + fixture | Suite determinista sin Postgres; mock en frontera HTTP (M11) |
| Wildcard `**/interview*` | Cubre `interviewFlow` vs `interviewflow` |
| Sin `data-testid` en FE | Alcance acotado; selectores Bootstrap + `data-rbd-*` |
| `cypress-real-events` sobre `@4tw` | `.drag()` no disparaba PUT en headless |
| Escenario DnD: Carlos → derecha | Más estable que drag izquierda con react-beautiful-dnd |
| Assert PUT (URL + body) | Evitar test theater; contrato backend es señal fiable |
| `.should('have.length', 3)` en columnas | Verificar exactamente una columna por fase |
| No modificar kanban/backend | Separar entrega QA de fixes de producto |

---

## Resultado de las pruebas

**Entorno:** Windows 10.0.26200, Node v24.20.0, Cypress 13.17.0, Electron 118 headless.

```
  Position Page — Carga
    √ muestra el título de la posición
    √ muestra una columna por fase del proceso
    √ ubica cada candidato en la columna de su fase
  Position Page — Cambio de fase
    √ mueve la tarjeta y actualiza el backend

  4 passing (~3s por run)
```

### Estabilidad — 3 runs consecutivos (autora, 14 sep 2026)

| Run | Título | Columnas | Candidatos | DnD + PUT | Resultado |
|---|---|---|---|---|---|
| 1/3 | 941ms | 289ms | 285ms | 1121ms | 4/4 ✓ |
| 2/3 | 924ms | 298ms | 285ms | 1115ms | 4/4 ✓ |
| 3/3 | 971ms | 306ms | 314ms | 1095ms | 4/4 ✓ |

**12/12 tests passing.** DnD estable: 1095–1121ms en los 3 runs.

<details>
<summary>Run 1/3 — salida completa (click para expandir)</summary>

```text
PS D:\GitHub\AI4Devs-qa-2606-roo\frontend> npm.cmd run cypress:run -- --spec cypress/integration/position.spec.js

  Position Page — Carga
    √ muestra el título de la posición (941ms)
    √ muestra una columna por fase del proceso (289ms)
    √ ubica cada candidato en la columna de su fase (285ms)
  Position Page — Cambio de fase
    √ mueve la tarjeta y actualiza el backend (1121ms)

  4 passing (3s)
  √  All specs passed!
```

</details>

---

## Checklist de verificación

**Automatizado (evidencia en este archivo)**

- [x] Spec en `frontend/cypress/integration/position.spec.js`
- [x] Carga: título *Senior Full-Stack Engineer*
- [x] Carga: 3 columnas (Initial Screening, Technical Interview, Manager Interview)
- [x] Carga: John Doe y Jane Smith en Technical Interview; Carlos García en Initial Screening
- [x] DnD: intercept `PUT http://localhost:3010/candidates/*` (plural, no singular del enunciado del curso)
- [x] DnD: body con `applicationId` y `currentInterviewStep` numérico
- [x] Diff sin cambios en `backend/src/routes/candidateRoutes.ts`
- [x] `npm.cmd run cypress:run` — 4/4 passing
- [x] Estabilidad 3× — 12/12 passing

**Manual (Prompt 5 — antes de abrir el PR)**

- [x] Kanban en `/positions/1` sin regresión (`npm.cmd start` + navegador)
- [x] Rutas `/` y `/positions` cargan sin error de build

---

## Decisiones propias en el ejercicio

- Contrastar `PUT /candidate/:id` del enunciado del curso con `/candidates/:id` del código y **quedarme con el código**
- No stubear `onDragEnd` (sería test theater)
- No añadir `data-testid` ni rollback en FE aunque otros peers lo hicieron — alcance solo tests
- Cambiar escenario DnD a Carlos García → derecha tras fallos con `.drag()`
- Reforzar asserts del primer borrador (conteo columnas, URL del PUT)
- Ejecutar 3 runs headless y registrar tiempos en la evidencia
- Usar `npm.cmd` / `npx.cmd` en Windows tras errores de PowerShell

---

## Inventario de archivos

| Archivo | Cambio |
|---|---|
| `frontend/cypress.config.js` | **Nuevo** — `baseUrl`, `specPattern`, `video: false` |
| `frontend/cypress/integration/position.spec.js` | **Nuevo** — 4 tests E2E |
| `frontend/cypress/fixtures/position-kanban.json` | **Nuevo** — mocks GET |
| `frontend/cypress/support/e2e.js` | **Nuevo** — import `cypress-real-events` |
| `frontend/package.json` | **Modificado** — devDeps Cypress, `cypress-real-events`, scripts; `@4tw/cypress-drag-drop` instalado en escalera DnD pero **no importado** |
| `frontend/package-lock.json` | **Modificado** — lockfile |
| `prompts/prompts-iniciales.md` | **Nuevo** — entrega del ejercicio (prompts + runbook + evidencia) |

**Pendiente antes del PR:** checklist manual (arriba); opcional `npm uninstall @4tw/cypress-drag-drop` en `frontend/`; commit, push y PR desde `cypress-integration`.

---

## Apéndice — Marco M11 y método

| Concepto M11 | Aplicación |
|---|---|
| Given/When/Then | Escenarios en Prompt 2 → 4 `it()` |
| Mock en frontera (`cy.intercept`) | GET + stub PUT; no over-mock React |
| Tests independientes | `beforeEach` + `visitPositionPage()` |
| Estabilidad 3× | Verificado — 12/12 passing |
| Revisión humana | Gate plan → código |
| Test theater (M7) | Assert crítico = payload PUT |

**Qué se curó al armar los prompts:** rol + non-goals por prompt; plan aprobado documentado; contrastar enunciado del curso vs fork; no megaprompt; evidencia reproducible con comando + salida.
