# Testing E2E de la vista Position — proceso y decisiones

## Resumen

La vista `position` (tablero kanban de candidatos por fase de entrevista, en
`frontend/src/components/PositionDetails.js`) no tenía cobertura de tests
end-to-end. Este documento registra el proceso completo seguido para
construirla con Cypress: los prompts usados para dirigir el trabajo de un
asistente de IA, qué devolvió cada uno, las decisiones tomadas —incluyendo
rechazos y correcciones—, las discrepancias encontradas entre lo asumido al
empezar y el comportamiento real del código, y lo que quedó deliberadamente
fuera de alcance.

El principio que guio todo el proceso: verificar cada afirmación contra el
código y las herramientas reales antes de aceptarla, en vez de dar por buena
una respuesta que "suena razonable". Varias de las secciones siguientes
existen porque esa verificación encontró algo distinto de lo asumido.

---

## Instrucciones para ejecutar las pruebas E2E

```bash
# 1. Detener cualquier otro contenedor que ocupe el puerto de Postgres (5432)
docker stop <contenedor-en-conflicto>   # si aplica, sin borrar su volumen

# 2. Levantar la base de datos del proyecto
docker compose up -d

# 3. Backend: reset de esquema + seed (el seed NO se aplica solo con migrate reset)
cd backend
npx prisma migrate reset --force --skip-seed
npx ts-node --transpile-only prisma/seed.ts   # --transpile-only es necesario:
                                                # ts-node sin esa opción falla por
                                                # incompatibilidad con la versión
                                                # de TypeScript del proyecto
npm run dev            # puerto 3010

# 4. Frontend
cd ../frontend
npm install && npm start   # puerto 3000

# 5. Tests E2E, desde la raíz del repo
npx cypress run --spec cypress/e2e/position.cy.js
```

Cada test revierte los datos que modifica (ver "Cobertura" más abajo), así que
el spec se puede correr repetidas veces sin volver a sembrar la base.

---

## Cobertura de los tests

`cypress/e2e/position.cy.js` contiene tres tests:

**1. Retención de `/candidates` hasta que resuelve `/interviewFlow` (visit y reload, incluido 304).**
Cubre una condición de carrera real del front (ver "Discrepancias"): fuerza el
orden de los dos `GET` que dispara la vista al cargar, y confirma que la
protección sigue vigente tanto en la carga inicial como en recargas
posteriores, incluyendo el caso en que el servidor responde `304 Not
Modified`.

**2. Carga de página.** Verifica, contra los datos reales devueltos por el
backend: el título de la posición, una columna por cada fase del proceso con
su nombre visible, y que cada tarjeta de candidato aparece en la columna que
corresponde a su fase actual con su nombre completo. No valida el orden de
las columnas (el front no ordena por `orderIndex` y el seed tiene fases con
el mismo valor de `orderIndex`).

**3. Cambio de fase.** Elige dinámicamente un candidato con una columna
disponible a la derecha (deja registrado en el log cuál fue, para que un
fallo sea legible sin inspeccionar la base). Mueve la tarjeta con una
interacción de teclado (foco → `Space` para levantar → flecha → `Space` para
soltar) en vez de eventos de arrastre nativos, porque la librería de
drag-and-drop del proyecto no reacciona a estos últimos. Espera la respuesta
real del `PUT` al backend —no el estado optimista de la UI— y verifica el
path, el body, el status y el contenido de la respuesta. Confirma la
persistencia contra el backend directamente y tras un reload. Revierte la
fase original al final, verificado con una petición directa a la API.

Este último test fue validado con un control negativo: comentando
temporalmente la llamada que actualiza la fase en el front, el test falla
específicamente al esperar la respuesta del `PUT` (no en ninguna otra
aserción), lo que confirma que no pasa solo por el cambio visual optimista.

---

## Archivos modificados

