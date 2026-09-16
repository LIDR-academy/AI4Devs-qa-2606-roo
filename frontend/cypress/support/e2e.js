import './commands';

// react-beautiful-dnd puede emitir el benigno error "ResizeObserver loop limit
// exceeded" durante el drag. No es un fallo de la app; lo ignoramos SOLO para ese
// mensaje para no enmascarar excepciones reales.
// Devuelve false (ignora) solo para el benigno "ResizeObserver loop" de rbd;
// cualquier otra excepción se propaga (return true).
Cypress.on('uncaught:exception', (err) => !/ResizeObserver loop/.test(err.message));
