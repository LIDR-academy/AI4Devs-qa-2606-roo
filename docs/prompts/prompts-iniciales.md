1- Eres un experto arquitecto de sistemas con experiencia en ATS. 
Actualmente existe un documento README.md en la raíz, tomalo como referencia, pero este archivo solo es el base para deployments y tiene información muy general.
Genérame una documentación dentro de docs/README.md que incluya:         
	- propósito de negocio de LTI
- problema que resuelve   
- Crea diagramas de flujo End-to-End
- Describe los flujos E2E (Given/When/Then)      
	- la estructura de carpetas        
	- las tecnologías usadas        
	- la arquitectura de backend y frontend        
	- Identificación de módulos 
- Identificación de interfaces 
	- todos los pasos para levantar el entorno, incluida la base de datos.        
	- Hazlo en español y en formato markdown


2- Corre el proyecto.

3- Actualiza documentacion.

4- En base al documento docs/README.md, Actúa como un experto en producto con conocimientos técnicos. Analiza y comprende todos los flujos de sistema.
En base a los flujos E2E (Given/When/Then) y a los diagramas de flujo End-to-End definidos en el archivo docs/README.md crea pruebas E2E en Cypress para la interfaz “position”:

Debes crear pruebas E2E para verificar AL MENOS los siguientes escenarios:

1- Carga de la Página de Position:
Verifica que el título de la posición se muestra correctamente.
Verifica que se muestran las columnas correspondientes a cada fase del proceso de contratación.
Verifica que las tarjetas de los candidatos se muestran en la columna correcta según su fase actual.

2- Cambio de Fase de un Candidato:
Simula el arrastre de una tarjeta de candidato de una columna a otra.
Verifica que la tarjeta del candidato se mueve a la nueva columna.
Verifica que la fase del candidato se actualiza correctamente en el backend mediante el endpoint PUT /candidate/:id.

Estos E2E tests marcalos con el prefijo MND.

Adicionalmente, SI existen mas flujos E2E para probar además de los escenarios mencionados, crealos, y a estos agregales el prefijo EXT.

Finalmente asegurate de que toda la funcionalidad del sistema esta cubierta con estos tests E2E (MND+EXT = total de casos).
Todos los escenarios deben de estar cubiertos en alguno de estos escenarios de prueba E2E aun cuando la funcionalidad todavía no ha sido desarrollada.

Pregunta si algo no esta claro hasta que todo el requerimiento este claro y hasta entonces genera el resultado.


