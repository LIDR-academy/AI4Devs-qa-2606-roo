# Pruebas E2E con Cypress — Módulo 11 (AI4Devs)

**Autora:** Cristina Rodríguez (CRN)

**Repositorio base:** [AI4Devs-qa-2606-roo](https://github.com/LIDR-academy/AI4Devs-qa-2606-roo)

**Rama de entrega:** `feature/entrega-e2e-cypress-CRN`

**Fecha límite del ejercicio:** martes 15 de septiembre de 2026, final del día

---

> ## ⚠️ Hallazgos previos — leer antes de ejecutar ningún prompt
>
> Tres cosas detectadas al inspeccionar el código del repositorio y verificar la
> documentación oficial. Condicionan cómo hay que escribir los tests, y saltárselas
> es la forma más rápida de perder una tarde:
>
> **1. El drag & drop de esta app NO se puede simular con el ratón.**
> La pantalla usa `react-beautiful-dnd`, que no implementa la API HTML5 de drag &
> drop. `cy.trigger('dragstart')`, los plugins genéricos de drag y un
> `mousedown`+`mouseup` simple **no hacen absolutamente nada**. Hay que usar el
> **sensor de teclado** de la propia librería: enfocar el asa, `espacio` para
> levantar, `flecha derecha` para cambiar de columna, `espacio` para soltar. Y
> pasando `keyCode`, porque la v13 lee `event.keyCode` y no `event.key`.
> → Detalle en §3, Trampa 1.
>
> **2. El enunciado está escrito para Cypress 9.** Pide crear el spec en
> `/cypress/integration`, carpeta que **desapareció en Cypress 10** (2022). La versión
> actual es **Cypress 16**, con `cypress.config.js` y specs en `cypress/e2e/`. La
> decisión tomada aquí: mantener el nombre de fichero que exige el enunciado
> (`position.spec.js`) en la carpeta moderna, ajustando `specPattern`.
> → Detalle en §3, Trampa 2.
>
> **3. El endpoint del enunciado no existe.** El enunciado dice
> `PUT /candidate/:id` (singular); el endpoint real del proyecto es
> **`PUT /candidates/:id`** (plural), tal y como está montado en
> `backend/src/index.ts` y como lo llama el frontend. Si se intercepta la ruta del
> enunciado, `cy.wait()` se queda colgado y el test falla sin motivo aparente.
> → Detalle en §2.

---

## 1. Descripción del ejercicio

El objetivo es aplicar Cypress para probar de inicio a fin la interfaz **«position»**
(el tablero kanban de candidatos de una posición) mediante pruebas End-to-End.

### Escenarios exigidos por el enunciado

**A. Carga de la página de Position**

1. El título de la posición se muestra correctamente.
2. Se muestran las columnas correspondientes a cada fase del proceso de contratación.
3. Las tarjetas de los candidatos aparecen en la columna correcta según su fase actual.

**B. Cambio de fase de un candidato**

4. Simular el arrastre de una tarjeta de candidato de una columna a otra.
5. Verificar que la tarjeta se mueve a la nueva columna.
6. Verificar que la fase se actualiza en el backend mediante el endpoint `PUT` de
   candidatos.

### Entrega

- Pull request con los cambios (tests en la raíz del repo, código de `/frontend` si se
  toca).
- Este fichero, `prompts/prompts-CRN.md`, con la descripción y las instrucciones.
- Fichero de pruebas `position.spec.js`.

---

## 2. Contexto técnico del proyecto

Esto se ha verificado leyendo el código del repositorio. Conviene tenerlo delante
porque condiciona cómo se escriben los tests.

### Arquitectura y puertos

| Pieza | Tecnología | Puerto |
| --- | --- | --- |
| Frontend | React 18 + CRA + React Bootstrap + React Router 6 | `http://localhost:3000` |
| Backend | Express + TypeScript + Prisma | `http://localhost:3010` |
| Base de datos | PostgreSQL en Docker (`docker-compose.yml`) | según `.env` |

La ruta de la pantalla a probar es **`/positions/:id`**
(`frontend/src/App.js` → `<Route path="/positions/:id" element={<PositionDetails />} />`).

### Componentes implicados

```
frontend/src/components/
├── PositionDetails.js   ← pantalla: carga datos, DragDropContext, onDragEnd, PUT
├── StageColumn.js       ← una columna = un <Droppable droppableId={index}>
└── CandidateCard.js     ← una tarjeta = un <Draggable draggableId={candidate.id}>
```

### Endpoints que consume la pantalla

| Método | URL | Para qué |
| --- | --- | --- |
| GET | `http://localhost:3010/positions/:id/interviewFlow` | Nombre de la posición y fases |
| GET | `http://localhost:3010/positions/:id/candidates` | Candidatos con su fase actual |
| PUT | `http://localhost:3010/candidates/:id` | Actualizar la fase de un candidato |

> ⚠️ **El enunciado dice `PUT /candidate/:id` (singular), pero el endpoint real del
> proyecto es `/candidates/:id` (plural)** — está así en
> `backend/src/index.ts` (`app.use('/candidates', candidateRoutes)`) y en la llamada del
> frontend. Los tests deben interceptar la ruta **real**; si no, `cy.wait()` se queda
> colgado y el test falla sin motivo aparente.

### Formas de los datos (verificadas en el código)

`GET /positions/:id/interviewFlow` — ojo al **doble anidamiento** de `interviewFlow`:

```json
{
  "interviewFlow": {
    "positionName": "Senior Backend Engineer",
    "interviewFlow": {
      "interviewSteps": [
        { "id": 1, "name": "Initial Screening", "orderIndex": 1 },
        { "id": 2, "name": "Technical Interview", "orderIndex": 2 },
        { "id": 3, "name": "Manager Interview", "orderIndex": 3 }
      ]
    }
  }
}
```

`GET /positions/:id/candidates`:

```json
[
  {
    "candidateId": 1,
    "fullName": "John Doe",
    "currentInterviewStep": "Initial Screening",
    "averageScore": 3,
    "applicationId": 1
  }
]
```

Nótese que `currentInterviewStep` viaja como **el nombre de la fase** (string), y el
frontend reparte los candidatos comparándolo con el título de la columna
(`candidate.currentInterviewStep === stage.title`).

Cuerpo del `PUT /candidates/:id` que emite el frontend al soltar una tarjeta:

```json
{ "applicationId": 1, "currentInterviewStep": 2 }
```

Donde `currentInterviewStep` es el **`id` numérico** del paso destino (no el índice de
la columna ni su nombre).

### Selectores disponibles

Los componentes **no tienen `data-testid`**. Pero `react-beautiful-dnd` inyecta sus
propios atributos, que sirven perfectamente como selectores estables y **no obligan a
tocar el código de producción**:

| Elemento | Selector |
| --- | --- |
| Columna (droppable) | `[data-rbd-droppable-id="0"]`, `"1"`, `"2"`… (índice de la columna) |
| Tarjeta (draggable) | `[data-rbd-draggable-id="1"]` (es el `candidateId` en string) |
| Asa de arrastre | `[data-rbd-drag-handle-draggable-id="1"]` |
| Título de la posición | `h2` |
| Cabecera de columna | `.card-header` |
| Nombre del candidato | `.card-title` |

---

## 3. Las dos trampas de este ejercicio

Merece la pena leerlas antes de empezar: son el 90% del tiempo que se pierde aquí.

### Trampa 1 — react-beautiful-dnd no responde al drag simulado con ratón

La librería **no usa la API HTML5 de drag & drop**, así que `cy.trigger('dragstart')`,
`cy.drag()` de plugins genéricos o un `mousedown`+`mouseup` simple **no hacen nada**.
Necesita una secuencia de eventos de puntero muy concreta, con movimientos
intermedios y esperas para que sus animaciones se completen. Es frágil y es la causa
número uno de tests intermitentes en este ejercicio.

**La solución buena: usar el sensor de teclado de la propia librería.** `react-beautiful-dnd`
soporta arrastre por teclado de forma nativa y determinista:

| Tecla | keyCode | Efecto |
| --- | --- | --- |
| Espacio | 32 | Levanta la tarjeta (con el asa enfocada) / la suelta |
| Flecha → | 39 | Mueve a la columna de la derecha |
| Flecha ← | 37 | Mueve a la columna de la izquierda |
| Flecha ↑ ↓ | 38 / 40 | Mueve dentro de la misma columna |
| Escape | 27 | Cancela el arrastre |

Como en esta pantalla las columnas son listas **verticales** colocadas en horizontal
(`<Col md={3}>` dentro de un `<Row>`), cambiar de columna es **flecha derecha/izquierda**.

La receta que funciona:

```js
cy.get('[data-rbd-drag-handle-draggable-id="1"]')
  .focus()
  .trigger('keydown', { keyCode: 32 });        // levantar
cy.wait(200);                                   // dejar que rbd anuncie el lift
cy.get('[data-rbd-drag-handle-draggable-id="1"]')
  .trigger('keydown', { keyCode: 39, force: true });  // mover a la derecha
cy.wait(200);
cy.get('[data-rbd-drag-handle-draggable-id="1"]')
  .trigger('keydown', { keyCode: 32, force: true });  // soltar
```

Dos detalles que importan: `react-beautiful-dnd` v13 lee **`event.keyCode`**, no
`event.key`, así que hay que pasar `keyCode`; y las esperas son necesarias porque la
librería hace transiciones entre cada paso.

### Trampa 2 — El enunciado está escrito para Cypress 9

Pide crear `position.spec.js` en `/cypress/integration`. Esa carpeta **desapareció en
Cypress 10** (2022). La versión actual es Cypress 16, cuya estructura es:

```
cypress.config.js          ← configuración (antes cypress.json)
cypress/
├── e2e/                   ← los specs (antes integration/)
├── fixtures/
└── support/
    ├── e2e.js
    └── commands.js
```

El patrón por defecto es `cypress/e2e/**/*.cy.{js,jsx,ts,tsx}`.

**Decisión tomada para esta entrega:** se respeta el **nombre de fichero** que pide el
enunciado (`position.spec.js`) pero en la carpeta moderna (`cypress/e2e/`), y se ajusta
`specPattern` en `cypress.config.js` para que Cypress lo reconozca. Así se cumple el
enunciado sin usar una estructura obsoleta, y se deja constancia del porqué en este
documento.

---

## 4. Cómo ejecutar las pruebas

> **Estado de partida (verificado el 12/09/2026): Cypress NO está instalado en este
> repositorio.** El `package.json` de la raíz tiene `devDependencies` vacío, no aparece
> en `frontend/` ni en `backend/`, y no existe `node_modules/cypress`. El repositorio
> base viene limpio, como dice el enunciado («si no lo has hecho ya, instala Cypress»).
>
> **Quien lo instala es la Fase 1 de la sección 5.** Esta sección describe cómo ejecutar
> las pruebas **una vez completada esa fase**; sirve de manual de uso para ti y para
> quien corrija el ejercicio. Si estás empezando ahora, salta directamente a la §5.

### Requisitos previos

```bash
# 1. Dependencias de la raíz
#    - Primera vez (instala Cypress y lo añade a devDependencies):
npm install cypress --save-dev
#    - Veces siguientes, o tras clonar el repo (lo restaura desde package.json):
npm install

# 2. Base de datos
docker-compose up -d

# 3. Backend (terminal 1) — queda escuchando en :3010
cd backend
npm install
npx prisma generate
npm run dev

# 4. Frontend (terminal 2) — queda escuchando en :3000
cd frontend
npm install
npm start
```

El paso 1 va **en la raíz del repositorio**, no dentro de `frontend/` ni de `backend/`:
son proyectos npm independientes dentro del monorepo y sus `npm install` no instalan
nada de Cypress. Cypress se instala una sola vez con `--save-dev` (queda anotado en el
`package.json` de la raíz) y a partir de ahí un `npm install` normal lo restaura, que es
lo que hará quien clone el repo para corregir.

Para comprobar que el binario está bien instalado antes de lanzar nada:

```bash
npx cypress verify     # valida que el binario se puede ejecutar
npx cypress info       # muestra versión y navegadores detectados
```

> Si `npx cypress open` se ejecuta sin que Cypress esté instalado en el proyecto, npx
> se lo descarga al vuelo en una caché temporal: arranca, pero con una versión que no
> es la del `package.json` y sin quedar registrada en el repositorio. Es una fuente
> clásica de «en mi máquina funciona». Instálalo siempre como `devDependency`.

### Ejecutar Cypress

```bash
# Desde la raíz del repositorio

# Modo interactivo (el que pide el enunciado): abre la UI de Cypress
npx cypress open

# Modo headless: ejecuta todo y devuelve código de salida (útil en CI)
npx cypress run

# Solo este spec
npx cypress run --spec "cypress/e2e/position.spec.js"
```

Con los scripts de npm añadidos en la Fase 5:

```bash
npm run cy:open     # interactivo
npm run cy:run      # headless
npm run test:e2e    # levanta el front, espera a que responda y lanza los tests
```

---

## 5. Prompts por fases

Cada fase es un prompt listo para pegar en el copiloto (Claude Code, Cursor…), con su
criterio de aceptación. **Ejecutarlas en orden y verificar cada una antes de pasar a la
siguiente**: si la Fase 2 no deja los selectores claros, la Fase 4 falla sin que sepas
por qué.

---

### Fase 0 — Preparar la rama de trabajo

**Objetivo:** aislar la entrega en su propia rama antes de tocar nada.

```text
Estamos en el repositorio AI4Devs-qa-2606-roo, un monorepo con /frontend (React CRA)
y /backend (Express + Prisma).

Prepara la rama de trabajo para la entrega del ejercicio de Cypress:

1. Comprueba que el working tree está limpio (`git status`). Si hay cambios sin
   commitear, párate y dime cuáles son antes de continuar.
2. Actualiza la rama base: `git checkout main && git pull` (si la rama principal se
   llama distinto, úsala).
3. Crea y cambia a la rama: `feature/entrega-e2e-cypress-CRN`
4. Confirma con `git branch --show-current` que estamos en ella.

No hagas ningún commit todavía. No modifiques ningún fichero en este paso.
```

**Criterio de aceptación:** `git branch --show-current` devuelve
`feature/entrega-e2e-cypress-CRN` y `git status` está limpio.

---

### Fase 1 — Instalar y configurar Cypress

**Objetivo:** dejar Cypress instalado y configurado, con la estructura moderna pero
respetando el nombre de fichero del enunciado.

```text
Instala y configura Cypress en la RAÍZ del repositorio (no dentro de /frontend), para
que las pruebas E2E cubran la aplicación completa.

Contexto que debes respetar:
- El frontend corre en http://localhost:3000 y el backend en http://localhost:3010.
- La pantalla a probar es la ruta /positions/:id.
- Cypress 10 eliminó la carpeta cypress/integration. Usaremos cypress/e2e, pero el
  enunciado del ejercicio exige que el fichero se llame `position.spec.js`, así que
  hay que ajustar specPattern.

Tareas:
1. `npm install cypress --save-dev` en la raíz.
2. Crea `cypress.config.js` con:
   - baseUrl: 'http://localhost:3000'
   - specPattern: 'cypress/e2e/**/*.{cy,spec}.{js,jsx,ts,tsx}'  (acepta .cy.js y .spec.js)
   - viewportWidth 1280, viewportHeight 800
   - video: false
   - defaultCommandTimeout: 8000
   - una variable de entorno `apiUrl` con valor 'http://localhost:3010'
3. Crea la estructura: cypress/e2e/, cypress/fixtures/, cypress/support/e2e.js,
   cypress/support/commands.js
4. En cypress/support/e2e.js importa './commands'.
5. Añade al .gitignore de la raíz:
   cypress/videos/
   cypress/screenshots/
   cypress/downloads/
6. Crea un spec mínimo de humo `cypress/e2e/smoke.cy.js` que visite '/' y compruebe
   que la página responde, solo para validar que la instalación funciona.

No escribas todavía los tests de la pantalla de position. Al terminar, dime qué
versión de Cypress se ha instalado.
```

**Criterio de aceptación:** `npx cypress run --spec "cypress/e2e/smoke.cy.js"` pasa en
verde con el frontend levantado.

---

### Fase 2 — Mapear la pantalla y fijar los selectores

**Objetivo:** que el copiloto lea el código real y deje por escrito el mapa de
selectores antes de escribir un solo `cy.get`. Este paso es el que evita tests
escritos «a ojo» sobre selectores inventados.

```text
Antes de escribir tests, analiza el código real de la pantalla de position y
documenta el mapa de selectores.

Lee estos ficheros:
- frontend/src/components/PositionDetails.js
- frontend/src/components/StageColumn.js
- frontend/src/components/CandidateCard.js
- frontend/src/App.js

Y respóndeme con:
1. La ruta exacta del frontend para llegar a la pantalla.
2. Los endpoints que consume, con método y URL completa, y la forma EXACTA del JSON
   de respuesta que espera el componente (fíjate en el anidamiento).
3. El cuerpo exacto del PUT que se emite al soltar una tarjeta, y de dónde sale cada
   campo.
4. Qué atributos DOM quedan disponibles para seleccionar columnas y tarjetas.
   IMPORTANTE: no inventes data-testid que no existan. Si no hay, usa los atributos
   que inyecta react-beautiful-dnd (data-rbd-droppable-id, data-rbd-draggable-id,
   data-rbd-drag-handle-draggable-id) y dime exactamente qué valor toma cada uno.

Escribe el resultado como una tabla en el fichero prompts/prompts-CRN.md, en una
sección nueva llamada "Mapa de selectores verificado". No modifiques código de
producción.
```

**Criterio de aceptación:** la tabla de selectores coincide con lo que ves en el
inspector del navegador con la app levantada. Compruébalo a mano en dos o tres
selectores: es un minuto y te ahorra una hora.

---

### Fase 3 — Fixtures y comandos de apoyo

**Objetivo:** que los tests sean **deterministas**. Si dependen de lo que haya en la
base de datos, un día pasan y otro no, y eso es un test inútil (ver «flaky» en la
teoría del módulo).

```text
Crea los datos de prueba y los comandos reutilizables para los tests E2E.

1. Crea `cypress/fixtures/interviewFlow.json` con la respuesta de
   GET /positions/1/interviewFlow. Respeta el doble anidamiento real:
   { "interviewFlow": { "positionName": "...", "interviewFlow": { "interviewSteps": [...] } } }
   Usa 3 fases: "Initial Screening" (id 1), "Technical Interview" (id 2),
   "Manager Interview" (id 3).

2. Crea `cypress/fixtures/candidates.json` con 4 candidatos repartidos así:
   - 2 en "Initial Screening"
   - 1 en "Technical Interview"
   - 1 en "Manager Interview"
   Cada uno con: candidateId, fullName, currentInterviewStep, averageScore, applicationId.
   Usa nombres reconocibles y distintos entre sí.

3. En `cypress/support/commands.js` crea el comando `cy.visitPositionBoard(positionId)`
   que:
   - Intercepte GET **/positions/*/interviewFlow con el fixture, alias @interviewFlow
   - Intercepte GET **/positions/*/candidates con el fixture, alias @candidates
   - Intercepte PUT **/candidates/* devolviendo 200 y { message: 'ok' }, alias @updateCandidate
   - Visite /positions/{positionId}
   - Espere a @interviewFlow y @candidates antes de devolver el control

   OJO: el endpoint de actualización es /candidates/:id en PLURAL. El enunciado del
   ejercicio dice /candidate/:id y es incorrecto respecto al código real.

4. Crea también el comando `cy.moveCandidateByKeyboard(draggableId, direction)` que
   mueva una tarjeta con el sensor de teclado de react-beautiful-dnd:
   - enfoca [data-rbd-drag-handle-draggable-id="{draggableId}"]
   - dispara keydown con keyCode 32 (levantar)
   - espera 200 ms
   - dispara keydown con keyCode 39 si direction es 'right', o 37 si es 'left'
   - espera 200 ms
   - dispara keydown con keyCode 32 (soltar)
   Usa keyCode (no key): react-beautiful-dnd v13 lee event.keyCode.
   Usa { force: true } en los eventos posteriores al primero.

Añade JSDoc a los dos comandos explicando qué hacen y por qué el arrastre va por
teclado y no por ratón.
```

**Criterio de aceptación:** los fixtures validan como JSON y los comandos aparecen
disponibles con autocompletado en el spec.

---

### Fase 4 — Escenario A: carga de la página

**Objetivo:** cubrir los tres primeros requisitos del enunciado.

```text
Crea el fichero `cypress/e2e/position.spec.js` con el primer bloque de pruebas.

Usa `cy.visitPositionBoard(1)` en un beforeEach.

describe('Pantalla de Position - carga inicial')

Tests a escribir:

1. 'muestra el título de la posición'
   - Comprueba que el h2 contiene el positionName del fixture.

2. 'muestra una columna por cada fase del proceso'
   - Comprueba que hay exactamente 3 columnas (una por interviewStep del fixture).
   - Comprueba que las cabeceras muestran los nombres de las 3 fases, en el orden
     del fixture.

3. 'coloca cada candidato en la columna de su fase actual'
   - Para cada candidato del fixture, comprueba que su nombre aparece DENTRO de la
     columna correspondiente a su currentInterviewStep, no solo en la página.
   - Comprueba también el recuento por columna: 2, 1 y 1.

Requisitos de calidad:
- Nada de `cy.wait(3000)` a pelo: espera por alias o por condición.
- Los asertos deben ser específicos: `should('have.length', 3)` en lugar de
  `should('exist')`.
- Cada test debe poder ejecutarse solo, sin depender del anterior.
- Nombres de test descriptivos en español, describiendo comportamiento, no
  implementación.
```

**Criterio de aceptación:** `npx cypress run --spec "cypress/e2e/position.spec.js"`
pasa los 3 tests. Prueba también a cambiar un nombre en el fixture y comprueba que el
test **falla** — si no falla, no estaba probando nada.

---

### Fase 5 — Escenario B: cambio de fase por drag & drop

**Objetivo:** el núcleo del ejercicio. Cubrir los requisitos 4, 5 y 6.

```text
Añade al fichero `cypress/e2e/position.spec.js` el segundo bloque de pruebas.

describe('Pantalla de Position - cambio de fase de un candidato')

Test principal: 'mueve un candidato de una columna a la siguiente y persiste el cambio'

Pasos:
1. Parte del tablero cargado con cy.visitPositionBoard(1).
2. Verifica el estado inicial: el candidato con candidateId 1 está en la primera
   columna.
3. Usa cy.moveCandidateByKeyboard('1', 'right') para moverlo a la segunda columna.
4. Verifica que la tarjeta YA NO está en la primera columna.
5. Verifica que la tarjeta SÍ está en la segunda columna.
6. Verifica la llamada al backend con cy.wait('@updateCandidate') y comprueba:
   - que el método es PUT
   - que la URL termina en /candidates/1
   - que el cuerpo tiene applicationId con el valor del fixture
   - que el cuerpo tiene currentInterviewStep con el ID de la fase DESTINO
     (el id del interviewStep, no el índice de la columna ni su nombre)

Añade un segundo test: 'no deja rastro si se cancela el arrastre con Escape'
- Levanta la tarjeta con espacio, pulsa flecha derecha, y cancela con Escape (27).
- Verifica que la tarjeta sigue en la columna original.
- Verifica que NO se ha llamado al endpoint de actualización:
  cy.get('@updateCandidate.all').should('have.length', 0)

Recuerda:
- react-beautiful-dnd usa event.keyCode, no event.key.
- Las columnas son listas verticales en horizontal: cambiar de columna es flecha
  derecha/izquierda, no arriba/abajo.
- Hay que esperar entre los eventos de teclado para que las transiciones terminen.

Si el arrastre por teclado no funciona a la primera, NO lo sustituyas por eventos de
ratón: depura primero mirando si el asa recibe el foco y si el keydown llega. Dime qué
encuentras antes de cambiar de estrategia.
```

**Criterio de aceptación:** los dos tests pasan, y en la UI de Cypress se ve la tarjeta
moverse de columna. El test de cancelación es el que demuestra que no estás
comprobando un falso positivo.

---

### Fase 6 — Robustez, scripts y limpieza

**Objetivo:** dejar la entrega presentable y la suite estable.

```text
Repasa y endurece la suite de tests E2E.

1. Revisa `cypress/e2e/position.spec.js` y elimina:
   - cualquier cy.wait con un número fijo que no sea el mínimo necesario para
     react-beautiful-dnd
   - dependencias entre tests (cada uno debe partir de cero)
   - asertos vagos tipo should('exist') donde pueda haber uno específico

2. Ejecuta la suite 5 veces seguidas con:
   npx cypress run --spec "cypress/e2e/position.spec.js"
   Si algún test falla alguna de las veces, es flaky: identifícalo y arréglalo.
   Dime cuál era y por qué fallaba.

3. Añade estos scripts al package.json de la raíz:
   "cy:open": "cypress open"
   "cy:run": "cypress run"
   "test:e2e": "start-server-and-test 'npm --prefix frontend start' http://localhost:3000 'cypress run'"
   Instala start-server-and-test como devDependency.

4. Borra el spec de humo smoke.cy.js, que ya no aporta.

5. Comprueba que .gitignore cubre cypress/videos, cypress/screenshots y
   cypress/downloads, y que no se ha colado node_modules ni el .env.
```

**Criterio de aceptación:** cinco ejecuciones seguidas en verde. Si no lo están, no
está terminado.

---

### Fase 7 — Documentación y Pull Request

**Objetivo:** cerrar la entrega.

```text
Prepara la entrega del ejercicio.

1. Actualiza `prompts/prompts-CRN.md` añadiendo al final una sección
   "Resultado de la ejecución" con:
   - la versión de Cypress instalada
   - el número de tests y el tiempo de ejecución
   - una nota de las decisiones técnicas tomadas: por qué cypress/e2e en vez de
     cypress/integration, y por qué el arrastre va por teclado y no por ratón

2. Haz los commits siguiendo Conventional Commits, separando por tipo:
   - chore(cypress): configuración e instalación de Cypress
   - test(e2e): pruebas de carga de la pantalla de position
   - test(e2e): prueba de cambio de fase mediante drag and drop
   - docs(prompts): documentación del ejercicio y los prompts utilizados

3. Push de la rama feature/entrega-e2e-cypress-CRN.

4. Redacta el cuerpo del Pull Request (no lo abras todavía, muéstramelo) con:
   - qué se ha implementado, en 3 o 4 líneas
   - porqué se ha implementado
   - cómo ejecutar las pruebas en local
   - las dos decisiones técnicas del punto 1, explicadas brevemente
   - la discrepancia detectada entre el enunciado (/candidate/:id) y el endpoint
     real del proyecto (/candidates/:id)
```

**Criterio de aceptación:** PR abierto contra el repositorio base, con los tests en
verde y el documento de prompts incluido.

---

## 6. Checklist de entrega

- [x] Rama `feature/entrega-e2e-cypress-CRN` creada y con todos los commits
- [x] Cypress instalado como devDependency
- [x] `cypress.config.js` con `baseUrl` y `specPattern` configurados
- [x] `cypress/e2e/position.spec.js` creado
- [x] Test: el título de la posición se muestra correctamente
- [x] Test: se muestran todas las columnas de fases
- [x] Test: cada candidato aparece en la columna de su fase
- [x] Test: el arrastre mueve la tarjeta de columna
- [x] Test: se llama a `PUT /candidates/:id` con el cuerpo correcto
- [x] Test: cancelar el arrastre no llama al backend
- [x] Fixtures en `cypress/fixtures/`
- [x] Comandos reutilizables en `cypress/support/commands.js`
- [x] Scripts npm añadidos
- [x] `.gitignore` cubre vídeos y capturas de Cypress
- [x] 5 ejecuciones consecutivas en verde
- [x] Este documento actualizado con el resultado de la ejecución
- [ ] Pull Request abierto

---

## 7. Nota sobre el nombre de este fichero

El enunciado pide un fichero llamado `prompts-iniciales.md` en la carpeta `prompts`.
Este documento se llama `prompts-CRN.md` por convención personal de la autora. Si la
corrección del ejercicio busca el nombre literal, basta con duplicarlo o renombrarlo:

```bash
cp prompts/prompts-CRN.md prompts/prompts-iniciales.md
```

---

## 8. Mapa de selectores verificado

Verificado leyendo el código real (12/09/2026): `PositionDetails.js`, `StageColumn.js`,
`CandidateCard.js`, `App.js`. **No se ha modificado código de producción.**

### 8.1. Ruta del frontend

`/positions/:id` → `App.js:16` `<Route path="/positions/:id" element={<PositionDetails />} />`.
Ejemplo real: `http://localhost:3000/positions/1`. El `:id` se lee con `useParams()`
(`PositionDetails.js:10`).

### 8.2. Endpoints consumidos y forma EXACTA del JSON esperado

| # | Método | URL completa | Origen |
| --- | --- | --- | --- |
| 1 | GET | `http://localhost:3010/positions/${id}/interviewFlow` | `PositionDetails.js:19` |
| 2 | GET | `http://localhost:3010/positions/${id}/candidates` | `PositionDetails.js:35` |
| 3 | PUT | `http://localhost:3010/candidates/${candidateId}` | `PositionDetails.js:61` |

**Endpoint 1** — el componente accede a `data.interviewFlow.interviewFlow.interviewSteps`
(**doble anidamiento** de `interviewFlow`) y a `data.interviewFlow.positionName`
(`PositionDetails.js:21,27`). De cada step usa `step.id` y `step.name`:

```json
{
  "interviewFlow": {
    "positionName": "<string>",
    "interviewFlow": {
      "interviewSteps": [
        { "id": <number>, "name": "<string>" }
      ]
    }
  }
}
```

**Endpoint 2** — devuelve un **array plano** de candidatos. El componente usa de cada
uno: `candidateId`, `fullName`, `averageScore`, `applicationId` y `currentInterviewStep`
(`PositionDetails.js:41-46`). Clave: `currentInterviewStep` viaja como **el nombre de la
fase** (string), y se cruza con el título de columna vía
`candidate.currentInterviewStep === stage.title`:

```json
[
  {
    "candidateId": <number>,
    "fullName": "<string>",
    "currentInterviewStep": "<nombre de la fase, string>",
    "averageScore": <number>,
    "applicationId": <number>
  }
]
```

### 8.3. Cuerpo EXACTO del PUT al soltar una tarjeta

Emitido en `updateCandidateStep` (`PositionDetails.js:59-70`), disparado desde
`onDragEnd` (`PositionDetails.js:97`):

```json
{ "applicationId": <number>, "currentInterviewStep": <number> }
```

| Campo del body | Valor | De dónde sale |
| --- | --- | --- |
| (URL) `candidateId` | `movedCandidate.id` | `candidate.candidateId.toString()` del endpoint 2 (`PositionDetails.js:43`) |
| `applicationId` | `Number(applicationId)` | `movedCandidate.applicationId` ← `candidate.applicationId` del endpoint 2 (`:46`) |
| `currentInterviewStep` | `Number(newStep)` | `destStageId = stages[destination.droppableId].id` ← **`step.id`** del endpoint 1 (`:95`) |

⚠️ `currentInterviewStep` en el PUT es el **`id` numérico del paso destino**, NO el índice
de la columna ni el nombre de la fase. La cabecera es `Content-Type: application/json`,
método `PUT`.

### 8.4. Atributos DOM disponibles (sin data-testid)

Los componentes **NO definen ningún `data-testid`**. Los selectores estables provienen de
los atributos que inyecta `react-beautiful-dnd`, más clases de React Bootstrap:

| Elemento | Selector | Valor exacto | Origen |
| --- | --- | --- | --- |
| Columna (droppable) | `[data-rbd-droppable-id="N"]` | **índice de la columna** en string: `"0"`, `"1"`, `"2"`… (NO el `id` de la fase) | `StageColumn.js:8` `droppableId={`${index}`}` |
| Tarjeta (draggable) | `[data-rbd-draggable-id="N"]` | **`candidateId` en string** (p.ej. `"1"`) | `CandidateCard.js:6` `draggableId={candidate.id}` |
| Asa de arrastre | `[data-rbd-drag-handle-draggable-id="N"]` | mismo `candidateId` en string; el asa coincide con la tarjeta porque `dragHandleProps` se aplica al mismo `<Card>` | `CandidateCard.js:12` |
| Título de la posición | `h2` | `positionName` del endpoint 1 | `PositionDetails.js:113` |
| Cabecera de columna | `.card-header` | `stage.title` (= `step.name`) | `StageColumn.js:11` |
| Nombre del candidato | `.card-title` | `candidate.name` (= `fullName`) | `CandidateCard.js:16` |
| Rating | `span[role="img"][aria-label="rating"]` | tantos 🟢 como `averageScore` | `CandidateCard.js:18-20` |

**Trampa a recordar:** `data-rbd-droppable-id` es el **índice** de la columna (0-based),
mientras que `data-rbd-draggable-id` es el **candidateId**. No confundir el índice de
columna con el `id` de la fase — el PUT usa el `id` de la fase, el selector usa el índice.

---

## 9. Resultado de la ejecución

Ejecución final verificada el 12/09/2026 con el frontend levantado en `http://localhost:3000`.

### Datos de la ejecución

| Dato | Valor |
| --- | --- |
| Versión de Cypress instalada | **16.0.0** (devDependency de la raíz) |
| Fichero de tests | `cypress/e2e/position.spec.js` |
| Nº de tests | **5** (3 de carga + 2 de cambio de fase) |
| Resultado | 5 passing / 0 failing |
| Tiempo de ejecución | ~6 s por ejecución |
| Estabilidad | **5 ejecuciones consecutivas en verde** (0 flaky) |

Tests incluidos:

- `Pantalla de Position - carga inicial`
  1. muestra el título de la posición
  2. muestra una columna por cada fase del proceso
  3. coloca cada candidato en la columna de su fase actual
- `Pantalla de Position - cambio de fase de un candidato`
  4. mueve un candidato de una columna a la siguiente y persiste el cambio
  5. no deja rastro si se cancela el arrastre con Escape

### Decisiones técnicas

**1. `cypress/e2e/` en vez de `cypress/integration/`.** El enunciado (escrito para
Cypress 9) pide `cypress/integration`, carpeta eliminada en Cypress 10 (2022). Se
instaló Cypress 16 con estructura moderna (`cypress.config.js`, `cypress/e2e/`) pero se
respetó el **nombre de fichero** exigido (`position.spec.js`) ajustando `specPattern` a
`cypress/e2e/**/*.{cy,spec}.{js,jsx,ts,tsx}` (acepta `.cy.js` y `.spec.js`).

**2. Arrastre por teclado, no por ratón.** La pantalla usa `react-beautiful-dnd`, que
**no implementa la API HTML5 de drag & drop**: `cy.trigger('dragstart')` y los plugins
genéricos no hacen nada. Se usa el **sensor de teclado** nativo de la librería (comando
`cy.moveCandidateByKeyboard`): foco en el asa → espacio (levantar) → flecha derecha/
izquierda (cambiar de columna) → espacio (soltar). Se pasa `keyCode` (no `key`) porque
`react-beautiful-dnd` v13 lee `event.keyCode`.

**3. Discrepancia de endpoint.** El enunciado dice `PUT /candidate/:id` (singular); el
endpoint real del proyecto es **`PUT /candidates/:id` (plural)** (`PositionDetails.js:61`,
`backend/src/index.ts`). Los intercepts apuntan a la ruta real.

**4. Condición de carrera neutralizada desde el test.** El componente lanza
`fetchInterviewFlow` y `fetchCandidates` en paralelo; `fetchCandidates` hace
`setStages(prevStages => prevStages.map(...))`. Si candidates resuelve antes que
interviewFlow, `prevStages` es `[]` y los candidatos se pierden → test flaky. Se
estabiliza con `delay: 150` en el intercept de `@candidates` para que interviewFlow gane
siempre la carrera, sin tocar código de producción.
