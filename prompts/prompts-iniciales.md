# Prompts iniciales — Pruebas E2E con Cypress sobre la interfaz "position"

**Autor:** Francisco Rodríguez (Pako)
**Modelo:** Claude Opus 5 (Claude Code)
**Fecha:** 11 de septiembre de 2026
**Repositorio base:** `AI4Devs-qa-2606-roo`

---

## Índice

1. [Descripción del ejercicio](#descripción-del-ejercicio)
2. [Prompts utilizados](#prompts-utilizados)
   - [Prompt 1 — Carga de contexto y conocimientos](#prompt-1--carga-de-contexto-y-conocimientos)
   - [Prompt 2 — Requisitos del ejercicio](#prompt-2--requisitos-del-ejercicio)
   - [Prompt 3 — Aprobación y documentación de bugs](#prompt-3--aprobación-y-documentación-de-bugs)
   - [Prompt 4 — Generación de este archivo](#prompt-4--generación-de-este-archivo)
   - [Prompt 5 — Creación de la rama de trabajo](#prompt-5--creación-de-la-rama-de-trabajo)
3. [Instrucciones de ejecución de las pruebas E2E](#instrucciones-de-ejecución-de-las-pruebas-e2e)
4. [Estructura de archivos generada](#estructura-de-archivos-generada)
5. [Resultado de las pruebas](#resultado-de-las-pruebas)

---

## Descripción del ejercicio

El objetivo es aplicar los conocimientos de **Cypress** para probar la interfaz
**"position"** — el tablero kanban del proceso de contratación — mediante pruebas
**End-to-End (E2E)**.

Se verifican dos bloques de escenarios:

1. **Carga de la página de Position:** título de la posición, columnas por cada fase del
   proceso de contratación y tarjetas de candidatos ubicadas en la columna correcta según
   su fase actual.
2. **Cambio de fase de un candidato:** arrastre de una tarjeta de una columna a otra,
   verificación de que la tarjeta se mueve y de que la fase se persiste en el backend
   mediante el endpoint `PUT /candidates/:id`.

---

## Prompts utilizados

### Prompt 1 — Carga de contexto y conocimientos

> Te voy a entregar como contexto lo que debes saber para que me ayudes a hacer un
> ejercicio en este repositorio, lo primero que vas a hacer es leer los documentos que te
> voy a anexar para que adquieras los conocimientos que necesitas, léelos detalladamente
> y aprende lo más importante y relevante así como lo que se puntúa como buenas
> prácticas, enfócate en las pruebas E2E, BDD y Testing asistido por IA, posteriormente
> en este ejercicio, tu misión es aplicar los conocimientos adquiridos de Cypress para
> probar la interfaz "position". Vamos a asegurarnos de que la interfaz funciona
> correctamente mediante pruebas End-to-End (E2E).
>
> NO vas a aplicar el ejercicio aún, solo vas a adquirir los conocimientos, solo te lo
> paso para que sepas de qué va.
>
> Una vez que tengas los conocimientos y estés listo avísame para pasarte los Requisitos
> del Ejercicio.

**Documentos adjuntos:**

| Documento | Contenido aprovechado |
|---|---|
| `📋Pruebas de Integración y End E2E.docx` | Diferencias unitarias / integración / E2E, ecosistema 2026, buenas prácticas de selectores y estabilidad |
| `📋BDD Behavior-Driven Development.docx` | Estructura Gherkin, anti-patrones de escenarios generados por IA |
| `📋Testing Asistido por AI 🔴.docx` | ML clásico vs LLM, riesgos, *test theater*, revisión humana obligatoria |
| `📚 Recursos adicionales 🟢.docx` | Documentación oficial de referencia |

---

### Prompt 2 — Requisitos del ejercicio

> **Requisitos del Ejercicio**
>
> **1. Configurar Cypress en el Proyecto**
>
> Si no lo has hecho ya, instala Cypress en tu proyecto: `npm install cypress --save-dev`
>
> **2. Crear Pruebas E2E para la Interfaz "position"**
>
> Debes crear pruebas E2E para verificar los siguientes escenarios:
>
> **2.1 Carga de la Página de Position:**
> - Verifica que el título de la posición se muestra correctamente.
> - Verifica que se muestran las columnas correspondientes a cada fase del proceso de contratación.
> - Verifica que las tarjetas de los candidatos se muestran en la columna correcta según su fase actual.
>
> **2.2 Cambio de Fase de un Candidato:**
> - Simula el arrastre de una tarjeta de candidato de una columna a otra.
> - Verifica que la tarjeta del candidato se mueve a la nueva columna.
> - Verifica que la fase del candidato se actualiza correctamente en el backend mediante el endpoint `PUT /candidate/:id`.
>
> **Entrega del Ejercicio**
>
> **1. Crear Pruebas E2E**
> - Crea un archivo de prueba `position.spec.js` en la carpeta `/cypress/integration`.
> - Escribe pruebas E2E para verificar la carga de la página y el cambio de fase de un candidato.
>
> **1.1 Ejecución de Pruebas**
> - Ejecuta las pruebas con el comando: `npx cypress open`
>
> NO generes aún ningún pull request hasta que revise y apruebe, además aún nos faltan
> cosas.
>
> Muéstrame cómo salieron las pruebas.

---

### Prompt 3 — Aprobación y documentación de bugs

> Ok apruebo los cambios y documenta los bugs que encontraste, detén el Dev server CRA.

**Motivación de este prompt.** Durante la ejecución del Prompt 2 el modelo reportó dos
hallazgos que justificaron pedir la documentación formal:

1. **Condición de carrera en `PositionDetails.js:55-56`.** El componente lanza
   `fetchInterviewFlow()` y `fetchCandidates()` en paralelo, pero el segundo hace
   `setStages(prev => ...)` sobre el estado que produce el primero. Si `/candidates`
   responde antes que `/interviewFlow`, `prev` es `[]` y **ningún candidato se
   renderiza**. Es una condición de carrera latente en producción.

2. **Ruta de API incorrecta en el enunciado.** El ejercicio indica
   `PUT /candidate/:id` (singular), pero el endpoint real que expone el backend es
   `PUT /candidates/:id` (plural). Las aserciones se escribieron contra la ruta real.

---

### Prompt 4 — Generación de este archivo

> Ahora sí crea el archivo `prompts-iniciales.md` en la carpeta de prompts con los
> prompts usados, que esté bien formateado con la estructura de un archivo markdown.

---

### Prompt 5 — Creación de la rama de trabajo

> Ahora sí crea la rama y una vez que se cree yo genero el commit y PR manualmente,
> anexa este último prompt a `prompts-iniciales.md` como el Prompt 5.

**Rama creada:** `feature/cypress-e2e-position` (a partir de `main`).

El commit y el Pull Request se realizan manualmente, por decisión del autor.

---

## Instrucciones de ejecución de las pruebas E2E

### Requisitos previos

- **Node.js 18+** (probado con Node 22.22.0)
- **No se requiere** Docker, PostgreSQL ni ejecutar el backend: la suite intercepta las
  peticiones HTTP con `cy.intercept()` y fixtures, por lo que los tests son deterministas
  e independientes del entorno.

### Instalación

```bash
cd frontend
npm install
```

Cypress ya está declarado como `devDependency` en `frontend/package.json`, junto con
`start-server-and-test`.

### Ejecución

**Modo interactivo** (el que pide el enunciado) — levanta el servidor de desarrollo y
abre la interfaz de Cypress:

```bash
cd frontend
npm run e2e:open
```

**Modo headless** (para CI) — levanta el servidor, ejecuta la suite y apaga todo:

```bash
cd frontend
npm run e2e
```

**Si el servidor de desarrollo ya está corriendo** en `http://localhost:3000`:

```bash
cd frontend
npx cypress open     # interactivo
npx cypress run      # headless
```

### Scripts disponibles

| Script | Qué hace |
|---|---|
| `npm run cy:open` | Abre Cypress (requiere el servidor ya levantado) |
| `npm run cy:run` | Ejecuta la suite headless (requiere el servidor ya levantado) |
| `npm run e2e` | Levanta el servidor + ejecuta headless + apaga |
| `npm run e2e:open` | Levanta el servidor + abre Cypress interactivo |

---

## Estructura de archivos generada

```
frontend/
├── cypress.config.js                    # baseUrl 3000 + specPattern a cypress/integration
├── cypress/
│   ├── integration/
│   │   └── position.spec.js             # los 9 tests E2E
│   ├── fixtures/
│   │   ├── interviewFlow.json           # 3 fases del proceso (espejo del seed real)
│   │   └── candidates.json              # 4 candidatos repartidos en las 3 fases
│   ├── support/
│   │   ├── e2e.js                       # filtro de ruido ResizeObserver de rbd
│   │   └── commands.js                  # cy.stageColumn() y cy.dragCandidate()
│   └── BUGS-ENCONTRADOS.md              # 8 bugs detectados durante el desarrollo
└── package.json                         # scripts cy:open, cy:run, e2e, e2e:open
```

### Decisiones técnicas

**Carpeta `/cypress/integration`.** Es la ruta *legacy* de Cypress ≤ 9; desde Cypress 10
la convención es `/cypress/e2e`. Para cumplir el enunciado al pie sin usar una versión
obsoleta, se configuró `specPattern` en `cypress.config.js`, lo que mantiene la ruta
solicitada funcionando en Cypress 16.

**Drag & drop por teclado, no por mouse.** `react-beautiful-dnd` expone un sensor de
teclado nativo (`Space` = levantar, flechas = mover, `Space` = soltar). No depende de
coordenadas ni de animaciones, lo que elimina el *flakiness* característico de simular
`mousemove`.

**Selectores estables sin modificar la aplicación.** Se usan los *data-attributes*
propios de la librería (`data-rbd-droppable-id`, `data-rbd-drag-handle-draggable-id`) más
el texto de los encabezados, en lugar de clases CSS frágiles. Cero cambios en el código
de producción.

**Red interceptada con fixtures.** Tests independientes, repetibles y ejecutables en
cualquier máquina y en CI, sin base de datos. El `PUT` se intercepta y se asertan método,
URL, `content-type` y cuerpo exacto — es decir, se verifica el contrato real que el
frontend envía al backend.

---

## Resultado de las pruebas

```
Interfaz "position" - tablero de proceso de contratacion
  1. Carga de la pagina de Position
    √ muestra correctamente el titulo de la posicion (1174ms)
    √ muestra una columna por cada fase del proceso de contratacion (376ms)
    √ coloca cada tarjeta de candidato en la columna de su fase actual (468ms)
    √ no muestra un candidato en una columna que no le corresponde (377ms)
    √ renderiza la valoracion de cada candidato (436ms)
  2. Cambio de fase de un candidato
    √ mueve la tarjeta a la nueva columna al arrastrarla (480ms)
    √ actualiza la fase en el backend con PUT /candidates/:id (383ms)
    √ envia el id de fase correcto al saltar dos columnas (409ms)
    √ permite devolver la tarjeta a su fase anterior (527ms)

  9 passing (5s)
```

**Estabilidad verificada:** 4 ejecuciones consecutivas (3 en Electron 146 + 1 en
Chrome 152 headless), 9/9 en todas, sin *flakiness*.

### Bugs detectados

Durante la construcción de la suite se detectaron **8 bugs** en la aplicación, de los
cuales 4 fueron reproducidos empíricamente con Cypress. Están documentados en
[`frontend/cypress/BUGS-ENCONTRADOS.md`](../frontend/cypress/BUGS-ENCONTRADOS.md), con
severidad, impacto, código de reproducción y corrección propuesta.

Los dos más relevantes:

- **BUG-01 (🔴 Crítica)** — Condición de carrera en `PositionDetails.js`: si
  `/candidates` responde antes que `/interviewFlow`, se renderizan las columnas pero
  **ningún candidato**, en silencio y de forma no determinista.
- **BUG-02 (🟠 Alta)** — Si el `PUT` falla, la UI deja la tarjeta en la nueva columna sin
  *rollback* ni aviso: la pantalla afirma que el cambio se guardó cuando no fue así.

Ningún bug fue corregido en esta entrega, para no mezclar cambios de QA con cambios de
producto.
