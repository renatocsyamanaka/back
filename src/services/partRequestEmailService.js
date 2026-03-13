const { sendMail } = require('./mailer');

function fmt(v) {
  return v ?? '-';
}

function fulfillmentLabel(v) {
  if (v === 'RETIRADA') return 'Retirada';
  if (v === 'ENTREGA') return 'Entrega';
  return '-';
}

function requestStatusLabel(v) {
  const map = {
    DRAFT: 'Rascunho',
    SUBMITTED: 'Enviado',
    UNDER_REVIEW: 'Em análise',
    PARTIALLY_APPROVED: 'Aprovado parcialmente',
    APPROVED: 'Aprovado',
    PARTIALLY_FULFILLED: 'Atendido parcialmente',
    FULFILLED: 'Atendido',
    REJECTED: 'Rejeitado',
    CANCELLED: 'Cancelado',
    REOPENED: 'Reaberto',
  };
  return map[v] || v || '-';
}

function itemStatusLabel(v) {
  const map = {
    PENDING_REVIEW: 'Pendente de análise',
    APPROVED_PARTIAL: 'Aprovado parcialmente',
    APPROVED: 'Aprovado',
    REJECTED: 'Rejeitado',
    PARTIALLY_FULFILLED: 'Atendido parcialmente',
    FULFILLED: 'Atendido',
    CANCELLED: 'Cancelado',
    REOPENED: 'Reaberto',
  };
  return map[v] || v || '-';
}

function reasonLabel(v) {
  const map = {
    SEM_ESTOQUE: 'Sem estoque',
    REPROVADO_GERENTE: 'Reprovado pelo gestor',
    DADOS_INSUFICIENTES: 'Dados insuficientes',
    ITEM_INCORRETO: 'Item incorreto',
    ATENDIMENTO_PARCIAL: 'Atendimento parcial',
    AGUARDANDO_VALIDACAO: 'Aguardando validação',
    FORA_DO_ESCOPO: 'Fora do escopo',
    OUTROS: 'Outros',
  };
  return map[v] || v || '-';
}

function actionLabel(v) {
  const map = {
    SUBMITTED: 'Pedido criado',
    ITEM_APPROVED: 'Item aprovado',
    ITEM_PARTIALLY_APPROVED: 'Item aprovado parcialmente',
    ITEM_REJECTED: 'Item rejeitado',
    REQUEST_UPDATED: 'Pedido atualizado',
    REQUEST_STATUS_UPDATED: 'Status do pedido atualizado',
    BATCH_APPROVAL: 'Aprovação em lote',
  };
  return map[v] || v || '-';
}

function statusPill(text, bg, color) {
  return `
    <span style="
      display:inline-block;
      padding:6px 12px;
      border-radius:999px;
      font-size:12px;
      font-weight:700;
      background:${bg};
      color:${color};
      white-space:nowrap;
    ">
      ${text}
    </span>
  `;
}

function itemStatusPill(status) {
  const label = itemStatusLabel(status);

  const map = {
    PENDING_REVIEW: { bg: '#FFF7E6', color: '#D48806' },
    APPROVED_PARTIAL: { bg: '#FFF2E8', color: '#D46B08' },
    APPROVED: { bg: '#F6FFED', color: '#389E0D' },
    REJECTED: { bg: '#FFF1F0', color: '#CF1322' },
    PARTIALLY_FULFILLED: { bg: '#E6FFFB', color: '#08979C' },
    FULFILLED: { bg: '#F6FFED', color: '#389E0D' },
    CANCELLED: { bg: '#FAFAFA', color: '#595959' },
    REOPENED: { bg: '#F9F0FF', color: '#722ED1' },
  };

  const style = map[status] || { bg: '#F5F5F5', color: '#434343' };
  return statusPill(label, style.bg, style.color);
}

function requesterEmail(request) {
  return request?.requesterEmail || request?.requesterUser?.email || null;
}

function managerEmail(request) {
  return request?.manager?.email || null;
}

function managementRecipients(request) {
  const fixed = process.env.PART_REQUEST_MANAGEMENT_EMAILS
    ? process.env.PART_REQUEST_MANAGEMENT_EMAILS.split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const manager = managerEmail(request);
  const all = [...new Set([manager, ...fixed].filter(Boolean))];
  return all.length ? all.join(',') : null;
}

function shellTemplate({ title, subtitle, body, accent = '#0B3B8C' }) {
  return `
    <div style="margin:0;padding:24px;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#1f1f1f;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:760px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:${accent};padding:28px 32px;">
            <div style="font-size:28px;font-weight:700;color:#ffffff;line-height:1.2;">
              ${title}
            </div>
            ${
              subtitle
                ? `<div style="margin-top:8px;font-size:14px;color:rgba(255,255,255,0.92);">${subtitle}</div>`
                : ''
            }
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px;">
            ${body}
          </td>
        </tr>
        <tr>
          <td style="padding:18px 32px;background:#fafafa;border-top:1px solid #f0f0f0;font-size:12px;color:#8c8c8c;">
            Esta é uma mensagem automática do sistema de Operações.
          </td>
        </tr>
      </table>
    </div>
  `;
}

