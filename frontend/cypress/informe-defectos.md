# Informe de defectos — interfaz "position"

Defectos de la aplicación detectados mientras diseñábamos y ejecutábamos la suite E2E
(`cypress/integration/position.spec.js`). Entorno de trabajo: Cypress 13 · React 18.3.1
· react-beautiful-dnd 13.1.1 · Node 24.

**Resumen ejecutivo.** Nueve defectos documentados; **dos críticos/altos reproducidos con Cypress**
(D-01 carrera de carga, D-02 sin rollback tras `PUT` fallido). La suite de regresión evita
falsos verdes en el flujo principal; los tests de caracterización **congelan** el bug hasta
que producto lo corrija. Esto es el diferencial del módulo: QA que **encuentra** problemas,
no solo automatiza el enunciado.

**Alcance de esta entrega.** Es un trabajo de *aseguramiento de calidad*, no de producto.
Por eso los defectos de la app **no se arreglan aquí**: se dejan documentados con
evidencia y una propuesta de arreglo, para tratarlos por separado y no mezclar cambios de
QA con cambios funcionales. La única excepción es un warning de compilación inofensivo
(D-08), que sí se limpió.

## Panorama

| Id | Prioridad | Área | Defecto | Cómo se comprobó |
|----|-----------|------|---------|------------------|
| D-01 | 🔴 Crítica | Carga de datos | Orden de respuestas no controlado → el tablero puede quedar sin candidatos | Reproducido (`defectos-conocidos.spec.js`) |
| D-02 | 🟠 Alta | Persistencia | El movimiento se pinta aunque el `PUT` falle (sin revertir ni avisar) | Reproducido (`defectos-conocidos.spec.js`) |
| D-03 | 🟡 Media | Estado React | `onDragEnd` muta el estado en lugar de crear uno nuevo | Revisión de código |
| D-04 | 🟡 Media | Modelo de datos | La tarjeta se asigna a su columna comparando texto, no id | Revisión de código |
| D-05 | 🟡 Media | Panel de detalle | Cierre duplicado y actualización de estado tras cerrar | Revisión de código |
| D-06 | 🔵 Baja | Configuración | Dirección del API escrita a mano en varios puntos | Revisión de código |
| D-07 | 🔵 Baja | Render | La valoración se dibuja sin sanear el valor recibido | Revisión de código |
| D-08 | ⚪ Trivial | Limpieza | Imports que nadie usa (avisos de ESLint) | Verificado (ya limpiado) |
| D-09 | 🔵 Baja | Configuración | `npm test` del frontend falla: apunta a un `jest.config.js` inexistente | Verificado |

> Aclaración de contrato: el enunciado menciona `PUT /candidate/:id` (singular), pero el
> backend publica `PUT /candidates/:id` (plural) y el frontend usa el correcto
> (`PositionDetails.js:61`). Las aserciones se escribieron contra el endpoint real.

---

## D-01 · 🔴 Crítica — El tablero puede cargar sin candidatos

**Ubicación:** `src/components/PositionDetails.js:16-57` (arranque en `:55-56`).

El efecto de arranque lanza dos peticiones a la vez, y la segunda **reescribe** lo que
deja la primera:

```js
fetchInterviewFlow();  // setStages(interviewSteps)          -> crea columnas
fetchCandidates();     // setStages(prev => prev.map(...))    -> reparte candidatos
```

`fetchCandidates` no aporta su propio estado inicial: opera sobre el que produjo
`fetchInterviewFlow`. Como no hay orden garantizado, si `/candidates` llega antes,
`prev` todavía es `[]`, el `map` produce `[]` y después llega `/interviewFlow` y fija las
columnas ya sin candidatos.

**Consecuencia.** De forma intermitente y sin ningún mensaje, el reclutador ve las
columnas pero ninguna tarjeta. El riesgo sube cuando `/interviewFlow` tarda más que
`/candidates` (más latencia o más carga).

