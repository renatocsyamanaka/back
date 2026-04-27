const dayjs = require('dayjs');

const {
  InstallationProject,
  InstallationProjectProgress,
  InstallationProjectProgressVehicle,
} = require('../models');

const { sendEmail } = require('./mailer');

// evita execução duplicada ao mesmo tempo
let isRunning = false;

// normaliza e-mails vindos como string, array ou JSON
function normalizeEmails(input) {
  if (!input) return [];

  let emails = input;

  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      emails = parsed;
    } catch {
      emails = input.split(/[;,]/);
    }
  }

  if (!Array.isArray(emails)) {
    emails = [emails];
  }

  return [
    ...new Set(
      emails
        .map((email) => String(email || '').trim())
        .filter((email) => email && email.includes('@'))
    ),
  ];
}

// valida se houve movimentação real no progresso
function progressHasMovement(progress) {
  if (!progress) return false;

  const trucks = Number(progress.trucksDoneToday || 0);
  const vehicles = Array.isArray(progress.vehicles) ? progress.vehicles : [];

  return trucks > 0 || vehicles.length > 0;
}

function formatDate(date) {
  if (!date) return '-';
  return dayjs(date).format('DD/MM/YYYY');
}

function buildDailyReportHtml(project, progressList, today) {
  const totalEquipamentos = Number(
    project.trucksTotal || project.equipmentsTotal || 0
  );

  const concluido = Number(project.trucksDone || 0);
  const pendente = Math.max(totalEquipamentos - concluido, 0);

  const percentual =
    totalEquipamentos > 0
      ? Math.round((concluido / totalEquipamentos) * 100)
      : 0;

  const instaladosHoje = progressList.reduce((acc, progress) => {
    return acc + Number(progress.trucksDoneToday || 0);
  }, 0);

  const vehicles = progressList.flatMap((progress) => {
    const list = Array.isArray(progress.vehicles) ? progress.vehicles : [];

    return list.map((vehicle) => ({
      date: progress.date || today,
      plate: vehicle.plate || vehicle.placa || '-',
      oldSerial:
        vehicle.oldSerial ||
        vehicle.serialAntigo ||
        vehicle.previousSerial ||
        '-',
      newSerial:
        vehicle.newSerial ||
        vehicle.serialNovo ||
        vehicle.serial ||
        '-',
      product:
        vehicle.product ||
        vehicle.produto ||
        project.product ||
        project.productName ||
        '-',
      procedure:
        vehicle.procedure ||
        vehicle.procedimento ||
        'Instalação',
      status: 'Concluído',
      unit:
        project.requestedCity ||
        project.requestedLocationText ||
        project.unidade ||
        '-',
      company:
        project.clientName ||
        project.companyName ||
        project.title ||
        '-',
    }));
  });

  const rows = vehicles
    .map(
      (item) => `
        <tr>
          <td>${formatDate(item.date)}</td>
          <td>${item.plate}</td>
          <td>${item.oldSerial}</td>
          <td>${item.newSerial}</td>
          <td>${item.product}</td>
          <td>${item.procedure}</td>
          <td>${item.status}</td>
          <td>${item.unit}</td>
          <td>${item.company}</td>
        </tr>
      `
    )
    .join('');

  return `
    <div style="font-family: Arial, sans-serif; background:#eaf4ff; padding:20px; color:#111;">
      <div style="max-width:1000px; margin:auto; background:#ffffff; border:1px solid #9fb3c8; border-radius:10px; overflow:hidden;">

        <div style="background:#0f4c81; color:#fff; padding:18px 22px;">
          <h2 style="margin:0; font-size:22px;">Relatório Diário de Instalação</h2>
          <p style="margin:6px 0 0; font-size:14px;">
            Projeto: ${project.title || '-'}
            ${project.af ? ` • AF: ${project.af}` : ''}
          </p>
        </div>

        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; text-align:center;">
          <tr>
            <td style="padding:15px; border-bottom:1px solid #b8c7d8;">
              <strong style="font-size:20px;">${formatDate(project.startAt || project.startPlannedAt || today)}</strong><br/>
              <span style="font-size:13px;">Primeira Instalação</span>
            </td>

            <td style="padding:15px; border-bottom:1px solid #b8c7d8;">
              <strong style="font-size:26px;">📦 ${totalEquipamentos}</strong><br/>
              <span style="font-size:13px;">Total de Equipamentos</span>
            </td>

            <td style="padding:15px; border-bottom:1px solid #b8c7d8;">
              <strong style="font-size:26px; color:#16a34a;">✅ ${concluido}</strong><br/>
              <span style="font-size:13px;">Concluído</span>
            </td>

            <td style="padding:15px; border-bottom:1px solid #b8c7d8;">
              <strong style="font-size:26px; color:#f97316;">🕘 ${pendente}</strong><br/>
              <span style="font-size:13px;">Aguardando Instalação</span>
            </td>

            <td style="padding:15px; border-bottom:1px solid #b8c7d8;">
              <strong style="font-size:20px;">${formatDate(today)}</strong><br/>
              <span style="font-size:13px;">Última Instalação</span>
            </td>
          </tr>
        </table>

        <div style="padding:20px;">
          <h3 style="margin:0 0 12px;">Percentual de Conclusão</h3>

          <div style="background:#d1d5db; border-radius:999px; height:24px; overflow:hidden; margin-bottom:10px;">
            <div style="background:#a8d08d; width:${percentual}%; height:24px; line-height:24px; text-align:center; font-weight:bold; font-size:13px;">
              ${percentual}%
            </div>
          </div>

          <p style="font-size:14px; margin:0 0 20px;">
            <b>${concluido}</b> concluídos de <b>${totalEquipamentos}</b> equipamentos.
            Hoje foram registrados <b>${instaladosHoje}</b> equipamentos.
          </p>

          <h3 style="margin:0 0 12px;">Equipamentos Instalados</h3>

          <table width="100%" cellpadding="7" cellspacing="0" style="border-collapse:collapse; font-size:12px; border:1px solid #9fb3c8;">
            <thead>
              <tr style="background:#dbeafe;">
                <th>Data</th>
                <th>Placa</th>
                <th>Serial Antigo</th>
                <th>Serial Novo</th>
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
                `<tr>
                  <td colspan="9" style="text-align:center; padding:16px;">
                    Houve movimentação registrada, mas sem detalhamento de veículos.
                  </td>
                </tr>`
              }
            </tbody>
          </table>
        </div>

        <div style="background:#f8fafc; padding:14px 20px; font-size:12px; color:#64748b;">
          E-mail automático enviado pelo Portal de Supply Chain.
        </div>

      </div>
    </div>
  `;
}

