# Prompts iniciales — Pruebas E2E con Cypress de la interfaz "Position"

Repositorio base: `AI4Devs-qa-2606-roo`
Modelo utilizado: Claude Opus 5 (Claude Code)

---

## 1. Prompt inicial (contexto y exploración)

> Actúas como QA Automation Engineer senior especializado en Cypress y React.
>
> Este proyecto es un ATS (Applicant Tracking System) con:
> - `backend/`: API REST en Express + TypeScript + Prisma (PostgreSQL), escuchando en `http://localhost:3010`.
> - `frontend/`: SPA en React 18 (Create React App) con React Router, react-bootstrap y react-beautiful-dnd, escuchando en `http://localhost:3000`.
>
> Antes de escribir una sola línea de test, analiza el código real y respóndeme con:
> 1. La ruta del router que renderiza la pantalla de detalle de una posición y el componente que la implementa.
> 2. Los endpoints que consume esa pantalla (método, URL y forma exacta del JSON de request/response).
> 3. Cómo se estructuran el DOM y los atributos que genera `react-beautiful-dnd` (droppables, draggables, drag handles), porque serán mis selectores.
> 4. Cualquier condición de carrera o comportamiento frágil que pueda hacer inestables las pruebas E2E.
>
> No modifiques nada todavía; primero quiero el mapa del terreno.

---

## 2. Prompt de configuración de Cypress

> Configura Cypress en el proyecto siguiendo estas restricciones:
>
> - Instálalo como dependencia de desarrollo **dentro de `frontend/`** (`npm install cypress --save-dev`), que es donde vive la aplicación bajo prueba.
> - Crea `frontend/cypress.config.js` con:
>   - `baseUrl: 'http://localhost:3000'`.
>   - `specPattern: 'cypress/integration/**/*.spec.{js,jsx,ts,tsx}'`, porque el enunciado exige que los specs vivan en `/cypress/integration` y no en la carpeta `cypress/e2e` por defecto de Cypress 10+.
>   - `video: false` y `retries: { runMode: 2 }`.
>   - La URL del backend (`http://localhost:3010`) como constante en `cypress/support/commands.js`: en Cypress 16 `Cypress.env()` ha sido eliminado, así que no uses el bloque `env` de la configuración para leerla desde los tests.
> - Crea `cypress/support/e2e.js` y `cypress/support/commands.js`.
> - Añade a `frontend/package.json` los scripts `cypress:open`, `cypress:run` y `test:e2e`.
> - No toques la configuración de Jest ya existente ni los tests unitarios del backend.

---

## 3. Prompt de diseño de las pruebas E2E

> Escribe las pruebas E2E de la interfaz "Position" en `frontend/cypress/integration/position.spec.js`.
>
> **Estrategia de datos**: las pruebas NO deben depender de PostgreSQL ni del backend en ejecución. Intercepta con `cy.intercept()` los tres endpoints que usa la pantalla y sírvelos desde fixtures:
> - `GET /positions/:id/interviewFlow` → `cypress/fixtures/interviewFlow.json`
> - `GET /positions/:id/candidates` → `cypress/fixtures/candidates.json`
> - `PUT /candidates/:id` → respuesta 200 stubbeada
>
> Ten en cuenta que `PositionDetails.js` lanza las dos peticiones GET en paralelo y reparte los candidatos sobre el estado previo de columnas: si la respuesta de candidatos llega antes que la del flujo de entrevistas, las tarjetas se pierden. Añade un `delay` al stub de candidatos para que el escenario sea determinista y documenta por qué.
>
> **Escenarios obligatorios**:
>
> *Carga de la página de Position*
> 1. El título de la posición se muestra correctamente.
> 2. Se muestra una columna por cada fase del proceso de contratación, con su nombre y en orden.
> 3. Cada tarjeta de candidato aparece en la columna que corresponde a su fase actual (comprueba también el número de tarjetas por columna, no solo su presencia).
>
> *Cambio de fase de un candidato*
> 4. Al arrastrar una tarjeta de una columna a otra, la tarjeta se mueve a la columna destino y desaparece de la de origen.
> 5. El cambio de fase se persiste en el backend: verifica que se dispara `PUT /candidates/:id` con el `applicationId` correcto y con `currentInterviewStep` igual al **id** de la fase destino (no su índice ni su nombre).
> 6. Casos adicionales: mover varias fases de golpe, devolver un candidato a una fase anterior y cancelar el arrastre (no debe producirse ninguna llamada al backend).
>
> **Cómo simular el arrastre**: react-beautiful-dnd ignora los eventos de ratón sintéticos salvo que se supere el umbral de "sloppy click" con varios `mousemove`, lo que resulta muy inestable. Usa su sensor de teclado, que es una API pública y estable: foco en el drag handle → `keydown` espacio (levantar) → `keydown` flecha derecha/izquierda (mover entre columnas) → `keydown` espacio (soltar), con pequeñas esperas entre pasos para dar tiempo a las animaciones. Encapsúlalo en un comando personalizado `cy.dragCandidate(draggableId, steps)` en `cypress/support/commands.js`.
>
> **Selectores**: apóyate en los atributos que genera react-beautiful-dnd (`[data-rbd-droppable-id]`, `[data-rbd-draggable-id]`, `[data-rbd-drag-handle-draggable-id]`) en lugar de en clases de Bootstrap cuando identifiques columnas y tarjetas. Añade comandos `cy.stubPositionApi()`, `cy.visitPosition()` y `cy.stageColumn(index)` para que el spec se lea como una especificación funcional.
>
> Comenta en el código el *porqué* de las decisiones no evidentes, no el *qué*.