function infoGrid(rows = []) {
  const valid = rows.filter(Boolean);

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 20px 0;">
      ${valid
        .map(
          ([label, value]) => `
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;width:220px;font-weight:700;color:#434343;vertical-align:top;">
                ${label}
              </td>
              <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#262626;vertical-align:top;">
                ${value}
              </td>
            </tr>
          `
        )
        .join('')}
    </table>
  `;
}

function itemsHtml(items = []) {
  if (!items.length) {
    return `<div style="padding:16px;background:#fafafa;border:1px solid #f0f0f0;border-radius:12px;">Nenhum item informado.</div>`;
  }

  return `
    <table style="border-collapse: collapse; width: 100%; font-size: 13px; border:1px solid #f0f0f0; border-radius:12px; overflow:hidden;">
      <thead>
        <tr>
          <th style="border-bottom:1px solid #f0f0f0;padding:12px;text-align:left;background:#fafafa;">Código</th>
          <th style="border-bottom:1px solid #f0f0f0;padding:12px;text-align:left;background:#fafafa;">Peça</th>
          <th style="border-bottom:1px solid #f0f0f0;padding:12px;text-align:left;background:#fafafa;">Unidade</th>
          <th style="border-bottom:1px solid #f0f0f0;padding:12px;text-align:left;background:#fafafa;">Qtd.</th>
          <th style="border-bottom:1px solid #f0f0f0;padding:12px;text-align:left;background:#fafafa;">Observação</th>
        </tr>
      </thead>
      <tbody>
        ${items
          .map(
            (item) => `
              <tr>
                <td style="border-bottom:1px solid #f5f5f5;padding:12px;">${fmt(item.partCode)}</td>
                <td style="border-bottom:1px solid #f5f5f5;padding:12px;">${fmt(item.partName)}</td>
                <td style="border-bottom:1px solid #f5f5f5;padding:12px;">${fmt(item.unit)}</td>
                <td style="border-bottom:1px solid #f5f5f5;padding:12px;">${fmt(item.requestedQty)}</td>
                <td style="border-bottom:1px solid #f5f5f5;padding:12px;">${fmt(item.itemRequestNote)}</td>
              </tr>
            `
          )
          .join('')}
      </tbody>
    </table>
  `;
}

async function sendRequestCreatedToManagement(request) {
  const to = managementRecipients(request);
  if (!to) return;

  const body = `
    <div style="margin-bottom:18px;font-size:15px;color:#595959;">
      Um novo pedido de peças foi registrado no sistema e está aguardando análise da gestão.
    </div>

    ${infoGrid([
      ['Número do pedido', `<b>${fmt(request.requestNumber)}</b>`],
      ['Solicitante', fmt(request.requesterName)],
      ['E-mail do solicitante', fmt(request.requesterEmail || request?.requesterUser?.email)],
      ['Cliente', fmt(request.clientNameSnapshot || request?.client?.name)],
      ['Prestador', fmt(request.providerNameSnapshot)],
      ['Técnico', fmt(request.technicianNameSnapshot)],
      ['Tipo', fmt(request.requestType)],
      ['Atendimento', fulfillmentLabel(request.fulfillmentType)],
      ['Ocorrência', fmt(request.occurrence)],
      ['NA / OS', `${fmt(request.naCode)} / ${fmt(request.osCode)}`],
      ['Projeto', fmt(request.projectName)],
      ['Observações', fmt(request.requestNotes)],
    ])}

    <div style="margin:24px 0 10px 0;font-size:18px;font-weight:700;color:#262626;">Itens solicitados</div>
    ${itemsHtml(request.items)}
  `;

  await sendMail({
    to,
    subject: `Novo pedido de peças - ${request.requestNumber}`,
    html: shellTemplate({
      title: 'Novo pedido de peças',
      subtitle: `Pedido ${request.requestNumber} criado por ${fmt(request.requesterName)}`,
      body,
      accent: '#0B3B8C',
    }),
  });
}

async function sendItemDecisionToRequester({ request, item, actionLabel: actionRaw }) {
  const to = requesterEmail(request);
  if (!to) return;

  const body = `
    <div style="margin-bottom:18px;font-size:15px;color:#595959;">
      Houve uma atualização em um dos itens do seu pedido de peças.
    </div>

    ${infoGrid([
      ['Número do pedido', `<b>${fmt(request.requestNumber)}</b>`],
      ['Ação', actionLabel(actionRaw)],
      ['Peça', fmt(item.partName)],
      ['Código', fmt(item.partCode)],
      ['Quantidade solicitada', fmt(item.requestedQty)],
      ['Quantidade aprovada', fmt(item.approvedQty)],
      ['Quantidade rejeitada', fmt(item.rejectedQty)],
      ['Status do item', itemStatusPill(item.itemStatus)],
      ['Motivo', reasonLabel(item.reasonCode)],
      ['Detalhamento', fmt(item.reasonDetails)],
      ['Observação do gestor', fmt(item.managerNote)],
    ])}
  `;

  await sendMail({
    to,
    subject: `Atualização do pedido ${request.requestNumber} - ${actionLabel(actionRaw)}`,
    html: shellTemplate({
      title: 'Atualização do seu pedido de peças',
      subtitle: `Pedido ${request.requestNumber}`,
      body,
      accent: item.itemStatus === 'REJECTED' ? '#CF1322' : '#0B3B8C',
    }),
  });
}

async function sendRequestUpdatedToRequester({ request, changes }) {
  const to = request?.requesterEmail || request?.requesterUser?.email || null;
  if (!to) {
    console.warn('[sendRequestUpdatedToRequester] solicitante sem e-mail');
    return;
  }

  const body = `
    <div style="margin-bottom:18px;font-size:15px;color:#595959;">
      O seu pedido foi atualizado pela gestão.
    </div>

    ${infoGrid([
      ['Número do pedido', `<b>${fmt(request.requestNumber)}</b>`],
      ['Status atual', requestStatusLabel(request.status)],
      ['Atendimento', fulfillmentLabel(request.fulfillmentType)],
      ['Número da NF', fmt(request.invoiceNumber)],
      ['Expedido', request.isExpedited ? 'Sim' : 'Não'],
      ['Alterações realizadas', fmt(changes)],
    ])}
  `;

  console.log('[sendRequestUpdatedToRequester] enviando para:', to);
  console.log('[sendRequestUpdatedToRequester] request:', request?.requestNumber);

  await sendMail({
    to,
    subject: `Pedido atualizado - ${request.requestNumber}`,
    html: shellTemplate({
      title: 'Seu pedido foi atualizado',
      subtitle: `Pedido ${request.requestNumber}`,
      body,
      accent: '#1677ff',
    }),
  });
}

async function sendBatchDecisionToRequester({ request, items = [] }) {
  const to = requesterEmail(request);
  if (!to || !items.length) return;

  const rows = items
    .map(
      (item) => `
        <tr>
          <td style="border-bottom:1px solid #f5f5f5;padding:12px;">${fmt(item.partCode)}</td>
          <td style="border-bottom:1px solid #f5f5f5;padding:12px;">${fmt(item.partName)}</td>
          <td style="border-bottom:1px solid #f5f5f5;padding:12px;">${fmt(item.requestedQty)}</td>
          <td style="border-bottom:1px solid #f5f5f5;padding:12px;">${fmt(item.approvedQty)}</td>
          <td style="border-bottom:1px solid #f5f5f5;padding:12px;">${fmt(item.rejectedQty)}</td>
          <td style="border-bottom:1px solid #f5f5f5;padding:12px;">${itemStatusLabel(item.itemStatus)}</td>
        </tr>
      `
    )
    .join('');

  const body = `
    <div style="margin-bottom:18px;font-size:15px;color:#595959;">
      Houve uma atualização em lote nos itens do seu pedido.
    </div>

    ${infoGrid([
      ['Número do pedido', `<b>${fmt(request.requestNumber)}</b>`],
      ['Cliente', fmt(request.clientNameSnapshot || request?.client?.name)],
      ['Total de itens atualizados', String(items.length)],
    ])}

    <div style="margin:24px 0 10px 0;font-size:18px;font-weight:700;color:#262626;">Itens atualizados</div>

    <table style="border-collapse: collapse; width: 100%; font-size: 13px; border:1px solid #f0f0f0; border-radius:12px; overflow:hidden;">
      <thead>
        <tr>
          <th style="border-bottom:1px solid #f0f0f0;padding:12px;text-align:left;background:#fafafa;">Código</th>
          <th style="border-bottom:1px solid #f0f0f0;padding:12px;text-align:left;background:#fafafa;">Peça</th>
          <th style="border-bottom:1px solid #f0f0f0;padding:12px;text-align:left;background:#fafafa;">Solicitada</th>
          <th style="border-bottom:1px solid #f0f0f0;padding:12px;text-align:left;background:#fafafa;">Aprovada</th>
          <th style="border-bottom:1px solid #f0f0f0;padding:12px;text-align:left;background:#fafafa;">Rejeitada</th>
          <th style="border-bottom:1px solid #f0f0f0;padding:12px;text-align:left;background:#fafafa;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;

  await sendMail({
    to,
    subject: `Atualização em lote do pedido ${request.requestNumber}`,
    html: shellTemplate({
      title: 'Atualização do seu pedido de peças',
      subtitle: `Pedido ${request.requestNumber}`,
      body,
      accent: '#0B3B8C',
    }),
  });
}

module.exports = {
  sendRequestCreatedToManagement,
  sendItemDecisionToRequester,
  sendRequestUpdatedToRequester,
  sendBatchDecisionToRequester,
};