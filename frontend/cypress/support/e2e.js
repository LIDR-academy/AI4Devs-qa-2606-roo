import './commands';

// react-beautiful-dnd y algunos navegadores emiten errores de ResizeObserver
// que no afectan a la funcionalidad bajo prueba.
Cypress.on('uncaught:exception', (err) => {
  if (/ResizeObserver loop/.test(err.message)) {
    return false;
  }
  return true;
});
