import './commands';

// react-beautiful-dnd puede emitir el benigno error "ResizeObserver loop limit
// exceeded" durante el drag. No es un fallo de la app; lo ignoramos SOLO para ese
// mensaje para no enmascarar excepciones reales.
Cypress.on('uncaught:exception', (err) => {
  if (/ResizeObserver loop/.test(err.message)) {
    return false;
  }
  return true;
});
