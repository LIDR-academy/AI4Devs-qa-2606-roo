# Bugs encontrados durante las pruebas E2E de la interfaz "position"

> Hallazgos detectados al construir la suite E2E con Cypress
> (`cypress/integration/position.spec.js`).
> Fecha: 2026-09-11 · Cypress 16.0.0 · React 18.3.1 · react-beautiful-dnd 13.1.1
>
> **Ninguno de estos bugs ha sido corregido en este PR.** La suite E2E los rodea de
> forma explícita y documentada; la corrección se propone como trabajo aparte para
> no mezclar cambios de QA con cambios de producto.

## Resumen

| ID | Severidad | Componente | Título | Reproducido |
|----|-----------|------------|--------|-------------|
| BUG-01 | 🔴 Crítica | `PositionDetails.js` | Condición de carrera: ningún candidato se renderiza | ✅ Sí, con Cypress |
| BUG-02 | 🟠 Alta | `PositionDetails.js` | Update optimista sin rollback ni aviso si el `PUT` falla | ✅ Sí, con Cypress |
| BUG-03 | 🟡 Media | `PositionDetails.js` | Mutación directa del estado de React en `onDragEnd` | ⚠️ Por inspección |
| BUG-04 | 🟡 Media | `StageColumn.js` | `droppableId` usa el índice del array, no el id de la fase | ⚠️ Por inspección |
| BUG-05 | 🔵 Baja | Enunciado / backend | El endpoint documentado (`/candidate/:id`) no existe | ✅ Verificado en código |
| BUG-06 | 🔵 Baja | `PositionDetails.js` | URL de la API hardcodeada | ⚠️ Por inspección |
| BUG-07 | 🔵 Baja | `frontend/package.json` | `npm test` falla: falta `jest.config.js` | ✅ Verificado |
| BUG-08 | ⚪ Trivial | Varios | Imports sin usar (warnings de ESLint en cada build) | ✅ Verificado |

---

## BUG-01 · 🔴 Crítica — Condición de carrera: ningún candidato se renderiza

**Dónde:** `src/components/PositionDetails.js:16-57`

**Qué pasa**

El `useEffect` dispara dos peticiones **en paralelo**:

```js
fetchInterviewFlow();   // hace setStages(interviewSteps)
fetchCandidates();      // hace setStages(prevStages => prevStages.map(...))
```

`fetchCandidates` no trae datos propios al estado: **transforma el estado que produce
`fetchInterviewFlow`**. Pero nadie garantiza el orden de resolución.

- Si `/interviewFlow` responde primero → todo funciona.
- Si `/candidates` responde primero → `prevStages` es `[]`, el `.map()` devuelve `[]`,
  y acto seguido `fetchInterviewFlow` sobrescribe el estado con las fases **vacías de
  candidatos**. Las tarjetas se pierden y **no hay reintento**.

**Impacto**

Un tablero vacío en producción, de forma intermitente, sin error en pantalla ni en la
consola. Es el peor tipo de fallo: silencioso y no determinista. La probabilidad crece
cuando `/interviewFlow` es más lenta que `/candidates` — precisamente lo que ocurre bajo
carga o con latencia de red alta.

**Reproducción (verificada)**

```js
it('REPRO: si /candidates responde antes que /interviewFlow, no se pinta ningun candidato', () => {
  cy.intercept('GET', `${API}/positions/1/interviewFlow`, {
    fixture: 'interviewFlow.json',
    delay: 400,          // interviewFlow llega TARDE
  }).as('flow');
  cy.intercept('GET', `${API}/positions/1/candidates`, {
    fixture: 'candidates.json',
    delay: 0,            // candidates llega PRIMERO
  }).as('cands');

  cy.visit('/positions/1');
  cy.wait('@cands');
  cy.wait('@flow');

  cy.get('[data-rbd-droppable-id]').should('have.length', 3);  // columnas OK
  cy.get('.card-title').should('have.length', 0);              // 0 de 4 tarjetas
});
```

**Resultado:** ✅ pasa. Se pintan las 3 columnas y **0 de las 4 tarjetas**.

**Cómo lo rodea la suite**

`visitPosition()` añade `delay: 250` al intercept de `/candidates` para forzar el orden
de resolución. Es una decisión consciente y comentada en el spec, no un sleep arbitrario.
**Si se corrige BUG-01, ese delay puede eliminarse.**