async function processDailyEmails() {
  if (isRunning) {
    return [
      {
        sent: false,
        ignored: true,
        error: 'Processamento já está em execução',
      },
    ];
  }

  isRunning = true;

  const today = dayjs().format('YYYY-MM-DD');
  const results = [];

  try {
    const projects = await InstallationProject.findAll({
      where: {
        status: 'INICIADO',
        dailyReportEnabled: true,
      },
    });

    for (const project of projects) {
      try {
        const progressList = await InstallationProjectProgress.findAll({
          where: {
            projectId: project.id,
          },
          include: [
            {
              model: InstallationProjectProgressVehicle,
              as: 'vehicles',
            },
          ],
          order: [['date', 'ASC']],
        });

        if (!progressList.length) {
          results.push({
            projectId: project.id,
            title: project.title,
            sent: false,
            ignored: true,
            error: 'Sem progresso cadastrado no projeto',
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
            error: 'Sem movimentação cadastrada no projeto',
          });
          continue;
        }

        const internalEmails = normalizeEmails(project.dailyReportInternalEmails);

        const clientEmails = project.dailyReportSendToClient
          ? normalizeEmails(
              project.dailyReportClientEmails ||
                project.contactEmails ||
                project.contactEmail
            )
          : [];

        const recipients = [...new Set([...internalEmails, ...clientEmails])];

        if (!recipients.length) {
          results.push({
            projectId: project.id,
            title: project.title,
            sent: false,
            ignored: true,
            error: 'Sem destinatário configurado',
          });
          continue;
        }

        const html = buildDailyReportHtml(project, progressList, today);

        await sendEmail({
          to: recipients.join(','),
          subject: `Relatório diário de instalação - ${project.title}`,
          html,
        });

        await project.update({
          dailyReportLastSentAt: new Date(),
        });

        results.push({
          projectId: project.id,
          title: project.title,
          sent: true,
          ignored: false,
          recipients,
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
  } finally {
    isRunning = false;
  }
}

function startInstallationProjectDailyScheduler() {
  // roda uma vez ao subir
  processDailyEmails().catch((err) => {
    console.error('[Scheduler] Erro na execução inicial:', err);
  });

  // roda a cada 1 hora
  setInterval(() => {
    const now = dayjs();

    // envia somente próximo das 19h
    if (now.hour() !== 19) return;

    processDailyEmails().catch((err) => {
      console.error('[Scheduler] Erro na execução agendada:', err);
    });
  }, 60 * 60 * 1000);
}

module.exports = {
  processDailyEmails,
  startInstallationProjectDailyScheduler,
};