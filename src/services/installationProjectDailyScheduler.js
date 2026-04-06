const cron = require('node-cron');
const dayjs = require('dayjs');

const {
  InstallationProject,
  InstallationProjectProgress,
  InstallationProjectProgressVehicle,
  Client,
  User,
} = require('../models');

const { sendMail } = require('./mailer');
const { dailyEmailHtml } = require('./installationProjectEmailTemplates');

function normalizeEmailList(input) {
  let arr = input;

  if (!arr) return [];

  if (typeof arr === 'string') {
    arr = arr.split(/[;,]/);
  }

  if (!Array.isArray(arr)) {
    arr = [arr];
  }

  return [
    ...new Set(
      arr
        .map((item) => String(item || '').trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
}

async function sendDailyReportForProject(project, targetDate) {
  const to = normalizeEmailList(project.contactEmails || project.contactEmail);

  if (!to.length) {
    return {
      projectId: project.id,
      title: project.title,
      sent: false,
      error: 'Projeto sem e-mail de contato',
    };
  }

  const progressList = await InstallationProjectProgress.findAll({
    where: {
      projectId: project.id,
      date: targetDate,
    },
    order: [['date', 'ASC'], ['id', 'ASC']],
    include: [
      { model: User, as: 'author', attributes: ['id', 'name'] },
      { model: InstallationProjectProgressVehicle, as: 'vehicles' },
    ],
  });

  const p = project.toJSON ? project.toJSON() : project;
  const html = dailyEmailHtml(p, progressList, targetDate);

  await sendMail({
    to,
    subject: `Reporte Diário • ${project.title}${project.af ? ` • ${project.af}` : ''} • ${targetDate}`,
    html,
    replyTo: process.env.MAIL_REPLY_TO || undefined,
  });

  return {
    projectId: project.id,
    title: project.title,
    sent: true,
    to,
    count: progressList.length,
  };
}

async function runDailyReports(targetDate = dayjs().format('YYYY-MM-DD')) {
  console.log(`[daily-report] Iniciando envio automático de ${targetDate}`);

  const projects = await InstallationProject.findAll({
    where: {
      status: 'INICIADO',
    },
    include: [
      { model: Client, as: 'client', attributes: ['id', 'name'] },
    ],
    order: [['id', 'ASC']],
  });

  const results = [];

  for (const project of projects) {
    try {
      const result = await sendDailyReportForProject(project, targetDate);
      results.push(result);

      console.log(
        `[daily-report] Projeto ${project.id} - ${project.title}: ${result.sent ? 'ENVIADO' : 'IGNORADO'}`
      );
    } catch (err) {
      console.error(
        `[daily-report] Erro no projeto ${project.id} - ${project.title}:`,
        err.message
      );

      results.push({
        projectId: project.id,
        title: project.title,
        sent: false,
        error: err.message || 'Erro ao enviar',
      });
    }
  }

  console.log(`[daily-report] Finalizado. Total projetos: ${projects.length}`);
  return results;
}

function startInstallationProjectDailyScheduler() {
  cron.schedule(
    '0 19 * * *',
    async () => {
      try {
        await runDailyReports(dayjs().format('YYYY-MM-DD'));
      } catch (err) {
        console.error('[daily-report] Erro geral no agendador:', err);
      }
    },
    {
      timezone: 'America/Sao_Paulo',
    }
  );

  console.log('[daily-report] Agendador iniciado para 19:00 America/Sao_Paulo');
}

module.exports = {
  startInstallationProjectDailyScheduler,
  runDailyReports,
};