**Corrección propuesta**

Secuenciar las dos llamadas y derivar el estado de una sola fuente:

```js
useEffect(() => {
  const load = async () => {
    try {
      const [flowRes, candRes] = await Promise.all([
        fetch(`${API}/positions/${id}/interviewFlow`),
        fetch(`${API}/positions/${id}/candidates`),
      ]);
      const flow = await flowRes.json();
      const candidates = await candRes.json();

      setPositionName(flow.interviewFlow.positionName);
      setStages(
        flow.interviewFlow.interviewFlow.interviewSteps.map(step => ({
          title: step.name,
          id: step.id,
          candidates: candidates
            .filter(c => c.currentInterviewStep === step.name)
            .map(c => ({ /* ... */ })),
        }))
      );
    } catch (error) {
      setLoadError(error);   // ver BUG-02
    }
  };
  load();
}, [id]);
```

Un solo `setStages` con los dos datasets ya resueltos elimina la carrera por construcción.

---

## BUG-02 · 🟠 Alta — Update optimista sin rollback ni aviso si el `PUT` falla

**Dónde:** `src/components/PositionDetails.js:59-98`

**Qué pasa**

`onDragEnd` mueve la tarjeta en el estado local y *después* llama a
`updateCandidateStep()`. Si el `PUT` falla, el `catch` sólo hace `console.error`:

```js
} catch (error) {
    console.error('Error updating candidate step:', error);
}
```

No hay rollback del estado ni aviso al usuario.

**Impacto**

El reclutador ve la tarjeta en la nueva fase y asume que el cambio se guardó. **No se
guardó.** Al recargar, el candidato vuelve a su fase anterior sin explicación. Es
corrupción de datos percibida: la UI miente sobre el estado del backend. El mismo
problema afecta a los dos `fetch` de carga, que también sólo hacen `console.error`.

**Reproducción (verificada)**