---

## 4. Prompt de documentación y entrega

> Para cerrar el ejercicio:
> 1. Escribe `frontend/cypress/README.md` con los requisitos previos, los comandos de ejecución y cómo interpretar los fallos más comunes.
> 2. Genera `prompts/prompts-iniciales.md` con la descripción del ejercicio y los prompts utilizados.
> 3. Crea una rama, commitea los cambios con Conventional Commits y abre un Pull Request contra `main` describiendo qué se ha probado y cómo ejecutarlo.

---

## Descripción del ejercicio

Probar de inicio a fin, mediante pruebas E2E con Cypress, la interfaz "Position" del ATS: el tablero kanban que muestra las fases del proceso de contratación de una posición y permite mover candidatos entre fases arrastrando sus tarjetas.

### Escenarios cubiertos

**Carga de la página de Position**

| # | Escenario | Verificación |
|---|-----------|--------------|
| 1 | Título de la posición | El `<h2>` muestra el nombre devuelto por `GET /positions/:id/interviewFlow` |
| 2 | Columnas de fases | Hay una columna por `interviewStep`, con el nombre y el orden correctos |
| 3 | Tarjetas por fase | Cada candidato aparece en la columna de su `currentInterviewStep`, y el recuento por columna es el esperado |
| 4 | Valoración | Se pintan tantos indicadores como `averageScore` tiene el candidato |

**Cambio de fase de un candidato**

| # | Escenario | Verificación |
|---|-----------|--------------|
| 5 | Arrastre entre columnas | La tarjeta aparece en la columna destino y desaparece de la de origen |
| 6 | Persistencia en backend | Se dispara `PUT /candidates/:id` con `{ applicationId, currentInterviewStep }` correctos |
| 7 | Salto de varias fases | Se envía el id de la fase final, no el de las intermedias |
| 8 | Retroceso de fase | Se permite volver a una fase anterior y se persiste |
| 9 | Arrastre cancelado (ESC) | La tarjeta vuelve a su sitio y **no** se llama al backend |

---

## Ejecución de las pruebas

### Requisitos previos

```bash
cd frontend
npm install
```

> **Nota sobre el endpoint**: el enunciado del ejercicio menciona `PUT /candidate/:id`, pero la ruta real implementada en el backend (`backend/src/routes/candidateRoutes.ts`, montada en `backend/src/index.ts` como `app.use('/candidates', candidateRoutes)`) y la que invoca el frontend es `PUT /candidates/:id`. Las pruebas verifican la ruta real.

### 1. Levantar el frontend

```bash
cd frontend
npm start          # http://localhost:3000
```

El backend y la base de datos **no** son necesarios: todas las llamadas HTTP están stubbeadas con `cy.intercept()`.

### 2. Ejecutar las pruebas

Modo interactivo (Test Runner):

```bash
cd frontend
npm run cypress:open      # o: npx cypress open
```

Selecciona *E2E Testing* → navegador → `position.spec.js`.

Modo headless (CI):

```bash
cd frontend
npm run cypress:run       # o: npx cypress run
```

### Resultado de la ejecución

```
  Interfaz de Position - proceso de contratación
    Carga de la página de Position
      √ muestra el título de la posición
      √ muestra una columna por cada fase del proceso de contratación
      √ muestra cada tarjeta de candidato en la columna de su fase actual
      √ pinta la valoración de cada candidato con tantos círculos como puntuación media
    Cambio de fase de un candidato
      √ mueve la tarjeta a la columna destino al arrastrarla
      √ actualiza la fase en el backend mediante PUT /candidates/:id
      √ permite mover una tarjeta varias fases y envía la fase final
      √ permite devolver una tarjeta a una fase anterior
      √ no llama al backend si la tarjeta se suelta fuera de una columna

  9 passing (16s)
```

Versión de Cypress utilizada: **16.0.0** (Node 24.15.0).

### Instalación de Cypress detrás de un proxy corporativo

Si `npm install cypress` falla con `self-signed certificate in certificate chain` al descargar el binario, el proxy corporativo está interceptando TLS. Solución recomendada (no desactiva la verificación TLS):

```powershell
# Exportar los certificados raíz de confianza de Windows a un bundle PEM
$env:NODE_EXTRA_CA_CERTS = "C:\ruta\a\corp-ca.pem"
npm install --save-dev cypress
```

---

## Estructura de archivos añadida

```
frontend/
├── cypress.config.js
└── cypress/
    ├── README.md
    ├── fixtures/
    │   ├── candidates.json
    │   └── interviewFlow.json
    ├── integration/
    │   └── position.spec.js
    └── support/
        ├── commands.js
        └── e2e.js
prompts/
└── prompts-iniciales.md
```
