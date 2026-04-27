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
    try {
      const parsed = JSON.parse(input);
      arr = parsed;
    } catch {
      arr = input.split(/[;,]/);
    }
  }

  if (!Array.isArray(arr)) {
    arr = [arr];
  }

  return [
    ...new Set(
      arr
        .map((e) => String(e || '').trim().toLowerCase())
        .filter((e) => e && e.includes('@'))
    ),
  ];
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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
  const barWidth = Math.max(0, Math.min(percent, 100));

  const vehicles = progressList.flatMap((p) =>
    (p.vehicles || []).map((v) => ({
      date: p.date,
      plate: v.plate,
      serial: v.serial,
      product: project.items?.[0]?.equipmentName || project.items?.[0]?.name || '-',
      status: 'Concluído',
      unidade: project.requestedCity || project.client?.city || project.requestedLocationText || '-',
      empresa: project.client?.name || project.title,
    }))
  );

  const rows = vehicles
    .map(
      (v) => `
        <tr>
          <td style="border:1px solid #cbd5e1;padding:7px;">${fmtDate(v.date)}</td>
          <td style="border:1px solid #cbd5e1;padding:7px;">${escapeHtml(v.plate || '-')}</td>
          <td style="border:1px solid #cbd5e1;padding:7px;">${escapeHtml(v.serial || '-')}</td>
          <td style="border:1px solid #cbd5e1;padding:7px;">${escapeHtml(v.product || '-')}</td>
          <td style="border:1px solid #cbd5e1;padding:7px;">Instalação</td>
          <td style="border:1px solid #cbd5e1;padding:7px;">${escapeHtml(v.status)}</td>
          <td style="border:1px solid #cbd5e1;padding:7px;">${escapeHtml(v.unidade)}</td>
          <td style="border:1px solid #cbd5e1;padding:7px;">${escapeHtml(v.empresa)}</td>
        </tr>
      `
    )
    .join('');

  return `
  <!DOCTYPE html>
  <html>
    <body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#111827;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9;border-collapse:collapse;">
        <tr>
          <td align="center" style="padding:20px;">
            <table width="900" cellpadding="0" cellspacing="0" border="0" style="width:900px;background-color:#ffffff;border:1px solid #dbe3ef;border-collapse:collapse;">
              <tr>
                <td bgcolor="#2f7dbd" style="background-color:#2f7dbd;padding:22px;text-align:left;color:#ffffff;">
                  <div style="font-size:22px;font-weight:bold;line-height:28px;">Relatório Diário de Instalação</div>
                  <div style="font-size:14px;margin-top:6px;line-height:20px;">
                    ${escapeHtml(project.title || '-')} ${project.af ? ` - AF ${escapeHtml(project.af)}` : ''}
                  </div>
                </td>
              </tr>

              <tr>
                <td style="padding:18px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;text-align:center;">
                    <tr>
                      <td width="20%" style="border:1px solid #dbe3ef;padding:12px;">
                        <div style="font-size:12px;color:#64748b;">Primeira Instalação</div>
                        <div style="font-size:18px;font-weight:bold;">${fmtDate(firstDate)}</div>
                      </td>
                      <td width="20%" style="border:1px solid #dbe3ef;padding:12px;">
                        <div style="font-size:12px;color:#64748b;">Total</div>
                        <div style="font-size:24px;font-weight:bold;">${total}</div>
                      </td>
                      <td width="20%" style="border:1px solid #dbe3ef;padding:12px;">
                        <div style="font-size:12px;color:#64748b;">Concluído</div>
                        <div style="font-size:24px;font-weight:bold;color:#00c853;">${done}</div>
                      </td>
                      <td width="20%" style="border:1px solid #dbe3ef;padding:12px;">
                        <div style="font-size:12px;color:#64748b;">Pendente</div>
                        <div style="font-size:24px;font-weight:bold;color:#f97316;">${pending}</div>
                      </td>
                      <td width="20%" style="border:1px solid #dbe3ef;padding:12px;">
                        <div style="font-size:12px;color:#64748b;">Última Instalação</div>
                        <div style="font-size:18px;font-weight:bold;">${fmtDate(lastDate)}</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding:0 18px 18px 18px;">
                  <div style="font-size:16px;font-weight:bold;margin-bottom:8px;">Percentual de Conclusão</div>

                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background-color:#e5e7eb;">
                    <tr>
                      <td width="${barWidth}%" bgcolor="#00c853" style="background-color:#00c853;height:24px;line-height:24px;text-align:center;color:#ffffff;font-size:13px;font-weight:bold;">
                        ${percent}%
                      </td>
                      <td width="${100 - barWidth}%" style="height:24px;line-height:24px;font-size:1px;">&nbsp;</td>
                    </tr>
                  </table>

                  <p style="font-size:14px;margin:12px 0 18px 0;line-height:20px;">
                    <b>${done}</b> concluídos de <b>${total}</b> equipamentos.
                    Hoje foram registrados <b>${installedToday}</b> equipamentos.
                  </p>

                  <div style="font-size:16px;font-weight:bold;margin-bottom:8px;">Equipamentos Instalados</div>

                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-size:12px;">
                    <thead>
                      <tr bgcolor="#e2e8f0" style="background-color:#e2e8f0;">
                        <th style="border:1px solid #cbd5e1;padding:8px;text-align:left;">Data</th>
                        <th style="border:1px solid #cbd5e1;padding:8px;text-align:left;">Placa</th>
                        <th style="border:1px solid #cbd5e1;padding:8px;text-align:left;">Serial</th>
                        <th style="border:1px solid #cbd5e1;padding:8px;text-align:left;">Produto</th>
                        <th style="border:1px solid #cbd5e1;padding:8px;text-align:left;">Procedimento</th>
                        <th style="border:1px solid #cbd5e1;padding:8px;text-align:left;">Status</th>
                        <th style="border:1px solid #cbd5e1;padding:8px;text-align:left;">Unidade</th>
                        <th style="border:1px solid #cbd5e1;padding:8px;text-align:left;">Empresa</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${
                        rows ||
                        `<tr><td colspan="8" style="border:1px solid #cbd5e1;text-align:center;padding:16px;">Nenhum equipamento detalhado no dia.</td></tr>`
                      }
                    </tbody>
                  </table>
                </td>
              </tr>

              <tr>
                <td bgcolor="#f8fafc" style="background-color:#f8fafc;padding:14px 18px;font-size:12px;color:#64748b;">
                  Mensagem automática - Portal de Supply Chain
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
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

  const fallbackContactEmails = normalizeEmails(project.contactEmails || project.contactEmail);
  const to = [...new Set([...internalEmails, ...clientEmails, ...fallbackContactEmails])];

  if (!to.length) {
    return {
      sent: false,
      ignored: true,
      reason: 'Nenhum e-mail configurado',
    };
  }

  const html = buildDailyReportHtml(project, progressList, targetDate);

  const result = await sendMail({
    to,
    subject: `Relatório Diário de Instalação • ${project.title} • ${fmtDate(targetDate)}`,
    html,
    text: `Relatório Diário de Instalação - ${project.title} - ${fmtDate(targetDate)}`,
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
    smtp: {
      accepted: result?.accepted || [],
      rejected: result?.rejected || [],
      response: result?.response || null,
      messageId: result?.messageId || null,
    },
  };
}

module.exports = {
  sendDailyReport,
  buildDailyReportHtml,
};