```js
it('REPRO: si PUT /candidates/:id falla con 500, la UI deja la tarjeta movida igualmente', () => {
  cy.intercept('PUT', `${API}/candidates/*`, {
    statusCode: 500,
    body: { message: 'Something broke!' },
  }).as('put');

  // ... carga de la pagina ...
  cy.dragCandidate('1', { direction: 'right' });
  cy.wait('@put').its('response.statusCode').should('equal', 500);

  cy.stageColumn('Technical Interview').should('contain', 'John Doe');      // movida
  cy.stageColumn('Initial Screening').should('not.contain', 'John Doe');    // y ya no esta en origen
  cy.get('[role="alert"], .alert').should('not.exist');                     // sin aviso alguno
});
```

**Resultado:** ✅ pasa. El backend devolvió `500` y la UI muestra el movimiento como exitoso,
en silencio.

**Corrección propuesta**

Guardar el estado previo, revertirlo en el `catch` y mostrar un aviso accesible
(`role="alert"`). Una vez implementado, el REPRO de arriba se convierte en un test de
regresión válido para la suite: invertir las aserciones y añadirlo a
`position.spec.js`.

---

## BUG-03 · 🟡 Media — Mutación directa del estado de React en `onDragEnd`

**Dónde:** `src/components/PositionDetails.js:90-93`

```js
const [movedCandidate] = sourceStage.candidates.splice(source.index, 1);
destStage.candidates.splice(destination.index, 0, movedCandidate);
setStages([...stages]);
```

`sourceStage` y `destStage` son **referencias al estado actual**. El `.splice()` muta
directamente los arrays que React tiene en `stages`. El `[...stages]` posterior es una
copia superficial: crea un array nuevo, pero **los objetos de fase siguen siendo los
mismos**.

**Impacto**

Funciona hoy por casualidad. Rompe en cuanto se introduzca `React.StrictMode` (que
invoca los updaters dos veces en desarrollo), `React.memo` en `StageColumn` (compararía
referencias idénticas y no re-renderizaría), o cualquier característica de modo
concurrente que dependa de la inmutabilidad del estado. También impide implementar el
rollback de BUG-02, porque el estado previo ya fue destruido.

**Nota:** `src/index.tsx` actualmente **no** usa `StrictMode`. Añadirlo —lo habitual en
un proyecto React 18— destaparía este bug.

**Corrección propuesta**

Construir fases nuevas sin mutar:

```js
const next = stages.map((stage, i) => {
  if (i === srcIdx) return { ...stage, candidates: stage.candidates.filter((_, j) => j !== source.index) };
  if (i === dstIdx) return { ...stage, candidates: insertAt(stage.candidates, destination.index, moved) };
  return stage;
});
setStages(next);
```

---

## BUG-04 · 🟡 Media — `droppableId` usa el índice del array, no el id de la fase

**Dónde:** `src/components/StageColumn.js:8` y `src/components/PositionDetails.js:87-95`

```js
<Droppable droppableId={`${index}`}>        // "0", "1", "2"
...
const sourceStage = stages[source.droppableId];   // indexación por string
```

El identificador de la zona de drop es la **posición en el array**, no el `id` real de la
fase. `stages["0"]` funciona por coerción de JavaScript, no por diseño.

**Impacto**

Si el backend devuelve las fases en otro orden, se añade una fase intermedia, o se
filtran fases, los ids de drop cambian de significado silenciosamente. Además obliga al
código a hacer `stages[destination.droppableId].id` para recuperar el id real — un
salto de indirección innecesario y frágil.

**Corrección propuesta**

`droppableId={String(stage.id)}` y buscar con `stages.find(s => String(s.id) === droppableId)`.

---

## BUG-05 · 🔵 Baja — El endpoint documentado no existe

**Dónde:** enunciado del ejercicio vs. `backend/src/routes/candidateRoutes.ts:22` y `backend/src/index.ts:41`

El enunciado pide verificar `PUT /candidate/:id` (singular). El backend monta el router
en `/candidates` (plural):

```ts
app.use('/candidates', candidateRoutes);   // index.ts:41
router.put('/:id', updateCandidateStageController);   // candidateRoutes.ts:22
```

La ruta real es **`PUT /candidates/:id`**. El frontend ya llama a la correcta
(`PositionDetails.js:61`).

**Impacto**

Ninguno en runtime — sólo desalineación entre documentación y código. Se deja constancia
porque la suite E2E asierta contra la ruta **real**, no contra la del enunciado, y esa
decisión debe quedar explícita para quien revise.

---

## BUG-06 · 🔵 Baja — URL de la API hardcodeada

**Dónde:** `src/components/PositionDetails.js:19`, `:35`, `:61`

`http://localhost:3010` está escrito a mano en tres sitios. No hay
`REACT_APP_API_URL` ni fichero de configuración.

**Impacto**

El frontend no se puede desplegar a staging ni producción sin editar el código fuente.
También obliga a los tests E2E a hardcodear el mismo literal.

**Corrección propuesta**

`const API = process.env.REACT_APP_API_URL || 'http://localhost:3010';` en un módulo
compartido.

---

## BUG-07 · 🔵 Baja — `npm test` falla en el frontend

**Dónde:** `frontend/package.json`

```json
"test": "jest --config jest.config.js"
```

El fichero `frontend/jest.config.js` **no existe** en el repositorio. El comando falla
inmediatamente. Además, el proyecto es CRA: el script por defecto debería ser
`react-scripts test`.

**Impacto**

No hay forma de correr los tests unitarios del frontend. Si el pipeline de CI ejecuta
`npm test`, falla siempre.

---

## BUG-08 · ⚪ Trivial — Imports sin usar

**Dónde:** `src/components/PositionDetails.js:3`, `src/components/AddCandidateForm.js:2`

```
src\components\AddCandidateForm.js
  Line 2:31:  'InputGroup' is defined but never used  no-unused-vars
src\components\PositionDetails.js
  Line 3:26:  'Offcanvas' is defined but never used  no-unused-vars
```

Warnings de ESLint en cada build. Ruido que oculta warnings nuevos y legítimos.

---

## Cómo reproducir los hallazgos

Los specs REPRO de BUG-01 y BUG-02 fueron temporales y **no se incluyen en el PR**: un
test que pasa cuando la app está rota no pertenece a una suite de regresión. El código
completo está transcrito arriba; para re-verificarlos, pégalos en
`cypress/integration/` y ejecuta:

```bash
cd frontend
npm run e2e:open
```

Cuando BUG-01 y BUG-02 se corrijan, ambos REPRO deben **invertirse** (aserciones al
revés) e incorporarse a `position.spec.js` como tests de regresión permanentes.