- `frontend/src/components/CandidateCard.js` — único cambio en código de la
  aplicación: se agregó `data-testid={`candidate-card-${candidate.id}`}` en
  el nodo que recibe el handler de arrastre, para tener un selector estable
  (no dependiente de atributos internos de la librería de drag-and-drop ni
  del texto del candidato).
- `cypress.config.js` — `baseUrl`, la clave `expose` para la URL del backend,
  y una `task` de logging usada por los tests.
- `cypress/support/commands.js` — comandos reutilizables: navegación con
  orden forzado (`visitPosition`, `reloadPosition`), interacción de teclado
  con las tarjetas, y el mecanismo de retención entre los dos `GET`.
- `cypress/e2e/position.cy.js` — el spec.

---

## Proceso: prompts y decisiones

### 1. Análisis de contexto

**Prompt:**
```
Contexto: [carpeta del frontend con la vista position], [carpeta del backend con las rutas de candidatos]

Analizá estos tres puntos y resumímelos, sin escribir código ni tests todavía:

1. Drag-and-drop: qué librería se usa en la vista position para el arrastre de
   tarjetas entre columnas (nombre y versión exacta desde package.json), qué
   eventos dispara el componente al soltar una tarjeta, y qué función/handler
   es la que termina llamando al backend para actualizar la fase.

2. Selectores disponibles: para el título de la posición, cada columna de fase,
   y cada tarjeta de candidato, indicá qué atributo puedo usar para
   seleccionarlos en un test E2E (data-testid si existe, rol ARIA, o texto
   visible) — verificado en el JSX/TSX real de cada componente, no inventado.

3. Contrato real del endpoint que actualiza la fase de un candidato: método
   HTTP, path exacto, forma del body y de la response, verificado en el
   archivo de rutas/controller del backend — no en ningún enunciado ni
   documentación previa, porque puede no coincidir.

Si algo de esto no está claro en el código (por ejemplo, si no hay
data-testid en algún componente), decilo explícitamente en vez de asumir uno.
```

**Resultado:** confirmó `react-beautiful-dnd` ^13.1.1 como única librería de
arrastre en uso (detectó además dos dependencias de otra librería de
drag-and-drop en `package.json` que no se usan en ningún archivo); reportó
que no existe ningún `data-testid` en los tres componentes de la vista;
verificó el contrato real del endpoint contra el controller del backend.

**Decisiones tomadas:** usar interacción de teclado para simular el arrastre
en los tests (la librería no escucha eventos de arrastre nativos); usar texto
visible para título y columnas, y agregar un `data-testid` únicamente en la
tarjeta de candidato (el resto de los nombres son estables por venir de la
configuración del proceso; el nombre del candidato puede repetirse o
cambiar).

### 2. Plan de implementación

**Prompt:**
```
Con este contexto confirmado:
- Endpoint real: PUT http://localhost:3010/candidates/:id, body
  { applicationId: number, currentInterviewStep: number }
- Drag-and-drop: react-beautiful-dnd, se testea con interacción de teclado
  (foco en la tarjeta → Space para levantar → flechas para mover entre
  columnas → Space para soltar), no con eventos HTML5 nativos.
- Selectores: texto visible para el título de la posición y los headers de
  columna; se va a agregar un data-testid a CandidateCard (proponé el
  formato exacto del atributo).
- Archivo de test: cypress/e2e/position.cy.js

Necesito el plan de los tests E2E para la vista position, cubriendo:
1. Carga de página: título visible, una columna por fase de interviewFlow,
   cada tarjeta en la columna que corresponde a su currentInterviewStep.
2. Cambio de fase: arrastrar una tarjeta a otra columna, verificar que se
   mueve visualmente Y que el backend recibe el PUT correcto.

Dame el plan de implementación antes de escribir ningún test: qué fixtures
o intercepts vas a usar para los datos de interviewFlow y candidates, cómo
vas a esperar la respuesta real del backend en vez de la actualización
optimista del estado local, y el data-testid exacto que proponés agregar.
No escribas el spec todavía. Hacé las preguntas que necesites.
```

