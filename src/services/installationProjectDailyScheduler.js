const dayjs = require('dayjs');
const { InstallationProject } = require('../models');
const { sendDailyReport } = require('./installationProjectDailyReportService');

let alreadyRunning = false;

async function processDailyEmails() {
  if (alreadyRunning) return [];
  alreadyRunning = true;

  try {
    const today = dayjs().format('YYYY-MM-DD');

    const projects = await InstallationProject.findAll({
      where: {
        status: 'INICIADO',
        dailyReportEnabled: true,
      },
    });

    const results = [];

    for (const project of projects) {
      try {
        const result = await sendDailyReport(project.id, { date: today });

        results.push({
          projectId: project.id,
          title: project.title,
          ...result,
        });
      } catch (err) {
        results.push({
          projectId: project.id,
          title: project.title,
          sent: false,
          error: err.message,
        });
      }
    }

    return results;
  } finally {
    alreadyRunning = false;
  }
}

function startInstallationProjectDailyScheduler() {
  console.log('[daily-report] Agendador iniciado para projetos de instalação');

  setInterval(() => {
    const now = dayjs();

    if (now.hour() === 19 && now.minute() < 10) {
      processDailyEmails().catch((err) => {
        console.error('[daily-report] Erro:', err);
      });
    }
  }, 10 * 60 * 1000);
}

module.exports = {
  processDailyEmails,
  startInstallationProjectDailyScheduler,
};