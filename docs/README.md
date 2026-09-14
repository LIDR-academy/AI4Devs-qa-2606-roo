# Documentación Técnica — LTI: Sistema de Seguimiento de Talento

> Este documento amplía el `README.md` de la raíz (orientado a *deployment*) y describe en profundidad el propósito de negocio, la arquitectura, los flujos end-to-end y la puesta en marcha del entorno de desarrollo de **LTI**.

## Índice

1. [Propósito de negocio](#1-propósito-de-negocio)
2. [Problema que resuelve](#2-problema-que-resuelve)
3. [Diagramas de flujo End-to-End](#3-diagramas-de-flujo-end-to-end)
4. [Flujos E2E (Given/When/Then)](#4-flujos-e2e-givenwhenthen)
5. [Estructura de carpetas](#5-estructura-de-carpetas)
6. [Tecnologías usadas](#6-tecnologías-usadas)
7. [Arquitectura de backend y frontend](#7-arquitectura-de-backend-y-frontend)
8. [Identificación de módulos](#8-identificación-de-módulos)
9. [Identificación de interfaces](#9-identificación-de-interfaces)
10. [Puesta en marcha del entorno](#10-puesta-en-marcha-del-entorno)
11. [Pruebas E2E con Cypress](#11-pruebas-e2e-con-cypress)

---

## 1. Propósito de negocio

**LTI (Talent Tracking System)** es una aplicación de gestión de procesos de selección (ATS — *Applicant Tracking System*) cuyo objetivo es dar soporte al ciclo completo de reclutamiento de una empresa:

- Centralizar la información de **candidatos** (datos personales, formación académica, experiencia laboral y currículum).
- Publicar y administrar **posiciones abiertas** (vacantes) con su descripción, requisitos, salario, ubicación y fecha límite.
- Definir **flujos de entrevista** (*interview flows*) configurables por posición, compuestos por una secuencia ordenada de **fases/pasos** (screening telefónico, entrevista técnica, entrevista con manager, oferta, etc.).
- Permitir a los reclutadores **visualizar y mover candidatos** a través de las fases del proceso (tablero tipo *kanban*).
- Registrar el resultado de cada **entrevista** (nota, resultado, comentarios) para poder evaluar objetivamente a cada candidato.

En definitiva, LTI busca **reducir el tiempo de contratación y mejorar la trazabilidad** del proceso de selección, ofreciendo una única fuente de verdad tanto para el equipo de RR.HH. como para los managers implicados en la contratación.

## 2. Problema que resuelve

Sin una herramienta como LTI, los equipos de reclutamiento suelen gestionar candidatos con hojas de cálculo, correos electrónicos y documentos dispersos, lo que provoca:

| Problema | Cómo lo resuelve LTI |
|---|---|
| Falta de visibilidad del estado de cada candidato dentro del proceso | Tablero *kanban* por posición con fases de entrevista y *drag & drop* |
| Datos de candidatos duplicados o desactualizados en distintos ficheros | Modelo de datos único y persistente (PostgreSQL) accesible vía API |
| Procesos de entrevista distintos y no estandarizados por vacante | Flujos de entrevista (`InterviewFlow` / `InterviewStep`) configurables y reutilizables |
| Dificultad para comparar candidatos de forma objetiva | Registro estructurado de entrevistas con `score` y cálculo de nota media |
| Gestión manual de CVs (PDF/Word) | Endpoint de subida de ficheros con validación de tipo y tamaño |
| Ausencia de una API documentada para integraciones | Especificación OpenAPI (`backend/api-spec.yaml`) de todos los endpoints |

## 3. Diagramas de flujo End-to-End

### 3.1 Visión general de la arquitectura y flujo de datos

```mermaid
flowchart LR
    subgraph Cliente["Navegador"]
        UI[React SPA]
    end

    subgraph Servidor["Backend Express (TypeScript)"]
        API[API REST]
        SVC[Servicios de aplicación]
        DOM[Modelos de dominio]
    end

    DB[(PostgreSQL)]
    FS[(Sistema de ficheros<br/>uploads/)]

    UI -- "HTTP/JSON (axios / fetch)" --> API
    API --> SVC
    SVC --> DOM
    DOM -- "Prisma Client" --> DB
    SVC -- "multer" --> FS
```

### 3.2 Flujo E2E — Alta de un candidato (con CV)

```mermaid
sequenceDiagram
    actor Reclutador
    participant FE as Frontend (AddCandidateForm)
    participant UP as FileUploader
    participant API as Backend API
    participant VAL as validator.ts
    participant SVC as candidateService
    participant DB as PostgreSQL (Prisma)

    Reclutador->>FE: Rellena datos personales, educación y experiencia
    Reclutador->>UP: Adjunta CV (PDF/DOCX)
    UP->>API: POST /upload (multipart/form-data)
    API-->>UP: 200 { filePath, fileType }
    UP-->>FE: Actualiza estado del formulario con la ruta del CV
    Reclutador->>FE: Pulsa "Enviar candidatura"
    FE->>API: POST /candidates (JSON con datos + cv)
    API->>VAL: validateCandidateData(body)
    alt Datos inválidos
        VAL-->>API: Error de validación
        API-->>FE: 400 Bad Request
    else Datos válidos
        VAL-->>API: OK
        API->>SVC: addCandidate(candidateData)
        SVC->>DB: INSERT Candidate
        SVC->>DB: INSERT Education[]
        SVC->>DB: INSERT WorkExperience[]
        SVC->>DB: INSERT Resume
        DB-->>SVC: Candidato persistido
        SVC-->>API: candidato creado
        API-->>FE: 201 Created
        FE-->>Reclutador: Mensaje de éxito
    end
```

### 3.3 Flujo E2E — Gestión del proceso de selección (kanban de posición)

```mermaid
sequenceDiagram
    actor Reclutador
    participant FE as Frontend (PositionDetails)
    participant API as Backend API
    participant PSVC as positionService
    participant CSVC as candidateService
    participant DB as PostgreSQL (Prisma)

    Reclutador->>FE: Abre /positions/:id
    FE->>API: GET /positions/:id/interviewflow
    API->>PSVC: getInterviewFlowByPositionService(id)
    PSVC->>DB: SELECT Position + InterviewFlow + InterviewStep[]
    DB-->>PSVC: Flujo de entrevista
    PSVC-->>API: { positionName, interviewFlow }
    API-->>FE: 200 OK (columnas del kanban)

    FE->>API: GET /positions/:id/candidates
    API->>PSVC: getCandidatesByPositionService(id)
    PSVC->>DB: SELECT Application + Candidate + Interview[]
    DB-->>PSVC: Aplicaciones con nota media calculada
    PSVC-->>API: Lista de candidatos por fase
    API-->>FE: 200 OK
    FE-->>Reclutador: Tablero kanban renderizado por fases

    Reclutador->>FE: Arrastra candidato a otra fase (drag & drop)
    FE->>API: PUT /candidates/:id { applicationId, currentInterviewStep }
    API->>CSVC: updateCandidateStage(id, applicationId, step)
    CSVC->>DB: UPDATE Application.currentInterviewStep
    alt Aplicación no encontrada
        DB-->>CSVC: null
        CSVC-->>API: Error "Application not found"
        API-->>FE: 404 Not Found
    else Actualización correcta
        DB-->>CSVC: Application actualizada
        CSVC-->>API: application
        API-->>FE: 200 OK
        FE-->>Reclutador: Tarjeta movida de columna de forma persistente
    end
```

### 3.4 Flujo E2E — Publicación y consulta de posiciones

```mermaid
flowchart TD
    A[Reclutador entra a /positions] --> B[GET /positions]
    B --> C{isVisible = true?}
    C -- "Sí" --> D[Se listan en el tablero de posiciones]
    C -- "No" --> E[No aparece en el listado público]
    D --> F[Reclutador filtra por título / fecha / estado / manager]
    D --> G[Reclutador pulsa 'Ver proceso']
    G --> H[Navega a /positions/:id → kanban de candidatos]
```

## 4. Flujos E2E (Given/When/Then)

### 4.1 Alta de candidato exitosa

```gherkin
Feature: Alta de candidato

  Scenario: Un reclutador registra un candidato con datos válidos
    Given el reclutador está en el formulario "Añadir Nuevo Candidato"
    And ha rellenado nombre, apellidos, email, teléfono y dirección válidos
    And ha adjuntado un CV en formato PDF o DOCX
    When el reclutador envía el formulario
    Then el frontend invoca "POST /candidates" con los datos del candidato
    And el backend valida los datos con "validateCandidateData"
    And se crea el registro del candidato junto con sus educaciones, experiencias y CV
    And el sistema responde con estado 201 y muestra un mensaje de éxito
```

### 4.2 Alta de candidato con datos inválidos

```gherkin
Feature: Alta de candidato

  Scenario: El email del candidato ya existe en el sistema
    Given ya existe un candidato registrado con el email "juan@example.com"
    When el reclutador envía un nuevo candidato con el mismo email
    Then el backend detecta la violación de restricción única (P2002) en Prisma
    And responde con estado 400 y el mensaje "The email already exists in the database"
    And el frontend muestra el error al reclutador sin crear el candidato

  Scenario: El nombre contiene caracteres no permitidos
    Given el reclutador introduce un nombre con números o símbolos
    When el reclutador envía el formulario
    Then "validateName" lanza el error "Invalid name"
    And el backend responde con estado 400
    And no se persiste ningún dato en la base de datos
```

### 4.3 Subida de currículum (CV)

```gherkin
Feature: Subida de CV

  Scenario: Subida de un fichero PDF válido
    Given el reclutador selecciona un archivo "cv.pdf" de menos de 10MB
    When el componente FileUploader envía "POST /upload"
    Then multer almacena el fichero en el directorio de "uploads/"
    And el backend responde con estado 200, "filePath" y "fileType"
    And el formulario de candidato asocia esa ruta al campo "cv"

  Scenario: Subida de un tipo de fichero no soportado
    Given el reclutador selecciona un archivo con extensión ".png"
    When se envía "POST /upload"
    Then el filtro "fileFilter" rechaza el archivo
    And el backend responde con estado 400 "Invalid file type, only PDF and DOCX are allowed!"
```

### 4.4 Consulta de candidato por ID

```gherkin
Feature: Consulta de candidato

  Scenario: El candidato existe
    Given existe un candidato con id "42" en la base de datos
    When se realiza "GET /candidates/42"
    Then el backend responde con estado 200
    And el cuerpo de la respuesta incluye datos personales, educaciones, experiencias y CV

  Scenario: El candidato no existe
    Given no existe ningún candidato con id "999"
    When se realiza "GET /candidates/999"
    Then el backend responde con estado 404 "Candidate not found"
```

### 4.5 Listado de posiciones visibles

```gherkin
Feature: Listado de posiciones

  Scenario: Se listan solo las posiciones visibles
    Given existen posiciones con "isVisible = true" e "isVisible = false"
    When el reclutador accede a "/positions"
    Then el frontend invoca "GET /positions"
    And el backend devuelve únicamente las posiciones con "isVisible = true"
    And el tablero muestra tarjetas con título, manager, fecha límite y estado
```

### 4.6 Movimiento de un candidato entre fases del proceso (kanban)

```gherkin
Feature: Cambio de fase de un candidato

  Scenario: Se mueve un candidato a la siguiente fase con éxito
    Given el reclutador está viendo el detalle de una posición en "/positions/:id"
    And el candidato "Ana López" se encuentra en la fase "Entrevista Telefónica"
    When el reclutador arrastra la tarjeta de "Ana López" a la columna "Entrevista Técnica"
    Then el frontend invoca "PUT /candidates/:id" con "applicationId" y el nuevo "currentInterviewStep"
    And el backend actualiza la aplicación en la base de datos
    And la tarjeta permanece en la nueva columna tras refrescar la página

  Scenario: La aplicación del candidato no existe
    Given se intenta mover una aplicación con un "applicationId" inexistente
    When se invoca "PUT /candidates/:id"
    Then el backend responde con estado 404 "Application not found"
    And el frontend registra el error en consola sin romper la interfaz
```

### 4.7 Consulta del flujo de entrevista de una posición

```gherkin
Feature: Flujo de entrevista de una posición

  Scenario: La posición tiene un flujo de entrevista configurado
    Given la posición "Backend Developer" tiene un "InterviewFlow" con 3 pasos ordenados
    When se realiza "GET /positions/:id/interviewflow"
    Then el backend devuelve el nombre de la posición y los pasos ordenados por "orderIndex"
    And el frontend construye una columna del kanban por cada paso del flujo

  Scenario: La posición no existe
    Given no existe una posición con el id solicitado
    When se realiza "GET /positions/:id/interviewflow"
    Then el backend responde con estado 404 "Position not found"
```

## 5. Estructura de carpetas

```text
AI4Devs-qa-2606-roo/
├── README.md                  # Guía general y de despliegue (EN/ES)
├── docker-compose.yml         # Servicio de PostgreSQL para desarrollo local
├── .env                       # Variables de entorno (credenciales de BD, etc.)
├── docs/
│   └── README.md              # Este documento (documentación técnica ampliada)
│
├── cypress.config.js          # Configuración de Cypress (baseUrl, apiUrl, specPattern, tareas de BD y uploads)
├── cypress/                   # Pruebas E2E (ver §11)
│   ├── integration/           # position.spec.js: interfaz Position (MND-01…06 y EXT-27…38)
│   ├── e2e/EXT/               # Resto de flujos del sistema
│   ├── docs/                  # Catálogo visual de casos de prueba
│   ├── fixtures/              # Datos de prueba (espejo del seed)
│   └── support/               # Comandos personalizados (reset de BD, drag & drop, formularios)
│
├── backend/
│   ├── api-spec.yaml          # Especificación OpenAPI de la API REST
│   ├── ManifestoBuenasPracticas.md
│   ├── ModeloDatos.md         # Descripción del modelo de datos + diagrama ERD
│   ├── jest.config.js         # Configuración de tests (Jest + ts-jest)
│   ├── tsconfig.json
│   ├── prisma/
│   │   ├── schema.prisma      # Esquema de la base de datos (fuente de verdad del modelo)
│   │   ├── migrations/        # Historial de migraciones SQL generadas por Prisma
│   │   └── seed.ts            # Script de carga de datos de ejemplo
│   └── src/
│       ├── index.ts           # Punto de entrada del servidor Express
│       ├── routes/            # Definición de rutas HTTP (candidateRoutes, positionRoutes)
│       ├── presentation/
│       │   └── controllers/   # Controladores: adaptan HTTP request/response a los servicios
│       ├── application/
│       │   ├── services/      # Lógica de aplicación (candidateService, positionService, fileUploadService)
│       │   └── validator.ts   # Validación de datos de entrada
│       ├── domain/
│       │   └── models/        # Entidades de dominio (Candidate, Position, Application, Interview, ...)
│       └── prompts/           # Plantillas/notas de apoyo para desarrollo (no productivo)
│
└── frontend/
    ├── public/                 # index.html, favicon, manifest
    └── src/
        ├── App.js               # Definición de rutas (react-router-dom)
        ├── index.tsx            # Punto de entrada de la SPA
        ├── components/
        │   ├── RecruiterDashboard.js   # Pantalla de inicio del reclutador
        │   ├── AddCandidateForm.js     # Formulario de alta de candidato
        │   ├── FileUploader.js         # Subcomponente de subida de CV
        │   ├── Positions.tsx           # Listado/filtro de posiciones
        │   ├── PositionDetails.js      # Tablero kanban del proceso de selección
        │   ├── StageColumn.js          # Columna del kanban (una fase del flujo)
        │   ├── CandidateCard.js        # Tarjeta de candidato dentro de una fase
        │   └── CandidateDetails.js     # Panel lateral con el detalle del candidato
        ├── services/
        │   └── candidateService.js     # Wrapper de llamadas HTTP (axios) al backend
        └── assets/                     # Recursos estáticos (logo, imágenes)
```

## 6. Tecnologías usadas

### Backend

| Categoría | Tecnología |
|---|---|
| Lenguaje | TypeScript |
| Runtime | Node.js |
| Framework HTTP | Express 4 |
| ORM | Prisma 5 (`@prisma/client`) |
| Base de datos | PostgreSQL |
| Subida de ficheros | Multer |
| Documentación de API | OpenAPI 3.0 (`swagger-jsdoc`, `swagger-ui-express`) |
| CORS | `cors` |
| Variables de entorno | `dotenv` |
| Testing | Jest + `ts-jest` |
| Linting/formato | ESLint + Prettier |
| Desarrollo | `ts-node-dev` (hot reload) |

### Frontend

| Categoría | Tecnología |
|---|---|
| Librería UI | React 18 (Create React App) |
| Lenguaje | JavaScript / TypeScript (mixto: `.js` y `.tsx`) |
| Enrutado | `react-router-dom` v6 |
| Estilos/UI Kit | Bootstrap 5 + `react-bootstrap` + `react-bootstrap-icons` |
| Drag & Drop (kanban) | `react-beautiful-dnd` (y dependencias `react-dnd`/`react-dnd-html5-backend`) |
| Selección de fechas | `react-datepicker` |
| Cliente HTTP | `axios` (servicio) y `fetch` nativo (en componentes) |
| Testing | Jest + Testing Library (`@testing-library/react`, `jest-dom`, `user-event`) |

### Infraestructura / DevOps

- **Docker Compose** para levantar PostgreSQL en desarrollo local.
- **GitHub Actions** + **AWS EC2** para CI/CD (build, tests y despliegue), según se documenta en el `README.md` raíz.
- **PM2** y **Nginx** recomendados para la ejecución en producción sobre EC2.

## 7. Arquitectura de backend y frontend

### 7.1 Backend — Arquitectura por capas (estilo hexagonal simplificado)

El backend sigue una separación por capas inspirada en *Clean Architecture / DDD ligero*:

```mermaid
flowchart TB
    subgraph Presentation["presentation/ (Controladores)"]
        C1[candidateController]
        C2[positionController]
    end

    subgraph Routes["routes/"]
        R1[candidateRoutes]
        R2[positionRoutes]
    end

    subgraph Application["application/ (Casos de uso)"]
        S1[candidateService]
        S2[positionService]
        S3[fileUploadService]
        V[validator]
    end

    subgraph Domain["domain/models/ (Entidades)"]
        M1[Candidate]
        M2[Position / Application / Interview]
        M3[InterviewFlow / InterviewStep / InterviewType]
        M4[Company / Employee]
    end

    DB[(PostgreSQL vía Prisma Client)]

    R1 --> C1
    R2 --> C2
    C1 --> S1
    C1 --> V
    C2 --> S2
    S1 --> M1
    S1 --> M2
    S2 --> M2
    S2 --> M3
    M1 --> DB
    M2 --> DB
    M3 --> DB
    M4 --> DB
    S3 -.-> FS[(uploads/)]
```

**Responsabilidades por capa:**

- **`routes/`**: define los endpoints HTTP y los asocia a un controlador. No contiene lógica de negocio.
- **`presentation/controllers/`**: traduce la petición HTTP (params, body) en llamadas a los servicios de aplicación, y transforma el resultado (o error) en una respuesta HTTP con el código de estado adecuado.
- **`application/services/`**: contiene los casos de uso (alta de candidato, cambio de fase, cálculo de nota media, subida de fichero) y las reglas de validación (`validator.ts`).
- **`domain/models/`**: entidades de dominio que encapsulan el acceso a Prisma (p. ej. `Candidate.save()`, `Application.findOneByPositionCandidateId()`), actuando como una capa ligera de repositorio sobre el ORM.
- **`prisma/`**: fuente de verdad del esquema relacional; genera el cliente tipado que consumen los modelos de dominio.

Middlewares globales configurados en `index.ts`: parseo de JSON, inyección de `prisma` en el `Request`, CORS restringido a `http://localhost:3000`, logging de peticiones y manejo centralizado de errores no controlados (500).

### 7.2 Frontend — Arquitectura de componentes (SPA)

```mermaid
flowchart TB
    App[App.js<br/>BrowserRouter + Routes] --> RD[RecruiterDashboard<br/>'/']
    App --> ACF[AddCandidateForm<br/>'/add-candidate']
    App --> POS[Positions<br/>'/positions']
    App --> PD[PositionDetails<br/>'/positions/:id']

    ACF --> FU[FileUploader]
    PD --> SC[StageColumn xN]
    SC --> CC[CandidateCard]
    PD --> CD[CandidateDetails]

    ACF -. axios .-> SVC[services/candidateService.js]
    FU -. axios .-> SVC
    POS -. fetch .-> API[(Backend REST API)]
    PD -. fetch .-> API
    SVC -. HTTP .-> API
```

**Patrón general:**

- Enrutado declarativo con `react-router-dom` (`App.js`), sin gestor de estado global (Redux/Context): cada pantalla gestiona su propio estado local con `useState`/`useEffect`.
- Los componentes de pantalla (`RecruiterDashboard`, `AddCandidateForm`, `Positions`, `PositionDetails`) actúan como *containers*: obtienen datos del backend y los pasan como props a componentes de presentación (`StageColumn`, `CandidateCard`, `CandidateDetails`, `FileUploader`).
- Convivencia de dos estilos de llamada HTTP: `services/candidateService.js` (con `axios`, reutilizable) y llamadas `fetch` directas dentro de componentes (`Positions.tsx`, `PositionDetails.js`) — pendiente de unificación.
- El tablero kanban (`PositionDetails`) usa `react-beautiful-dnd` para el *drag & drop* entre columnas (fases del flujo de entrevista) y sincroniza cada movimiento con el backend mediante `PUT /candidates/:id`.

## 8. Identificación de módulos

| Módulo | Ubicación | Responsabilidad |
|---|---|---|
| **Gestión de candidatos** | `backend/src/{routes,presentation,application}/*candidate*`, `frontend/src/components/AddCandidateForm.js`, `CandidateDetails.js`, `CandidateCard.js` | Alta, consulta y actualización de fase de candidatos; validación de datos personales, educación y experiencia |
| **Gestión de ficheros (CV)** | `backend/src/application/services/fileUploadService.ts`, `frontend/src/components/FileUploader.js` | Subida, validación de tipo/tamaño y almacenamiento de currículums |
| **Gestión de posiciones** | `backend/src/{routes,presentation,application}/*position*`, `frontend/src/components/Positions.tsx`, `PositionDetails.js` | Listado de vacantes visibles y detalle del proceso asociado a una posición |
| **Flujo de entrevistas** | `domain/models/InterviewFlow.ts`, `InterviewStep.ts`, `InterviewType.ts`, endpoint `/positions/:id/interviewflow` | Definición y consulta de las fases configuradas para el proceso de una posición |
| **Entrevistas y evaluación** | `domain/models/Interview.ts`, cálculo `calculateAverageScore` en `positionService.ts` | Registro de entrevistas realizadas y cálculo de la puntuación media del candidato |
| **Empresas y empleados** | `domain/models/Company.ts`, `Employee.ts` | Modelo multi-tenant de empresas y su personal (entrevistadores) |
| **Validación de dominio** | `backend/src/application/validator.ts` | Reglas de formato (nombre, email, teléfono, fechas, longitud de campos) previas a la persistencia |
| **Dashboard del reclutador** | `frontend/src/components/RecruiterDashboard.js` | Punto de entrada visual con accesos directos a las funcionalidades principales |
| **Persistencia** | `backend/prisma/schema.prisma`, `prisma/migrations/`, `prisma/seed.ts` | Definición del esquema relacional, migraciones y datos de ejemplo |

## 9. Identificación de interfaces

### 9.1 Interfaces externas (API REST — backend)

Definidas formalmente en [`backend/api-spec.yaml`](../backend/api-spec.yaml) (OpenAPI 3.0):

| Método | Endpoint | Descripción | Controlador |
|---|---|---|---|
| `POST` | `/candidates` | Crea un candidato (con educación, experiencia y CV opcional) | `candidateController.addCandidateController` |
| `GET` | `/candidates/:id` | Recupera el detalle de un candidato | `candidateController.getCandidateById` |
| `PUT` | `/candidates/:id` | Actualiza la fase de entrevista de la aplicación de un candidato | `candidateController.updateCandidateStageController` |
| `POST` | `/upload` | Sube un fichero de CV (PDF/DOCX, máx. 10MB) | `fileUploadService.uploadFile` |
| `GET` | `/positions` | Lista las posiciones con `isVisible = true` | `positionController.getAllPositions` |
| `GET` | `/positions/:id/candidates` | Lista los candidatos aplicados a una posición, agrupados por fase | `positionController.getCandidatesByPosition` |
| `GET` | `/positions/:id/interviewflow` | Devuelve el flujo de entrevista (fases ordenadas) de una posición | `positionController.getInterviewFlowByPosition` |
| `GET` | `/` | *Health check* básico ("Hola LTI!") | `index.ts` |

**Convenciones comunes:**
- Formato de intercambio: JSON (excepto `/upload`, que usa `multipart/form-data`).
- Códigos de error: `400` (datos inválidos), `404` (recurso no encontrado), `500` (error interno).
- CORS restringido en desarrollo al origen `http://localhost:3000`.

### 9.2 Interfaces internas (contratos entre capas del backend)

| Interfaz | Definida en | Consumida por |
|---|---|---|
| `validateCandidateData(data)` | `application/validator.ts` | `candidateService.addCandidate` |
| `addCandidate / findCandidateById / updateCandidateStage` | `application/services/candidateService.ts` | `presentation/controllers/candidateController.ts` |
| `getAllPositionsService / getCandidatesByPositionService / getInterviewFlowByPositionService` | `application/services/positionService.ts` | `presentation/controllers/positionController.ts` |
| Modelos de dominio (`Candidate`, `Education`, `WorkExperience`, `Resume`, `Application`, etc.) | `domain/models/*.ts` | Capa de `application/services` |
| `PrismaClient` (inyectado en `req.prisma` y usado directamente en `positionService`) | `@prisma/client` | Modelos de dominio y servicios |

### 9.3 Interfaces de integración frontend ↔ backend

| Componente frontend | Interfaz consumida |
|---|---|
| `services/candidateService.js` (`uploadCV`, `sendCandidateData`) | `POST /upload`, `POST /candidates` |
| `AddCandidateForm.js` | `POST /candidates` (vía `fetch` directo) |
| `Positions.tsx` | `GET /positions` |
| `PositionDetails.js` | `GET /positions/:id/interviewflow`, `GET /positions/:id/candidates`, `PUT /candidates/:id` |

### 9.4 Interfaz de datos (contrato con la base de datos)

El contrato de persistencia está definido en `backend/prisma/schema.prisma` y documentado con su diagrama entidad-relación en [`backend/ModeloDatos.md`](../backend/ModeloDatos.md). Las entidades principales son: `Candidate`, `Education`, `WorkExperience`, `Resume`, `Company`, `Employee`, `InterviewType`, `InterviewFlow`, `InterviewStep`, `Position`, `Application` e `Interview`.

## 10. Puesta en marcha del entorno

### 10.1 Requisitos previos

- **Node.js** (recomendado v16+; el pipeline de referencia usa Node 16).
- **npm** (incluido con Node.js).
- **Docker** y **Docker Compose** (para levantar PostgreSQL sin instalarlo localmente).
- Puertos libres: `3000` (frontend), `3010` (backend) y `5432` (o el que configures) para PostgreSQL.

### 10.2 Clonar el repositorio

```sh
git clone <URL-del-repositorio>
cd AI4Devs-qa-2606-roo
```

### 10.3 Configurar variables de entorno

Crea/edita el archivo `.env` en la raíz del proyecto (usado por `docker-compose.yml`) con, al menos:

```env
DB_USER=postgres
DB_PASSWORD=password
DB_NAME=mydatabase
DB_PORT=5432
```

En `backend/.env`, define la cadena de conexión que usará Prisma (debe coincidir con los valores anteriores):

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/mydatabase"
```

> ⚠️ Si `DATABASE_URL` no se resuelve correctamente desde el `.env`, puedes fijar la URL completa directamente en la propiedad `url` del bloque `datasource db` de `backend/prisma/schema.prisma`.

### 10.4 Levantar la base de datos con Docker

```sh
docker-compose up -d
```

Esto arranca un contenedor de PostgreSQL en segundo plano con los datos definidos en `.env`. Para detenerlo:

```sh
docker-compose down
```

Para verificar que el contenedor está corriendo:

```sh
docker ps
```

### 10.5 Instalar dependencias

```sh
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 10.6 Generar el cliente Prisma y preparar el esquema de base de datos

Desde `backend/`:

```sh
npx prisma generate      # Genera el cliente Prisma tipado
npx prisma migrate dev   # Crea/aplica las migraciones y sincroniza el esquema con la BD
ts-node prisma/seed.ts   # (Opcional) Carga datos de ejemplo
```

### 10.7 Levantar el backend

```sh
cd backend

# Modo desarrollo (hot reload)
npm run dev

# — o bien, modo build + producción —
npm run build
npm start
```

El backend quedará disponible en **http://localhost:3010**.

### 10.8 Levantar el frontend

En una nueva terminal:

```sh
cd frontend
npm start
```

La SPA quedará disponible en **http://localhost:3000** y ya está configurada para consumir el backend en `http://localhost:3010` (ver CORS en `backend/src/index.ts`).

### 10.9 Verificación rápida del entorno

1. Abre `http://localhost:3000` → deberías ver el **Dashboard del Reclutador**.
2. Ve a "Ver Posiciones" → si ejecutaste el *seed*, deberías ver posiciones listadas (`GET /positions`).
3. Entra a "Añadir Nuevo Candidato", rellena el formulario y envíalo → debe responder `201 Created`.
4. Alternativamente, prueba la API directamente:

```sh
curl -X POST http://localhost:3010/candidates \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Albert",
    "lastName": "Saelices",
    "email": "albert.saelices@gmail.com",
    "phone": "656874937",
    "address": "Calle Sant Dalmir 2, 5ºB. Barcelona",
    "educations": [{"institution": "UC3M", "title": "Computer Science", "startDate": "2006-12-31", "endDate": "2010-12-26"}],
    "workExperiences": [{"company": "Coca Cola", "position": "SWE", "description": "", "startDate": "2011-01-13", "endDate": "2013-01-17"}],
    "cv": {"filePath": "uploads/1715760936750-cv.pdf", "fileType": "application/pdf"}
  }'
```

5. Verifica el candidato creado con `GET http://localhost:3010/candidates/<id>`.

### 10.10 Ejecutar los tests

```sh
# Backend (Jest + ts-jest)
cd backend
npm test

# Frontend (Jest + Testing Library)
cd frontend
npm test
```

### 10.11 Notas para despliegue (EC2 + GitHub Actions)

El `README.md` de la raíz documenta el procedimiento completo de despliegue en una instancia **EC2** (Node.js, PM2, Nginx) y la configuración de **GitHub Actions** (secrets `AWS_ACCESS_ID`, `AWS_ACCESS_KEY`, `EC2_INSTANCE`). Consulta ese documento para el flujo de CI/CD y el checklist previo a abrir un Pull Request.

## 11. Pruebas E2E con Cypress

### 11.1 Estrategia

| Aspecto | Decisión |
|---|---|
| **Prefijos** | `MND-xx`: escenarios obligatorios de la interfaz *Position* (carga del tablero y cambio de fase). `EXT-xx`: resto de flujos del sistema. **MND + EXT = total de casos.** |
| **Datos de prueba** | Antes de cada test que modifica datos se ejecuta `cy.resetDb()` (`prisma migrate reset` + `prisma/seed.ts`), de modo que los IDs y fases son deterministas (ver `cypress/fixtures/seedData.json`). ⚠️ **Borra los datos de la BD local.** |
| **Arrastre (drag & drop)** | `cy.dragCardWithMouse` simula el arrastre real con eventos de ratón (MND). `cy.dragCardWithKeyboard` usa el arrastre accesible de `react-beautiful-dnd` (espacio + flechas) (EXT-27). |
| **Funcionalidad no desarrollada** | Test completo (Given/When/Then y aserciones) marcado con `it.skip` y la etiqueta `[PENDIENTE DE DESARROLLO]`. Para activarlo basta con quitar `.skip`. |
| **Inyección de errores** | Solo EXT-33 simula una respuesta del backend (`cy.intercept` con 500); el resto de tests se ejecuta contra backend y BD reales. |

```text
cypress/
├── integration/
│   └── position.spec.js              # Interfaz Position: MND-01 … MND-06 y EXT-27 … EXT-38
├── e2e/
│   └── EXT/
│       ├── dashboard.cy.js           # EXT-01 … EXT-04
│       ├── candidates.cy.js          # EXT-05 … EXT-17
│       └── positions_list.cy.js      # EXT-18 … EXT-26
├── docs/README.md                    # Catálogo visual de casos (mapa de flujos y tabla maestra)
├── fixtures/                         # seedData.json (espejo del seed), candidate.json
└── support/commands.js               # resetDb, getStageColumn, getCandidateCard, dragCardWithMouse/Keyboard, fillCandidateForm
cypress.config.js                     # baseUrl, apiUrl, specPattern (integration + e2e) y tareas db:reset, db:updatePosition, uploads:*
```

### 11.2 Ejecución

Precondiciones: PostgreSQL levantado (§10.4), backend en `http://localhost:3010` (§10.7) y frontend en `http://localhost:3000` (§10.8).

```sh
npx cypress open          # modo interactivo (equivale a npm run cy:open)
npm run cy:run            # suite completa en modo headless
npm run cy:run:position   # solo la interfaz Position (integration/position.spec.js)
```

El catálogo visual de todos los casos (mapa de flujos y tabla maestra Given/When/Then) está en [`cypress/docs/README.md`](../cypress/docs/README.md).

### 11.3 Matriz de cobertura

| ID | Escenario | Flujo de referencia | Spec | Estado |
|---|---|---|---|---|
| MND-01 | Se muestra el título de la posición | §3.3, §4.7 | `integration/position.spec` | Pasa |
| MND-02 | Una columna por cada fase del proceso, en el orden del flujo | §3.3, §4.7 | `integration/position.spec` | Pasa |
| MND-03 | Cada tarjeta de candidato aparece en la columna de su fase actual | §3.3, §4.6 | `integration/position.spec` | Pasa |
| MND-04 | Arrastrar una tarjeta (ratón) la mueve a la nueva columna | §3.3, §4.6 | `integration/position.spec` | Pasa |
| MND-05 | El cambio de fase se envía con `PUT /candidates/:id` (payload y respuesta 200) | §3.3, §4.6 | `integration/position.spec` | Pasa |
| MND-06 | La nueva fase queda persistida (API + recarga de la página) | §4.6 | `integration/position.spec` | Pasa |
| EXT-01 | Dashboard: logo, título y accesos principales | §7.2 | `EXT/dashboard` | Pasa |
| EXT-02 | Dashboard → formulario de alta de candidato | §7.2 | `EXT/dashboard` | Pasa |
| EXT-03 | Dashboard → listado de posiciones | §3.4 | `EXT/dashboard` | Pasa |
| EXT-04 | Health check `GET /` del backend | §9.1 | `EXT/dashboard` | Pasa |
| EXT-05 | Alta de candidato con datos personales válidos | §3.2, §4.1 | `EXT/candidates` | Pasa |
| EXT-06 | Alta de candidato con educación y experiencia laboral | §3.2, §4.1 | `EXT/candidates` | **Falla** (D-01) |
| EXT-07 | Añadir y eliminar secciones de educación y experiencia | §3.2 | `EXT/candidates` | Pasa |
| EXT-08 | No se envía el formulario sin campos obligatorios | §4.2 | `EXT/candidates` | Pasa |
| EXT-09 | No se envía el formulario con email mal formado | §4.2 | `EXT/candidates` | Pasa |
| EXT-10 | Error por nombre con caracteres inválidos (400) | §4.2 | `EXT/candidates` | Pasa |
| EXT-11 | Error por teléfono con formato inválido (400) | §4.2 | `EXT/candidates` | Pasa |
| EXT-12 | Error por email duplicado (400) | §4.2 | `EXT/candidates` | Pasa |
| EXT-13 | Subida de CV PDF y asociación al candidato | §3.2, §4.3 | `EXT/candidates` | Pasa (precondición D-02) |
| EXT-14 | Subida de CV DOCX | §4.3 | `EXT/candidates` | Pasa (precondición D-02) |
| EXT-15 | Rechazo de tipo de archivo no permitido (400) | §4.3 | `EXT/candidates` | Pasa |
| EXT-16 | Rechazo de CV mayor de 10MB | §4.3 | `EXT/candidates` | Pasa |
| EXT-17 | `GET /candidates/:id`: 404 si no existe, 400 si el ID no es numérico | §4.4 | `EXT/candidates` | Pasa |
| EXT-18 | El listado muestra solo posiciones visibles | §3.4, §4.5 | `EXT/positions_list` | Pasa |
| EXT-19 | Tarjeta de posición: título, manager, fecha límite, estado y acciones | §4.5 | `EXT/positions_list` | Pasa (ver D-03) |
| EXT-20 | "Ver proceso" navega al tablero de la posición | §3.4 | `EXT/positions_list` | Pasa |
| EXT-21 | "Volver al Dashboard" | §7.2 | `EXT/positions_list` | Pasa |
| EXT-22 | Filtro por título | §3.4 | `EXT/positions_list` | Pendiente |
| EXT-23 | Filtro por fecha límite | §3.4 | `EXT/positions_list` | Pendiente |
| EXT-24 | Filtro por estado | §3.4 | `EXT/positions_list` | Pendiente |
| EXT-25 | Filtro por manager | §3.4 | `EXT/positions_list` | Pendiente |
| EXT-26 | "Editar" abre la edición de la posición | §7.2 | `EXT/positions_list` | Pendiente |
| EXT-27 | Cambio de fase con teclado (arrastre accesible) y persistencia | §4.6 | `integration/position.spec` | Pasa |
| EXT-28 | Soltar fuera de una columna no cambia la fase ni llama al backend | §4.6 | `integration/position.spec` | Pasa |
| EXT-29 | La tarjeta muestra la puntuación media del candidato | §3.3 | `integration/position.spec` | Pasa |
| EXT-30 | Clic en tarjeta abre el panel con el detalle del candidato | §4.4 | `integration/position.spec` | Pasa |
| EXT-31 | El panel de detalle se cierra | §7.2 | `integration/position.spec` | Pasa |
| EXT-32 | Registrar una nueva entrevista desde el panel (`POST /candidates/:id/interviews`) | §1, §2 | `integration/position.spec` | Pendiente |
| EXT-33 | Si falla el `PUT`, se registra el error y la interfaz no se rompe | §4.6 | `integration/position.spec` | Pasa |
| EXT-34 | "Volver a Posiciones" | §7.2 | `integration/position.spec` | Pasa |
| EXT-35 | Posición sin fases: muestra título y ninguna columna | §4.7 | `integration/position.spec` | Pasa |
| EXT-36 | Posición inexistente: 404 y página sin título ni columnas | §4.7 | `integration/position.spec` | Pasa |
| EXT-37 | `PUT /candidates/:id` con aplicación inexistente → 404 | §4.6 | `integration/position.spec` | Pasa |
| EXT-38 | `PUT /candidates/:id` con datos no numéricos → 400 | §9.1 | `integration/position.spec` | Pasa |

**Total: 44 casos = 6 MND + 38 EXT** (37 pasan, 1 falla por defecto, 6 pendientes de desarrollo).

Fuera del alcance E2E: la gestión de `Company`, `Employee` e `InterviewType` no tiene interfaz ni endpoint expuesto; solo existen en el modelo de datos y en el seed.

**Supuestos de comportamiento de los tests pendientes** (a validar con producto antes de desarrollar):

- **EXT-22 a EXT-25:** cada filtro reduce el listado a las posiciones que coinciden (título contiene el texto, fecha límite igual a la fecha elegida, estado igual al seleccionado, manager igual al seleccionado).
- **EXT-26:** "Editar" navega a `/positions/:id/edit` y muestra un formulario con el título precargado.
- **EXT-32:** `POST /candidates/:id/interviews` recibe `{ notes, score }`, responde `201` y la puntuación media del candidato se recalcula.

### 11.4 Defectos detectados durante la ejecución

| ID | Defecto | Impacto | Test afectado |
|---|---|---|---|
| D-01 | `Candidate.save()` envía a `prisma.candidate.create` las educaciones y experiencias recibidas con fechas `YYYY-MM-DD`; Prisma exige un DateTime ISO-8601 completo y responde 400. | No se puede dar de alta un candidato con educación o experiencia (ni por UI ni por API). | EXT-06 (falla) |
| D-02 | `fileUploadService` guarda en `../uploads/` (relativo a `backend/`), carpeta que no existe en el repositorio → `POST /upload` responde 500 (`ENOENT`). | La subida de CV falla en una instalación limpia. Los tests crean la carpeta como precondición y la eliminan al terminar. | EXT-13, EXT-14 |
| D-03 | `Positions.tsx` formatea `applicationDeadline` (UTC) con la zona horaria local: en UTC-6, `2024-12-31` se muestra como `30/12/2024`. | Fecha límite desfasada un día. EXT-19 valida solo el formato `dd/mm/aaaa`. | EXT-19 |
| D-04 | El seed deja la posición "Data Scientist" con un flujo sin fases, dos fases con `orderIndex: 2` y la aplicación de John Doe a esa posición en una fase de otro flujo. | El tablero de "Data Scientist" no muestra columnas ni candidatos. | EXT-35 |
| D-05 | El frontend llama a `/positions/:id/interviewFlow` y el backend define `/interviewflow`; funciona porque Express no distingue mayúsculas por defecto. | Inconsistencia de contrato. | MND-01…06 |
| D-06 | `PositionDetails` pide el flujo y los candidatos en paralelo, y asigna los candidatos a las columnas ya existentes: si la respuesta de candidatos llega antes que la del flujo, las tarjetas no se pintan. | Tablero sin candidatos de forma intermitente. Observado: 1 fallo en 7 ejecuciones del spec del tablero (EXT-30, sin reproducirse después). Puede afectar a cualquier test del tablero. | MND-01…06, EXT-27…34 |
| D-07 | El frontend llama a `POST /candidates/:id/interviews`, que no existe en el backend. | No se pueden registrar entrevistas. | EXT-32 (pendiente) |
