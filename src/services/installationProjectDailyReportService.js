const dayjs = require('dayjs');
const { sendMail } = require('./mailer');

const {
  InstallationProject,
  InstallationProjectProgress,
  InstallationProjectProgressVehicle,
  Client,
  User,
} = require('../models');

function fmtDate(date) {
  if (!date) return '-';
  return dayjs(date).format('DD/MM/YYYY');
}

function normalizeEmails(input) {
  if (!input) return [];

  let arr = input;

  if (typeof input === 'string') {
    arr = input.split(/[;,]/);
  }

  if (!Array.isArray(arr)) {
    arr = [arr];
  }

  return [...new Set(arr.map((e) => String(e || '').trim()).filter(Boolean))];
}

function hasMovement(progressList) {
  return progressList.some((p) => {
    const qtd = Number(p.trucksDoneToday || p.completedInstallations || 0);
    const vehicles = Array.isArray(p.vehicles) ? p.vehicles : [];

    return qtd > 0 || vehicles.length > 0;
  });
}

function buildDailyReportHtml(project, progressList, targetDate) {
  const installedToday = progressList.reduce(
    (acc, p) => acc + Number(p.trucksDoneToday || p.completedInstallations || 0),
    0
  );

  const total = Number(project.trucksTotal || project.equipmentsTotal || 0);
  const done = Number(project.trucksDone || 0);
  const pending = Math.max(total - done, 0);
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  const firstDate = project.startAt || project.startPlannedAt || targetDate;
  const lastDate = targetDate;

  const vehicles = progressList.flatMap((p) =>
    (p.vehicles || []).map((v) => ({
      date: p.date,
      plate: v.plate,
      serial: v.serial,
      product: project.items?.[0]?.name || '-',
      status: 'Concluído',
      unidade: project.requestedCity || project.client?.city || '-',
      empresa: project.client?.name || project.title,
    }))
  );

  const rows = vehicles
    .map(
      (v) => `
        <tr>
          <td>${fmtDate(v.date)}</td>
          <td>${v.plate || '-'}</td>
          <td>${v.serial || '-'}</td>
          <td>${v.product || '-'}</td>
          <td>Instalação</td>
          <td>${v.status}</td>
          <td>${v.unidade}</td>
          <td>${v.empresa}</td>
        </tr>
      `
    )
    .join('');

  return `
  <div style="font-family:Arial,sans-serif;background:#eaf4ff;padding:20px;color:#111;">
    <div style="max-width:980px;margin:auto;background:#fff;border:1px solid #b9c7d6;border-radius:12px;overflow:hidden;">

      <div style="background:#0f4c81;color:#fff;padding:18px 22px;">
        <h2 style="margin:0;font-size:22px;">Relatório Diário de Instalação</h2>
        <p style="margin:6px 0 0;font-size:14px;">
          ${project.title} ${project.af ? `• AF ${project.af}` : ''}
        </p>
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;text-align:center;">
        <tr>
          <td style="padding:16px;border-bottom:1px solid #cbd5e1;">
            <strong style="font-size:20px;">${fmtDate(firstDate)}</strong><br/>
            <span>Primeira Instalação</span>
          </td>
          <td style="padding:16px;border-bottom:1px solid #cbd5e1;">
            <strong style="font-size:24px;">${total}</strong><br/>
            <span>Total de Equipamentos</span>
          </td>
          <td style="padding:16px;border-bottom:1px solid #cbd5e1;">
            <strong style="font-size:24px;color:#16a34a;">${done}</strong><br/>
            <span>Concluído</span>
          </td>
          <td style="padding:16px;border-bottom:1px solid #cbd5e1;">
            <strong style="font-size:24px;color:#f97316;">${pending}</strong><br/>
            <span>Aguardando Instalação</span>
          </td>
          <td style="padding:16px;border-bottom:1px solid #cbd5e1;">
            <strong style="font-size:20px;">${fmtDate(lastDate)}</strong><br/>
            <span>Última Instalação</span>
          </td>
        </tr>
      </table>

      <div style="padding:20px;">
        <h3 style="margin:0 0 10px;">Percentual de Conclusão</h3>

        <div style="background:#e5e7eb;border-radius:999px;height:22px;overflow:hidden;">
          <div style="background:#16a34a;width:${percent}%;height:22px;text-align:center;color:#fff;font-size:13px;line-height:22px;">
            ${percent}%
          </div>
        </div>

        <p style="margin:10px 0 20px;">
          <b>${done}</b> concluídos de <b>${total}</b> equipamentos.
          Hoje foram registrados <b>${installedToday}</b> equipamentos.
        </p>

        <h3 style="margin:0 0 10px;">Equipamentos Instalados</h3>

        <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:#dbeafe;">
              <th>Data</th>
              <th>Placa</th>
              <th>Serial</th>
              <th>Produto</th>
              <th>Procedimento</th>
              <th>Status</th>
              <th>Unidade</th>
              <th>Empresa</th>
            </tr>
          </thead>
          <tbody>
            ${
              rows ||
              `<tr><td colspan="8" style="text-align:center;padding:16px;">Nenhum equipamento detalhado no dia.</td></tr>`
            }
          </tbody>
        </table>
      </div>

      <div style="padding:14px 20px;background:#f8fafc;font-size:12px;color:#64748b;">
        Mensagem automática • Portal de Supply Chain
      </div>
    </div>
  </div>
  `;
}

async function sendDailyReport(projectId, options = {}) {
  const targetDate = options.date || dayjs().format('YYYY-MM-DD');

  const project = await InstallationProject.findByPk(projectId, {
    include: [
      { model: Client, as: 'client' },
      { model: User, as: 'supervisor', attributes: ['id', 'name', 'email'] },
      { association: 'items' },
    ],
  });

  if (!project) {
    throw new Error('Projeto não encontrado');
  }

  const progressList = await InstallationProjectProgress.findAll({
    where: {
      projectId,
      date: targetDate,
    },
    include: [{ model: InstallationProjectProgressVehicle, as: 'vehicles' }],
    order: [['id', 'ASC']],
  });

  if (!progressList.length || !hasMovement(progressList)) {
    return {
      sent: false,
      ignored: true,
      reason: 'Sem movimentação no dia',
    };
  }

  const internalEmails = normalizeEmails(project.dailyReportInternalEmails);
  const clientEmails = project.dailyReportSendToClient
    ? normalizeEmails(project.dailyReportClientEmails || project.contactEmails || project.contactEmail)
    : [];

  const to = [...new Set([...internalEmails, ...clientEmails])];

  if (!to.length) {
    return {
      sent: false,
      ignored: true,
      reason: 'Nenhum e-mail configurado',
    };
  }

  const html = buildDailyReportHtml(project, progressList, targetDate);

  await sendMail({
    to,
    subject: `Relatório Diário de Instalação • ${project.title} • ${fmtDate(targetDate)}`,
    html,
    replyTo: process.env.MAIL_REPLY_TO || undefined,
  });

  await project.update({
    dailyReportLastSentAt: new Date(),
  });

  return {
    sent: true,
    ignored: false,
    to,
    targetDate,
  };
}

module.exports = {
  sendDailyReport,
  buildDailyReportHtml,
};