**Reproducción (ejecutada, PASA):** forzamos el orden con `delay` en los intercepts.

```js
cy.intercept('GET', `${API}/positions/1/interviewFlow`, { fixture:'interviewFlow.json', delay:400 }).as('flow');
cy.intercept('GET', `${API}/positions/1/candidates`,    { fixture:'candidates.json',    delay:0   }).as('cands');
cy.visit('/positions/1');
cy.wait('@cands'); cy.wait('@flow');
cy.get('[data-testid="stage-header"]').should('have.length', 3);
cy.get('[data-testid="candidate-name"]').should('have.length', 0); // esperado sano: 3
```

**Arreglo propuesto.** Resolver ambas peticiones juntas y componer el estado una sola vez:

```js
const [flowRes, candRes] = await Promise.all([
  fetch(`${API}/positions/${id}/interviewFlow`),
  fetch(`${API}/positions/${id}/candidates`),
]);
const flow = await flowRes.json();
const candidates = await candRes.json();
setPositionName(flow.interviewFlow.positionName);
setStages(flow.interviewFlow.interviewFlow.interviewSteps.map(step => ({
  title: step.name, id: step.id,
  candidates: candidates.filter(c => c.currentInterviewStep === step.name).map(/* ... */),
})));
```

---

## D-02 · 🟠 Alta — El cambio de fase se muestra aunque no se guarde

**Ubicación:** `src/components/PositionDetails.js:80-98`; manejo de error en `:75-77`.

`onDragEnd` mueve la tarjeta en el estado (`:90-93`) y luego llama al `PUT` (`:97`). Si el
`PUT` responde error, el `catch` solo escribe en consola (`:76`): no revierte el
movimiento ni informa al usuario.

**Consecuencia.** La pantalla da por guardado un cambio que el backend rechazó; al
recargar, el candidato reaparece en su fase anterior sin explicación.

**Reproducción (ejecutada, PASA):**

