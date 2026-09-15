# Prompts iniciales — Pruebas E2E con Cypress (interfaz "position")

**Autor:** Ariel Fonseca — GitHub: [@afonsecanice](https://github.com/afonsecanice)  
**Módulo:** 11 · AI4Devs QA · Repo base: `AI4Devs-qa-2606-roo`  
**Herramientas:** Claude Code (Opus 4.8) para diseño, implementación de las pruebas E2E y control de calidad  
**Fecha:** 2026-09-14 · actualizado 2026-09-15

> Registro de **nuestros** prompts, decisiones y proceso en el Módulo 11 (AI4Devs QA —
> pruebas E2E con Cypress sobre la interfaz "position", el tablero kanban del proceso de
> contratación). Describe lo que diseñamos y ejecutamos en este repositorio, no una guía
> genérica del curso.

Este documento registra **cómo usé la IA** para construir las pruebas E2E: la
descripción del ejercicio, la estrategia, la secuencia de prompts que fui dando,
los hallazgos que aparecieron en el camino y la evidencia de ejecución. La idea es
que cualquiera pueda reproducir el proceso, no solo el resultado.

---

## 0. Para el revisor (60 segundos)

**Validación en un comando** (mínimo del enunciado + suite ampliada):

```bash
cd frontend && npm install && npm run e2e          # 14 pruebas (regresión + caracterización)
cd frontend && npm run e2e:enunciado               # solo position.spec.js (12) — rubric estricto
```

**Trazabilidad:** prompts (este archivo) · specs · fixtures · CI · [informe de defectos](../frontend/cypress/informe-defectos.md).

### Enunciado → evidencia (PASS)

| Requisito del enunciado | Dónde se cumple |
|-------------------------|-----------------|
| Título de la posición | `position.spec.js` — `it` «muestra el título…» |
| Columnas por fase | `it` «muestra una columna por cada fase…» |
| Tarjetas en la columna correcta | `it` «coloca cada tarjeta…» + fixtures `candidates.json` |
| Drag entre columnas | `cy.dragCandidate` en `support/commands.js` + escenario B |
| Persistencia en API | Assert `PUT /candidates/:id` (método, URL, `Content-Type`, body) |
| `prompts-iniciales.md` en `/prompts` | Este archivo |
| `position.spec.js` en `cypress/integration` | `frontend/cypress/integration/position.spec.js` |

### Mínimo vs lo que añadimos (por qué no es “solo pasar el ejercicio”)

| Enunciado pide | Nosotros entregamos además |
|----------------|----------------------------|
| 3 checks de carga + 1 flujo drag/PUT | 12 regresiones en `position.spec.js` (retroceso, saltos, detalle, conteo, rating, resiliencia, Escape) |
| Cypress sobre position | **Informe de 9 defectos** reales + **2 tests de caracterización** (D-01/D-02 reproducibles) |
| — | **CI** (GitHub Actions) + script `npm run e2e` + `data-testid` en componentes |
| — | **Auditoría escéptica** documentada (Prompt 8 + dogfooding) y determinismo sin depender de `retries` |
| — | Mock dev `npm run mock:api` para demo manual sin Docker |

**Postura de QA:** la suite no solo confirma el happy path; demuestra que **encontramos fallos reales**
del producto y los dejamos trazables antes de “arreglarlos en otro ticket”.

---

## 1. Descripción del ejercicio

Probar de inicio a fin la interfaz **"position"** (`/positions/:id`, componente
`frontend/src/components/PositionDetails.js`): un tablero tipo Kanban donde cada
columna es una fase del proceso de contratación y las tarjetas son candidatos que
se arrastran de una fase a otra.

Escenarios requeridos por el enunciado:

1. **Carga de la página de Position**
   - El título de la posición se muestra correctamente.
   - Se muestran las columnas de cada fase del proceso.
   - Las tarjetas aparecen en la columna correcta según su fase actual.
2. **Cambio de fase de un candidato**
   - Simular el arrastre de una tarjeta de una columna a otra.
   - Verificar que la tarjeta se mueve a la nueva columna.
   - Verificar que la fase se actualiza en el backend mediante `PUT /candidate/:id`
     *(texto del enunciado)* — en el código y en las pruebas: `PUT /candidates/:id`.

**Entrega (contenido del repo):** cambios bajo `/frontend`, este archivo en
`/prompts`, y `position.spec.js` en `cypress/integration`. El canal de entrega del
curso es un PR; **el valor evaluable está en el repo** (specs, prompts, CI y evidencia §6).

---

## 2. Estrategia (y por qué)

Antes de escribir una sola prueba, decidí con la IA el enfoque:

- **Mockear el backend con `cy.intercept` + fixtures** en lugar de levantar
  Docker + Postgres + seed. Motivo: las pruebas E2E deben ser **deterministas** y
  ejecutables en cualquier máquina y en CI, sin depender del estado de una base de
  datos. Aun así **valido el contrato real** del `PUT` (URL, método y cuerpo), que
  es lo que pide el escenario 2c.
- **Arrastre por teclado.** La vista usa `react-beautiful-dnd`; su sensor de mouse
  depende de timings de animación difíciles de reproducir de forma estable en
  Cypress. El sensor de **teclado** (Space = levantar, Flechas = mover, Space =
  soltar) es fiable y accesible. Lo encapsulé en un comando reutilizable.
- **Selectores por `data-testid`**, no por clases de Bootstrap, para que las
  pruebas no se rompan si cambia el maquetado.

---

## 3. Secuencia de prompts

> Cada prompt sigue una estructura profesional propia: **rol, objetivo,
> instrucciones, reglas, entregable y siguiente paso**. Son **iterativos** —cada uno
> parte del resultado del anterior— y cada entregable se **verifica ejecutando**,
> nunca por confianza en el texto del modelo.

### Prompt 1 — Diagnóstico de la interfaz (antes de escribir nada)
```
Actúa como Senior QA Engineer especializado en pruebas End-to-End.
No conozco este proyecto. Antes de escribir una sola prueba, diagnostica la
interfaz "position":
1. Qué ruta la renderiza y en qué componente.
2. Qué endpoints consume (método + URL) para pintar columnas y tarjetas.
3. Cómo se dispara el cambio de fase hacia el backend (endpoint y payload exactos).
4. Qué librería de drag & drop usa y qué implica para poder testearla.
5. Dónde están los mayores riesgos de calidad de esta vista.
Limítate a estos archivos:
- frontend/src/App.js
- frontend/src/components/PositionDetails.js
- frontend/src/components/StageColumn.js
- frontend/src/components/CandidateCard.js
- frontend/src/components/CandidateDetails.js
Reglas: no modifiques archivos, no generes pruebas todavía, no supongas nada que no
esté en el código.
Devuelve: diagnóstico, flujo de datos, endpoints exactos, riesgos y el siguiente
prompt recomendado.
```
**Resultado:** ruta `/positions/:id` → `PositionDetails.js`; consume
`GET /positions/:id/interviewFlow` y `GET /positions/:id/candidates`; el cambio de
fase hace `PUT /candidates/:id` en `onDragEnd`; DnD con `react-beautiful-dnd`.

### Prompt 2 — Estrategia de pruebas (decisión arquitectónica)
```
Actúa como QA Architect. Con el diagnóstico anterior, define la estrategia E2E más
robusta y determinista para la interfaz "position", cubriendo (A) carga de página y
(B) cambio de fase por drag & drop.
Objetivo: pruebas que corran en cualquier máquina y en CI, sin depender de la base
de datos, pero verificando de verdad la llamada al backend.
Analiza y decide, justificando cada punto:
1. Backend real vs mock (cy.intercept + fixtures): pros/contras y elección.
2. Cómo simular el drag de react-beautiful-dnd de forma estable en Cypress.
3. Estrategia de selectores (accesibles / data-testid vs clases CSS).
4. Aislamiento e independencia entre pruebas.
Reglas: prioriza determinismo y mantenibilidad; nada de datos reales ni PII.
Devuelve: estrategia elegida con justificación, estructura de carpetas propuesta y
el siguiente prompt recomendado.
```
**Resultado:** `cy.intercept` + fixtures; drag por teclado; `data-testid`; assert
del contrato real del `PUT`.

### Prompt 3 — Fixtures y escenario de carga (spec primero)
```
Actúa como QA Engineer. Genera las fixtures y el bloque de pruebas de carga (A).
Objetivo: fixtures con la forma EXACTA que consume PositionDetails.js y los 3
checks del escenario A.
Instrucciones:
1. Fixtures interviewFlow.json y candidates.json respetando:
   - En `interviewFlow.json` (raíz del fixture): `interviewFlow.positionName` y
     `interviewFlow.interviewFlow.interviewSteps[].{id,name}` — tras
     `response.json()` el componente lee `data.interviewFlow.*` (el backend envuelve
     la respuesta en `{ interviewFlow: … }`).
   - candidatos con candidateId/fullName/averageScore/applicationId y
     currentInterviewStep = NOMBRE de la fase (no el id).
2. Spec con cy.intercept (GET interviewFlow + GET candidates) y 3 pruebas: título,
   una columna por fase, y cada tarjeta en la columna de su fase.
3. Estilo BDD (Given/When/Then) y selectores por data-testid.
Reglas: usa datos sintéticos; no toques el código de producción salvo para añadir
los data-testid necesarios.
Devuelve: fixtures, spec inicial y la lista de data-testid a añadir en los componentes.
```
**Resultado:** `interviewFlow.json`, `candidates.json` y los primeros `it()` del
escenario A.

### Prompt 4 — Drag & drop y verificación del backend (el reto técnico)
```
Actúa como experto en Cypress y react-beautiful-dnd.
Objetivo: arrastrar una tarjeta entre columnas de forma fiable y verificar la
persistencia en el backend (escenario B).
Instrucciones:
1. Implementa el drag con el sensor de TECLADO (Space = levantar, Flechas = mover,
   Space = soltar), no con mouse sintético; justifica por qué es más estable.
2. Encapsúlalo en un comando reutilizable cy.dragCandidate(draggableId, direction,
   steps) y un helper cy.stageColumn(title).
3. Escenario B en Given/When/Then: mover una tarjeta a la derecha y verificar
   (a) que queda en la nueva columna y (b) que se llamó a PUT /candidates/:id con el
   cuerpo EXACTO { applicationId, currentInterviewStep } y tipos correctos.
Reglas: el test debe fallar de forma RUIDOSA si el drag o el PUT no ocurren; nada
de aserciones que pasen con la app rota.
Devuelve: commands.js, el escenario B y las suposiciones hechas sobre el contrato
del PUT.
```
**Resultado:** `cypress/support/commands.js` con `cy.dragCandidate` /
`cy.stageColumn` y el escenario B completo (movimiento + assert del PUT).

### Prompt 5 — Ejecutar y verificar de verdad (no suponer)
```
Actúa como QA Engineer riguroso. No quiero suponer que las pruebas pasan.
Instrucciones:
1. Instala Cypress como devDependency.
2. Levanta el frontend y ejecuta la suite headless de verdad.
3. Muéstrame la salida real (verde/rojo); si algo falla, diagnostica y corrige.
Reglas: no des la tarea por hecha hasta ver la suite en verde EJECUTADA, no a
partir del texto generado por el modelo.
Devuelve: la salida real de la corrida y el estado final.
```
**Resultado:** `4/4` en verde en la primera ejecución real (solo escenarios mínimos A+B
del enunciado; el estado final de la suite está en §6).

### Prompt 6 — Elevar a estándar profesional (buenas prácticas del módulo)
```
Actúa como Tech Lead de QA. Eleva la calidad aplicando las buenas prácticas del
módulo.
Instrucciones:
1. Sustituye selectores por clases de Bootstrap por data-testid en los componentes
   (título, columnas, tarjetas, panel de detalle) y migra el spec.
2. Añade escenarios de valor: conteo por columna, retroceder de fase, saltar varias
   columnas de una vez y abrir el panel de detalle del candidato.
3. Configura retries en modo CI y deja el build sin warnings.
Reglas: no cambies el comportamiento de la app; los data-testid son aditivos.
Devuelve: diff de componentes, spec ampliado y una nueva corrida en verde.
```
**Resultado:** `data-testid` en 4 componentes; +4 escenarios; `import` sin usar
eliminado; `retries: 2` en CI. Nueva ejecución en esa iteración: **8/8 en verde**
(antes de Prompt 7, dogfooding y caracterización → **14/14** en §6).

### Prompt 7 — Automatización e infraestructura (DevEx + CI/CD)
```
Actúa como Ingeniero de Developer Experience.
Objetivo: que cualquiera ejecute las E2E sin fricción y que CI las valide.
Instrucciones:
1. Script de un solo paso que levante el server y corra las pruebas
   (start-server-and-test).
2. Workflow de GitHub Actions que ejecute las E2E en cada push y PR, subiendo
   screenshots si algo falla.
3. Documenta cómo ejecutar en un README de la carpeta cypress.
Reglas: usa el navegador disponible por defecto; no rompas el npm start del proyecto.
Devuelve: scripts de package.json, .github/workflows/e2e.yml y el README.
```
**Resultado:** scripts `e2e` / `e2e:open`, `.github/workflows/e2e.yml` y
`frontend/cypress/README.md`.

### Prompt 8 — Auditoría independiente (cazar la falsa confianza)
```
Actúa como revisor QA escéptico e independiente. No modifiques nada; solo lee.
Objetivo: confirmar que cumplimos el enunciado y que NO hay aserciones de falsa
confianza (tests que pasarían aunque la app estuviera rota).
Instrucciones:
1. Mapea cada requisito del enunciado a archivo:línea con veredicto PASS/FAIL.
2. Verifica que las fixtures calzan EXACTO con lo que consume el componente.
3. Verifica que la aserción del PUT refleja el request real (URL, método, cuerpo,
   tipos).
4. Señala riesgos reales y brechas, del más importante al menos.
Devuelve: checklist PASS/FAIL con evidencia, lista de riesgos y veredicto final.
```
**Resultado:** veredicto **PASS** en todo el rubric; fixtures y contrato del PUT
verificados; sin aserciones de falsa confianza. (Ajuste menor tras la auditoría:
`cy:open` dejó de forzar `--browser chrome`.)

### Evaluación del catálogo (dogfooding)

Ejecuté el propio catálogo para comprobar que los prompts elicitan lo esperado:
los prompts 1 y 2 los corrí con **ejecutores independientes** (sin contexto previo,
solo el repo); el 5 lo ejecuté de verdad (suite en verde); el 8 fue la auditoría
independiente ya realizada.

**Las respuestas convergieron con la implementación** (señal de que los prompts son
correctos) y además destaparon mejoras reales que **apliqué al suite** (regresión de
8 → 12 pruebas, más 2 de caracterización):

- Camino negativo: **arrastre cancelado (Escape) no dispara el PUT** (prueba el
  guard `if (!destination) return`), con sincronización por estado del placeholder rbd.
- **Resiliencia:** fallo `500` y lista vacía de candidatos → el tablero no se rompe.
- **Valoración** por candidato renderizada según `averageScore`.
- Aserción de **headers** del PUT (`Content-Type: application/json`).
- Último selector por clase de Bootstrap (`.offcanvas-title`) migrado a `data-testid`.

Tras una segunda auditoría independiente se cerraron además estos huecos:

- **Determinismo (crítico):** el `beforeEach` ahora **fuerza el orden de resolución**
  (interviewFlow antes que candidates) para no ser vulnerable al defecto D-01; la carga
  deja de depender de `retries`.
- **Sin `cy.wait` fijos como sincronización:** `dragCandidate` espera por estado
  (aparición/desaparición del placeholder de rbd); solo queda un tick acotado y
  justificado entre movimientos de flecha.
- **Reproducciones auditables:** D-01 y D-02 se conservan como **tests de
  caracterización** ejecutables (`cypress/integration/defectos-conocidos.spec.js`),
  listos para invertirse a regresión cuando se corrijan.

**Refinamientos a los prompts (v2)** detectados al ejecutarlos:

- **Prompt 1:** ampliar el scope a `frontend/package.json` y a las rutas del backend
  (para verificar el contrato real y la versión de `react-beautiful-dnd`, hoy
  deprecada); pedir riesgos **priorizados** (severidad/probabilidad) e **inventario
  de `data-testid`** disponibles.
- **Prompt 2:** exigir explícitamente la aserción del **contrato del PUT** (body +
  URL + método + **headers** + mapeo fase→`stepId`), **evitar `cy.wait(ms)` como
  sincronización de red** (usar aliases y estado del DOM; el tick del sensor de teclado
  de rbd es la única excepción documentada) y añadir **casos negativos** (GET 4xx/5xx,
  lista vacía, drop sin destino) con criterios de aceptación.

---

## 4. Hallazgos durante el proceso

- **El endpoint real es plural: `PUT /candidates/:id`.** El enunciado lo cita como
  `/candidate/:id`. Las pruebas verifican el **endpoint real** del código
  (`PositionDetails.js`), no el del texto.
- **Mismo nombre de campo, distinto significado según la operación:**
  - En el **GET** `/positions/:id/candidates`, `currentInterviewStep` es el **nombre**
    de la fase (`string`); el componente filtra con
    `candidate.currentInterviewStep === stage.title`. Las fixtures respetan eso.
  - En el **PUT** `/candidates/:id`, `currentInterviewStep` es el **`stepId` numérico**
    de la columna destino (`destStageId` en `onDragEnd`), no el nombre. El cuerpo lleva
    `Number(applicationId)` y `Number(stepId)`; el assert del escenario B usa
    `deep.equal` con esos enteros (p. ej. fase "Technical Interview" → `2`).
- **La app no usa `React.StrictMode`** (`index.tsx`), lo cual es bueno: StrictMode
  rompe silenciosamente los `Droppable` de react-beautiful-dnd en React 18. Por eso
  el drag por teclado es estable aquí.

---

## 5. Cómo ejecutar

Requiere Node.js. **No** se necesita backend ni base de datos (están mockeados).

Un solo comando (levanta el frontend, corre las pruebas y lo apaga):
```bash
cd frontend
npm install       # postinstall descarga el binario de Cypress
npm run e2e         # headless — suite completa (14)
npm run e2e:enunciado  # solo enunciado (12) — position.spec.js
npm run e2e:open    # modo interactivo
```

O en dos terminales (equivalente al enunciado):
```bash
cd frontend
npm start           # terminal 1  -> http://localhost:3000
npx cypress open    # terminal 2  (o: npm run cy:run)
```

En **Windows**, si el puerto 3000 ya está en uso, usa las dos terminales o libera
el puerto antes de `npm run e2e` (ver `frontend/cypress/README.md`).

**Ver la UI en el navegador** (sin Docker): terminal aparte `cd frontend && npm run mock:api`
(API en `:3010` con las fixtures de Cypress).

**Stack real** (Docker + Postgres + backend): copia `.env.example` → `.env`, `docker compose up -d`,
luego en `backend/`: `npm install`, `npm run build`, `npx prisma migrate deploy`, `npm run db:seed`,
`npm start` (`:3010`). Si `5432` está ocupado, cambia `DB_PORT` y `DATABASE_URL` (ver `.env.example`).

---

## 6. Resultado

```
Interfaz Position - Pruebas E2E
  1. Carga de la página de Position
    √ muestra el título de la posición
    √ muestra una columna por cada fase del proceso de contratación
    √ coloca cada tarjeta de candidato en la columna de su fase actual
    √ muestra el número correcto de tarjetas por columna
    √ renderiza la valoración de cada candidato
  2. Cambio de fase de un candidato (drag & drop)
    √ mueve la tarjeta a la nueva columna y persiste la fase con PUT /candidates/:id
    √ no persiste ningún cambio si el arrastre se cancela con Escape
    √ permite retroceder de fase y persiste el cambio
    √ mueve una tarjeta a través de varias columnas de una vez
  3. Detalle del candidato
    √ abre el panel de detalle al hacer clic en una tarjeta
Interfaz Position - Resiliencia
  √ muestra las columnas pero sin tarjetas si la carga de candidatos falla (500)
  √ renderiza el tablero vacío cuando no hay candidatos

  12 passing

Caracterización de defectos conocidos (interfaz position)   [defectos-conocidos.spec.js]
  √ D-01: si /candidates responde antes que /interviewFlow, el tablero queda sin candidatos
  √ D-02: si el PUT falla (500), la tarjeta queda movida sin rollback ni aviso

  2 passing
```

Total: **14 pruebas** (12 de regresión + 2 de caracterización), verificadas en verde.

---

## 7. Buenas prácticas del módulo aplicadas

Mapeo explícito entre lo enseñado en las lecciones del Módulo 11 y **dónde** lo
apliqué en esta entrega. Aquí queda integrado también lo entregado **por encima del
mínimo**: cada extra está enganchado a la buena práctica que lo justifica.

### Lección 1 — Pruebas de Integración y E2E

| Enseñanza | Cómo lo apliqué (incl. extras sobre el mínimo) | Evidencia |
|-----------|-----------------|-----------|
| "Selectores accesibles antes que CSS frágiles" (`getByTestId`) | `data-testid` en los componentes y en el spec, en vez de clases de Bootstrap | `src/components/*.js`, `position.spec.js` |
| Cobertura del **flujo de usuario**, no solo del happy path | 12 pruebas de regresión: carga, drag (avanzar / retroceder / saltar columnas), detalle, conteo por columna y valoración | `position.spec.js` |
| **Casos negativos y de error** (parte de una suite robusta) | Arrastre **cancelado con Escape** (no dispara PUT) + **resiliencia** ante `500` y lista vacía de candidatos | `position.spec.js` |
| **Determinismo** real (no "verde por suerte" ni apoyado en `retries`) | `beforeEach` **fuerza el orden de resolución** de la red y `dragCandidate` **sincroniza por estado** (placeholder de rbd); verificado con 3 corridas seguidas 14/14 | `position.spec.js`, `support/commands.js` |
| Verificar el **contrato real** aunque el backend esté mockeado | Aserción de método + URL + **headers** + cuerpo exacto del `PUT` | `position.spec.js` |
| Automatización en CI/CD (GitHub Actions) | Workflow que corre las E2E en cada push y PR, con **screenshots** subidos solo si algo falla; además script `npm run e2e` de un solo paso | `.github/workflows/e2e.yml`, `package.json` |
| Datos de prueba realistas con **fixtures** | Respuestas del backend servidas desde fixtures con forma real | `cypress/fixtures/*.json` |
| **Independencia entre tests** (aislado, cualquier orden) | `beforeEach` revisita la página y registra los intercepts por prueba; test isolation de Cypress | `position.spec.js` |
| **Mantenibilidad**: build limpio | Imports sin usar eliminados → **0 warnings** de compilación | `PositionDetails.js`, `AddCandidateForm.js` |
| Flujo con IA: describir en NL → el agente escribe/ejecuta/refina → **el humano revisa y aprueba** | Documenté los prompts y sometí el resultado a **dos revisiones independientes** antes de darlo por bueno | Este documento (§3) |
| Riesgo **GDPR**: no enviar datos reales/PII a un LLM; usar datos seed/sintéticos | Backend mockeado con datos **sintéticos** (John Doe, etc.); cero PII/producción | `cypress/fixtures/*.json` |

### Lección 2 — BDD

| Enseñanza | Cómo lo apliqué | Evidencia |
|-----------|-----------------|-----------|
| Escenarios en **Gherkin (Given/When/Then)** legibles por negocio | `describe/context/it` que se leen como Feature/Escenario + comentarios `Given/When/Then` dentro de las pruebas | `position.spec.js` |
| Especificaciones claras del comportamiento esperado | Cada `it()` describe una conducta observable (mueve, persiste, muestra), no detalles de implementación | `position.spec.js` |

> Nota: mantuve BDD a nivel de **estilo y estructura** (sin añadir Cucumber) por
> ser lo proporcionado al alcance del ejercicio; si se quisiera formalizar, el
> siguiente paso natural sería `@badeball/cypress-cucumber-preprocessor` con
> archivos `.feature`.

### Lección 3 — Testing Asistido por IA

| Enseñanza | Cómo lo apliqué | Evidencia |
|-----------|-----------------|-----------|
| **Trazabilidad de prompts:** versiona los prompts junto al código | Este `prompts-iniciales.md` versionado en el repo, con la secuencia real | `prompts/prompts-iniciales.md` |
| **No-determinismo:** nada a CI sin revisión humana + estabilidad | Revisión humana del diff + `retries: 2` en modo CI | `cypress.config.js` |
| **Sesgos:** incluir dominio, idioma y locale en los prompts | Prompts en español, dominio explícito (ATS/reclutamiento) | Este documento (§3) |
| Self-healing **no es magia**: revisar diffs, no aceptar a ciegas | Revisé cada cambio y **ejecuté las pruebas reales** en vez de confiar en la salida del modelo | Este documento (§5-6) |
| **Cobertura ≠ confianza**: el valor de QA es hallar defectos reales | Informe de **9 defectos** reales del producto (2 reproducidos con Cypress) | `frontend/cypress/informe-defectos.md` |
| **Characterization testing**: congelar el comportamiento actual antes de corregir | D-01 y D-02 como 2 tests de caracterización ejecutables; se **invierten a regresión** al corregir el defecto | `cypress/integration/defectos-conocidos.spec.js` |

---

## 8. Aprendizajes

- En E2E, **mockear el borde (red)** da estabilidad sin renunciar a verificar el
  contrato real de la API.
- Con `react-beautiful-dnd`, **el teclado es la vía fiable** en Cypress; el mouse
  sintético es frágil.
- Los **`data-testid`** son una inversión pequeña que desacopla las pruebas del
  diseño visual y evita falsos rojos por cambios de CSS.
- **No suponer:** cada afirmación ("pasa", "el endpoint es X") se validó ejecutando
  y leyendo la salida real.
