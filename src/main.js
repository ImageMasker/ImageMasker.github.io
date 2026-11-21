import { App } from './app/App.js';

const app = new App(document.getElementById('app'));

app.init().catch((error) => {
  console.error(error);
});

// Handy for debugging from the console.
window.imageMasker = app;
