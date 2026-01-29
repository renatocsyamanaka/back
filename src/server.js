// src/server.js
require('dotenv').config(); // carrega .env antes de iniciar
const { app, bootstrap } = require('./app');

const PORT = process.env.PORT || 3000;
const sync = process.argv.includes('--sync');

(async () => {
  await bootstrap({ sync });
  app.listen(PORT, () => {
    console.log(`API on http://localhost:${PORT}`);
    console.log(`Swagger UI on http://localhost:${PORT}/docs`);
  });
})();