**Resultado y decisiones intermedias:** antes de proponer el plan, el
asistente identificó una condición de carrera real (ver "Discrepancias") y
presentó opciones concretas para dos decisiones de borde:

- *Estrategia de datos.* Se descartó explícitamente la opción de mockear
  toda la respuesta del backend, porque no verifica la respuesta real y
  contradice el requisito de comprobar la actualización en el servidor. Se
  eligió correr contra backend real con datos de seed, usando los intercepts
  solo como espía (nunca para inventar una respuesta).
- *Condición de carrera entre los dos `GET` iniciales.* Se descartó
  explícitamente arreglar el bug en el código de producción: mezclaría en el
  mismo cambio una corrección de comportamiento con la introducción de
  tests, sin que nadie la haya pedido ni revisado como tal. Se eligió forzar
  el orden únicamente dentro del test, dejando el bug documentado (ver
  "Discrepancias") en vez de corregido de paso.
- *Limpieza de datos.* Revertir el estado modificado con una llamada directa
  a la API al final de cada test, en vez de depender de un reset completo de
  base de datos entre corridas.

### 3. Validación aislada de la interacción de teclado

Antes de construir las aserciones del `PUT` y el reload encima de la
interacción de arrastre por teclado, se pidió confirmarla de forma aislada:

**Prompt:**
```
Antes de implementar el plan completo, hacé solo esto primero: agregá el data-testid
a CandidateCard, implementá cy.moveCardByKeyboard, y escribí un test mínimo que
visite la página, haga foco en una tarjeta, presione Space, y verifique que aparece
el aria-live que react-beautiful-dnd inyecta al levantar un elemento (o tomá un
screenshot para confirmarlo visualmente). No implementes todavía los intercepts del
PUT, el comando visitPosition completo, ni las aserciones de "Cambio de fase".
Mostrame que el pickup funciona antes de seguir con el resto del plan.

Una vez que confirmes que el pickup funciona, borrá el test de verificación mínima
(no lo dejes en el repo). El data-testid y cy.moveCardByKeyboard sí quedan, porque
los va a usar el test real de "Cambio de fase".
```

Antes de ejecutar este test, se detectó que tampoco tenía protección contra
la condición de carrera (mezclaba dos variables no probadas: si la carrera
salía mal, el fallo se habría atribuido erróneamente al pickup por teclado),
así que se agregó una versión mínima del mismo mecanismo de orden:

```
Antes de correr el smoke test, agregá en position.cy.js el mismo mecanismo de orden
forzado entre /interviewFlow y /candidates que ya diseñamos para el plan completo
(retener /candidates hasta que resuelva /interviewFlow). No hace falta que sea el
comando visitPosition definitivo, pero el smoke test no puede depender de que la
carrera salga bien por casualidad.
```

**Resultado:** confirmado en cinco corridas seguidas. El aria-live que
inyecta la librería mostró "You have lifted an item" al levantar la tarjeta
y "Movement cancelled." al cancelar con `Escape`, sin que se disparara
ningún `PUT` en ese caso. Se descubrió que la tarjeta levantada recibe
`pointer-events: none`, por lo que las siguientes interacciones simuladas
necesitan la opción `force: true`. Una corrida de cinco se colgó sin error en
el paso del screenshot; no volvió a repetirse en corridas posteriores y
queda anotado por si reaparece. El test de verificación se borró una vez
confirmado; el `data-testid` y el comando de arrastre quedaron.

### 4. Validación del mecanismo de orden en recargas (incluido caché HTTP)

**Prompt:**
```
Antes de escribir las aserciones de persistencia con cy.reload(), agregá un chequeo
explícito: dentro del mismo test, después del primer cy.visitPosition, hacé cy.reload()
y confirmá con logs o con cy.wait en los alias que (a) la petición a /candidates en el
reload efectivamente se retiene hasta que resuelve /interviewFlow, y (b) esto sigue
siendo cierto aunque el servidor responda 304 a la segunda petición. Si el mecanismo
actual es una promesa que se resuelve una sola vez por test, hay que rearmarla antes
de cada cy.reload(), no solo antes del primer cy.visit.
```