```js
cy.intercept('PUT', `${API}/candidates/*`, { statusCode:500, body:{ message:'boom' } }).as('put');
// ...carga normal...
cy.dragCandidate('1', 'right', 1);
cy.wait('@put').its('response.statusCode').should('eq', 500);
cy.stageColumn('Technical Interview').should('contain.text', 'John Doe'); // permanece movida
cy.get('[role="alert"], .alert').should('not.exist');                     // no hay aviso
```

**Arreglo propuesto.** Recordar el estado anterior, restaurarlo si el `PUT` falla y
mostrar un aviso accesible (`role="alert"`). Con eso hecho, este mismo caso —con las
aserciones invertidas— pasa a ser una prueba de regresión permanente.

---

## D-03 · 🟡 Media — `onDragEnd` muta el estado de React

**Ubicación:** `src/components/PositionDetails.js:87-93`.

```js
const sourceStage = stages[source.droppableId];
const destStage   = stages[destination.droppableId];
sourceStage.candidates.splice(source.index, 1);          // altera el array actual
destStage.candidates.splice(destination.index, 0, moved); // altera el array actual
setStages([...stages]); // copia el arreglo exterior, pero las fases son las mismas
```

Se modifican directamente los arrays que React ya tiene en el estado; la copia posterior
es superficial.

**Consecuencia (directa de la mutación).** Hoy funciona por suerte. Rompe al memoizar
`StageColumn` con `React.memo` (compararía referencias de fase idénticas y no
re-renderizaría) o bajo modo concurrente, que asume estado inmutable. Y además **bloquea
el arreglo de D-02**, porque el estado previo ya se destruyó y no hay a qué revertir.

> Nota aparte (no es la causa del defecto): `index.tsx` no usa `React.StrictMode`. Es un
> punto independiente —StrictMode invoca los updaters dos veces y, con un updater que
> muta, duplicaría la mutación— que hoy conviene a las pruebas pero enmascara el problema.

**Arreglo propuesto.** Componer fases nuevas con `map`/`filter` e inserción inmutable.

---

## D-04 · 🟡 Media — Asignación de columna por texto en vez de por id

**Ubicación:** `src/components/PositionDetails.js:41`.

```js
.filter(candidate => candidate.currentInterviewStep === stage.title)
```

El candidato entra a una columna si su `currentInterviewStep` coincide **literalmente**
con el título de la fase.

**Consecuencia.** Un acento, una mayúscula o un renombrado de fase deja candidatos fuera
de toda columna, sin error. El emparejamiento debería hacerse por identificador de fase.

**Arreglo propuesto.** Que `/candidates` exponga el id de la fase y emparejar por id.

---

## D-05 · 🟡 Media — Cierre duplicado del panel de detalle

**Ubicación:** `src/components/CandidateDetails.js:35-69` (`handleSubmit`); las dos
llamadas a `onClose()` están en `:65` (dentro del `.then`) y `:68` (en el `.finally`).

Al registrar una entrevista, el `.then` actualiza estado y llama a `onClose()`, y además
el `.finally` vuelve a llamar a `onClose()`. Es decir: doble cierre en el camino feliz y
una actualización de estado cuando el componente ya se está cerrando.

**Consecuencia.** Aviso de React por actualizar un componente desmontado y una doble
transición de cierre.

**Arreglo propuesto.** Un solo `onClose()` y no tocar estado después de cerrar.

---

## D-06 · 🔵 Baja — Dirección del API escrita a mano

**Ubicación:** `PositionDetails.js:19`, `:35`, `:61` y `CandidateDetails.js:13`, `:37`.

`http://localhost:3010` aparece repetido; no hay variable de entorno ni configuración
central.

**Consecuencia.** No se puede apuntar a staging/producción sin editar el código, y las
pruebas se ven obligadas a repetir el mismo literal.

**Arreglo propuesto.** Centralizar en `process.env.REACT_APP_API_URL` con un valor por
defecto.

---

## D-07 · 🔵 Baja — La valoración se dibuja sin sanear el valor

**Ubicación:** `src/components/CandidateCard.js:20`.

```js
{Array.from({ length: candidate.rating }).map(/* ... icono ... */)}
```

Si `rating` llega nulo, decimal o negativo, el número de iconos es impredecible.

**Arreglo propuesto.** Normalizar el valor antes de usarlo como longitud, p. ej.
`Math.max(0, Math.round(Number(candidate.rating) || 0))`.

---

## D-08 · ⚪ Trivial — Imports que nadie usa (ya limpiado)

**Ubicación:** `PositionDetails.js:3` (`Offcanvas`) y `AddCandidateForm.js:2` (`InputGroup`).

Generaban avisos de ESLint (`no-unused-vars`) en cada compilación, que terminan tapando
avisos nuevos. **Resueltos en esta entrega**: ambos imports fueron eliminados.

---

## D-09 · 🔵 Baja — `npm test` del frontend falla

**Ubicación:** `frontend/package.json` (script `test`).

El script `test` es `jest --config jest.config.js`, pero **no existe** `frontend/jest.config.js`
(solo hay configuración de Jest en `backend/`). El comando falla de inmediato. Al ser un
proyecto CRA, el script esperable sería `react-scripts test`.

**Consecuencia.** No se pueden correr las pruebas unitarias del frontend; si un pipeline
ejecuta `npm test`, falla siempre. *(Es un defecto preexistente del repo base, no
introducido por esta entrega; se documenta pero no se corrige, por ser producto.)*

---

## Sobre las reproducciones

Las pruebas que reproducen D-01 y D-02 **se conservan como tests de caracterización
ejecutables** en `cypress/integration/defectos-conocidos.spec.js`: congelan el
comportamiento actual (defectuoso) del producto para que el defecto sea auditable y
repetible desde el repo. Están rotuladas explícitamente como "comportamiento no deseado".
Cuando D-01 y D-02 se corrijan, esas mismas pruebas —con las aserciones invertidas— pasan
a `position.spec.js` como regresión definitiva.
