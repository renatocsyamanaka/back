const dayjs = require('dayjs');

const {
  InstallationProject,
  InstallationProjectProgress,
  InstallationProjectProgressVehicle,
} = require('../models');

const { sendEmail } = require('./mailer');

// valida se houve movimentação real no progresso
function progressHasMovement(progress) {
  if (!progress) return false;

  const trucks = Number(progress.trucksDoneToday || 0);
  const vehicles = Array.isArray(progress.vehicles) ? progress.vehicles : [];

  return trucks > 0 || vehicles.length > 0;
}

async function processDailyEmails() {
  const today = dayjs().format('YYYY-MM-DD');


  const projects = await InstallationProject.findAll({
    where: {
      status: 'INICIADO',
    },
  });

  const results = [];

  for (const project of projects) {
    try {
      const progressList = await InstallationProjectProgress.findAll({
        where: {
          projectId: project.id,
          date: today,
        },
        include: [
          {
            model: InstallationProjectProgressVehicle,
            as: 'vehicles',
          },
        ],
      });

      if (!progressList.length) {
        results.push({
          projectId: project.id,
          title: project.title,
          sent: false,
          ignored: true,
          error: 'Sem progresso no dia',
        });
        continue;
      }

      const hasMovement = progressList.some(progressHasMovement);

      if (!hasMovement) {
        results.push({
          projectId: project.id,
          title: project.title,
          sent: false,
          ignored: true,
          error: 'Sem movimentação no dia',
        });
        continue;
      }

      const recipients = project.contactEmails || project.contactEmail;

      if (!recipients || (Array.isArray(recipients) && recipients.length === 0)) {
        results.push({
          projectId: project.id,
          title: project.title,
          sent: false,
          ignored: true,
          error: 'Sem destinatário configurado',
        });
        continue;
      }

      const html = `
        <h3>Atualização diária do projeto</h3>
        <p><b>Projeto:</b> ${project.title}</p>
        <p><b>Data:</b> ${today}</p>
        <p>Houve movimentação registrada hoje.</p>
      `;

      await sendEmail({
        to: Array.isArray(recipients) ? recipients.join(',') : recipients,
        subject: `Atualização diária - ${project.title}`,
        html,
      });

      results.push({
        projectId: project.id,
        title: project.title,
        sent: true,
        ignored: false,
      });
    } catch (err) {

      results.push({
        projectId: project.id,
        title: project.title,
        sent: false,
        ignored: false,
        error: err.message,
      });
    }
  }

  return results;
}

function startInstallationProjectDailyScheduler() {

  // roda uma vez ao subir
  processDailyEmails().catch((err) => {
    console.error('[Scheduler] Erro na execução inicial:', err);
  });

  // roda a cada 1 hora
  setInterval(() => {
    processDailyEmails().catch((err) => {
      console.error('[Scheduler] Erro na execução agendada:', err);
    });
  }, 60 * 60 * 1000);
}

module.exports = {
  processDailyEmails,
  startInstallationProjectDailyScheduler,
};