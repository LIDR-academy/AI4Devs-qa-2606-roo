import './commands';

// react-beautiful-dnd emite avisos de ResizeObserver en algunos navegadores.
// No son fallos de la aplicacion, asi que no deben tumbar el test.
Cypress.on('uncaught:exception', (err) => {
  if (/ResizeObserver loop/.test(err.message)) {
    return false;
  }
  return true;
});
