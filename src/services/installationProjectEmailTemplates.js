const dayjs = require('dayjs');

function fmtDate(d) {
  if (!d) return '-';
  return dayjs(d).format('DD/MM/YYYY');
}
function fmtDateTime(d) {
  if (!d) return '-';
  return dayjs(d).format('DD/MM/YYYY HH:mm');
}
function nl2br(s) {
  return String(s || '').replace(/\n/g, '<br/>');
}

function baseLayout({ title, bodyHtml }) {
  return `
  <div style="font-family: Arial, sans-serif; color:#111; line-height:1.4">
    <div style="max-width: 920px; margin: 0 auto; border:1px solid #eee; border-radius: 10px; overflow:hidden">
      <div style="padding:16px 20px; background:#0b5fff; color:#fff">
        <h2 style="margin:0; font-size:18px">${title}</h2>
      </div>
      <div style="padding:18px 20px">
        ${bodyHtml}
        <hr style="border:none; border-top:1px solid #eee; margin:18px 0" />
        <div style="font-size:12px; color:#666">
          Mensagem automática • Sistema de Projetos
        </div>
      </div>
    </div>
  </div>`;
}

function projectBlock(p) {
  return `
  <div style="margin: 10px 0 14px 0; padding: 12px; background:#fafafa; border:1px solid #eee; border-radius:10px">
    <div><b>Projeto:</b> ${p.title}</div>
    <div><b>AF:</b> ${p.af || '-'}</div>
    <div><b>Cliente:</b> ${p.client?.name || (p.clientId ? `#${p.clientId}` : '-')}</div>
    <div><b>Prev. início:</b> ${fmtDate(p.startPlannedAt)}</div>
    <div><b>Prev. fim:</b> ${fmtDate(p.endPlannedAt)}</div>
    <div><b>Status:</b> ${p.status}</div>
    <div><b>Caminhões:</b> ${p.trucksDone}/${p.trucksTotal}</div>
  </div>`;
}

function startEmailHtml(p, extraMessage) {
  const body = `
    <p>Olá!</p>
    <p>Estamos iniciando o projeto abaixo.</p>
    ${projectBlock(p)}
    <p><b>Contato:</b> ${p.contactName || '-'} • ${p.contactEmail || '-'} • ${p.contactPhone || '-'}</p>
    ${p.notes ? `<p><b>Observações:</b><br/>${nl2br(p.notes)}</p>` : ''}
    ${extraMessage ? `<p><b>Mensagem:</b><br/>${nl2br(extraMessage)}</p>` : ''}
  `;
  return baseLayout({ title: `Início do Projeto • ${p.title}`, bodyHtml: body });
}

function dailyEmailHtml(p, progressList, dateLabel) {
  const rows = (progressList || []).map((pr) => {
    const vehiclesHtml = (pr.vehicles || [])
      .map(v => `<div>• <b>SÉRIE:</b> ${v.serial} <b>PLACA:</b> ${v.plate}</div>`)
      .join('');

    return `
      <tr>
        <td style="padding:10px; border-top:1px solid #eee; vertical-align:top; width:140px">
          <b>${fmtDate(pr.date)}</b><br/>
          <span style="font-size:12px; color:#666">${pr.author?.name ? `por ${pr.author.name}` : ''}</span>
        </td>
        <td style="padding:10px; border-top:1px solid #eee; vertical-align:top">
          <div><b>Caminhões no dia:</b> ${pr.trucksDoneToday}</div>
          ${vehiclesHtml ? `<div style="margin-top:6px">${vehiclesHtml}</div>` : ''}
          ${pr.notes ? `<div style="margin-top:8px"><b>Obs:</b><br/>${nl2br(pr.notes)}</div>` : ''}
        </td>
      </tr>`;
  }).join('');

  const body = `
    <p>Olá!</p>
    <p>Segue o <b>reporte diário</b> do projeto ${dateLabel ? `para <b>${dateLabel}</b>` : ''}.</p>
    ${projectBlock(p)}
    <div style="margin-top:14px; border:1px solid #eee; border-radius:10px; overflow:hidden">
      <table style="width:100%; border-collapse:collapse">
        <thead>
          <tr style="background:#fafafa">
            <th style="text-align:left; padding:10px; font-size:13px">Data</th>
            <th style="text-align:left; padding:10px; font-size:13px">Detalhes</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="2" style="padding:10px">Nenhum progresso encontrado.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;

  return baseLayout({ title: `Reporte Diário • ${p.title}`, bodyHtml: body });
}

function finalEmailHtml(p, progressList, procedures) {
  const totalDays = (progressList || []).length;
  const totalTrucksDone = (progressList || []).reduce((acc, pr) => acc + Number(pr.trucksDoneToday || 0), 0);

  const body = `
    <p>Olá!</p>
    <p>Encerramento do projeto e compilado final abaixo.</p>

    ${projectBlock(p)}

    <div style="margin:12px 0; padding:12px; background:#fafafa; border:1px solid #eee; border-radius:10px">
      <div><b>Início real:</b> ${fmtDateTime(p.startAt)}</div>
      <div><b>Fim real:</b> ${fmtDateTime(p.endAt)}</div>
      <div><b>Dias com lançamento:</b> ${totalDays}</div>
      <div><b>Total lançado (somatório):</b> ${totalTrucksDone}</div>
    </div>

    ${procedures ? `<p><b>Procedimentos finais:</b><br/>${nl2br(procedures)}</p>` : ''}

    <p><b>Histórico completo:</b></p>
    ${dailyEmailHtml(p, progressList, null)}
  `;

  return baseLayout({ title: `Encerramento • ${p.title}`, bodyHtml: body });
}

module.exports = { startEmailHtml, dailyEmailHtml, finalEmailHtml };