**Resultado y correcciones:** la primera versión de este mecanismo tenía tres
fallas encontradas en revisión, corregidas antes de aceptarlo:

1. Si la respuesta no traía `ETag`, el mecanismo no avisaba y el reload
   "forzado" se convertía en uno normal sin que el test lo notara. Se
   corrigió para fallar explícitamente en ese caso.
2. El valor de `ETag` guardado podía quedar desactualizado si una respuesta
   intermedia llegaba sin ese header. Se corrigió para actualizarlo con cada
   respuesta.
3. La comparación era tautológica: el test comparaba el valor inyectado
   contra la misma variable interna que lo había generado, así que siempre
   iba a pasar sin haber probado nada. Se corrigió para comparar contra el
   header `ETag` capturado de forma independiente por la propia
   intercepción de Cypress.

La corrida final confirmó, con timestamps de log: retención de entre 800 y
850 ms en las tres cargas (inicial, reload natural, reload forzado), ninguna
liberada por timeout, y el `If-None-Match` inyectado coincidiendo con el
`ETag` real de la carga anterior en las tres.

### 5. Test de cambio de fase

**Prompt:**
```
En el paso de "Persistencia real" del test de Cambio de fase, usá cy.reloadPosition(),
no cy.reload(). El plan original decía cy.reload() porque se escribió antes de que
existiera la compuerta de orden — ya no aplica.
```

**Resultado:** dos corridas seguidas en verde, con la base de datos revertida
a su estado original en ambas. El candidato elegido varió de corrida en
corrida (según el orden en que el backend devuelve la lista tras cada
actualización), lo que llevó a la siguiente decisión:

**Decisión sobre el candidato de prueba:** se evaluó fijarlo por nombre para
que un fallo en frío fuera más legible, pero se descartó: acoplaría el test
a un valor específico del seed sin necesidad, la misma fragilidad que ya se
había evitado al no hardcodear ids. Se mantuvo dinámico y se agregó en su
lugar un log explícito con el candidato elegido en cada corrida, que resolvió
la legibilidad sin perder cobertura.

### 6. Confirmación de la navegación protegida en todos los tests

```
El test de "Carga de página" tiene que usar cy.visitPosition(id) para la navegación
inicial, igual que los otros dos tests — no cy.visit() directo.
```

Confirmado con una búsqueda de todas las llamadas de navegación en el spec:
ningún test navega con `cy.visit()` o `cy.reload()` directos; todos pasan por
los comandos con la compuerta de orden.

### 7. Control negativo

```
Comentá la línea de la llamada a updateCandidateStep en PositionDetails.js, corré
solo el test de "Cambio de fase", y confirmá que falla específicamente en
cy.wait('@updateStep') por timeout (no en otra aserción, no en un error distinto).
Después, git checkout -- frontend/src/components/PositionDetails.js (o git diff
para confirmar que no queda nada sin revertir) y volvé a correr el test para
confirmar que pasa en verde de nuevo.
```

**Resultado:** el test falló exactamente en la espera del `PUT`, con "No
request ever occurred"; los otros dos tests siguieron en verde. Revertido el
cambio y confirmado con `git diff` limpio, el spec completo volvió a pasar.

### 8. Mapa final contra el código real

```
Con el spec ya terminado y los tres tests en verde, dame el mapa final:
1. Qué verifica cada uno de los tres tests de position.cy.js.
2. Qué archivos de producción se modificaron y por qué (debería ser solo
   el data-testid de CandidateCard.js).
3. Todo lo que el código final tiene y el plan original NO tenía, señalado
   explícitamente como desvío — no descripto como si siempre hubiera estado
   ahí.
4. Si algo del plan original quedó afuera del resultado final, decirlo
   también.
```

