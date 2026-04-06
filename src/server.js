require('dotenv').config(); // carrega .env antes de iniciar
const { app, bootstrap } = require('./app');
const { startInstallationProjectDailyScheduler } = require('./services/installationProjectDailyScheduler');

const PORT = process.env.PORT || 3000;
const sync = process.argv.includes('--sync');

(async () => {
  await bootstrap({ sync });

  app.listen(PORT, () => {
    console.log(`SERVIDOR BACK-END ATIVO`);

    // ✅ INICIA O AGENDADOR AQUI
    startInstallationProjectDailyScheduler();
  });
})();