**Resultado:** un mapa con once desvíos respecto del plan original,
resumidos en la sección de discrepancias y decisiones más abajo, y una
sección aparte de lo que el plan original preveía y no se implementó tal
cual (el mecanismo de configuración de la URL del backend, y el comando de
seed documentado, ambos corregidos según el comportamiento real verificado).

---

## Discrepancias encontradas entre lo asumido y el comportamiento real

- **Endpoint de actualización de fase.** El contrato asumido al comenzar
  mencionaba dos variantes distintas del path; ninguna coincidía con el
  controller real, que expone `PUT /candidates/:id`. Se usó la versión
  verificada directamente en el código de rutas del backend.
- **Mayúsculas en la ruta del flujo de entrevista.** El front pide
  `/positions/:id/interviewFlow`; la ruta del backend está definida en
  minúsculas (`interviewflow`). Funciona porque el framework del servidor no
  distingue mayúsculas por defecto, pero los intercepts de los tests
  necesitan una expresión insensible a mayúsculas para no perder la
  petición.
- **Condición de carrera en la carga de la vista.** Los dos `GET` que trae la
  vista al montar (`interviewFlow` y `candidates`) corren en paralelo; si
  `candidates` resuelve primero, las tarjetas nunca se renderizan, porque el
  mapeo de candidatos a columnas corre una sola vez sobre un array vacío. No
  se corrigió en el código de producción (ver "Fuera de alcance"); los tests
  fuerzan el orden únicamente en su propia ejecución.
- **Comportamiento de caché en recargas.** El reload del navegador usado por
  Cypress revalida por su cuenta con `If-None-Match` y obtiene `304` sin
  necesidad de forzarlo. El caso de `304` forzado se mantuvo de todas formas
  como garantía independiente de ese comportamiento particular del entorno
  de ejecución de los tests.
- **API de configuración de Cypress.** El mecanismo de lectura de variables
  de entorno público (`Cypress.env()`) usado originalmente ya no existe en
  la versión instalada: fue removido en favor de dos APIs separadas, una
  síncrona para valores públicos de configuración y otra asíncrona para
  valores sensibles. Se verificó contra el registro de cambios oficial antes
  de aplicar el reemplazo, en vez de asumir que el cambio de comportamiento
  reportado fuera correcto.
- **Comando de seed de la base de datos.** El reseteo de esquema no aplica
  el seed automáticamente como se asumía; hay que ejecutarlo aparte, y con
  una opción específica del runner de TypeScript por una incompatibilidad de
  versiones entre dependencias del proyecto. El comando documentado en
  "Instrucciones para ejecutar las pruebas" es el verificado, no el
  asumido originalmente.
- **Selectores estables.** No existía ningún `data-testid` en los
  componentes de la vista; se agregó exactamente uno, en la tarjeta de
  candidato, en vez de asumir que un atributo interno de la librería de
  arrastre serviría como selector (esos atributos son de implementación de
  la librería, no una API propia del proyecto).

---

## Decisiones de alcance: qué quedó fuera y por qué

- **La condición de carrera de `PositionDetails.js` no se corrigió.** Es un
  hallazgo real, pero corregirlo de paso mezclaría un cambio de
  comportamiento de producción, sin revisión propia, dentro de un cambio que
  debía limitarse a agregar tests. Queda documentado como hallazgo para
  tratarlo aparte.
- **El caso de configuración faltante (`expose.apiUrl` ausente) no tiene un
  test dedicado.** El spec corta con un mensaje explícito si falta, pero ese
  camino de error no se ejerció con una prueba automatizada.
- **El cuelgue esporádico observado una vez en cinco corridas del test de
  validación de teclado no se investigó a fondo**, al no haberse repetido en
  corridas posteriores. Si reaparece, conviene reproducirlo con el modo de
  depuración de Cypress activado.
- **El orden de las columnas del tablero no se valida.** El front no ordena
  las fases por su índice de orden, y el seed tiene dos fases con el mismo
  valor de ese índice, así que no hay un orden esperado bien definido para
  verificar.
