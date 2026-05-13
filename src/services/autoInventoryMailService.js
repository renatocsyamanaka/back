const nodemailer = require('nodemailer');

const API_URL = process.env.API_URL || 'http://localhost:3000';

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_ENDERECO_SMTP || 'smtp.office365.com',
    port: Number(process.env.EMAIL_PORTA_SMTP || 587),
    secure: String(process.env.EMAIL_SECURE || 'false') === 'true',
    auth: {
      user: process.env.EMAIL_USUARIO,
      pass: process.env.EMAIL_SENHA_ORIGEM,
    },
  });
}

function getInventoryLink(response) {
  return `${API_URL}/auto-inventario/${response.token}`;
}

function getLogoUrl() {
  return process.env.EMAIL_LOGO_URL || 'https://app.projetos-rc.online/logo_branca.png';
}

async function sendMail({ to, cc, subject, html }) {
  if (!to) return;

  const transporter = getTransporter();

    return transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME || 'Logistica Omnilink'}" <${process.env.EMAIL_USUARIO}>`,
      to,
      cc,
      subject,
      html,
    });
}

function baseTemplate({ title, subtitle, providerName, content, buttonText, link }) {
  const logoUrl = getLogoUrl();

  return `
    <div style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fb;padding:24px 0;">
        <tr>
          <td align="center">
            <table width="680" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.08);">

              <tr>
                <td
                  style="
                    background:linear-gradient(135deg,#006DAA 0%,#00A3E0 100%);
                    padding:34px 32px 28px 32px;
                    text-align:center;
                  "
                >
                  <img
                    src="${logoUrl}"
                    alt="Omnilink"
                    style="
                      width:260px;
                      max-width:90%;
                      height:auto;
                      display:block;
                      margin:0 auto;
                    "
                  />

                  <div
                    style="
                      margin-top:18px;
                      width:72px;
                      height:4px;
                      background:rgba(255,255,255,0.35);
                      border-radius:999px;
                      margin-left:auto;
                      margin-right:auto;
                    "
                  ></div>
                </td>
              </tr>

              <tr>
                <td style="padding:32px;">
                  <h2 style="margin:0;color:#12344d;font-size:24px;">
                    ${title}
                  </h2>

                  <p style="margin:8px 0 0;color:#5f6f7f;font-size:15px;line-height:1.6;">
                    ${subtitle}
                  </p>

                  <div style="margin-top:24px;padding:18px;background:#f7fbff;border:1px solid #d9ecff;border-radius:12px;">
                    <p style="margin:0;color:#12344d;font-size:15px;line-height:1.6;">
                      Olá, <b>${providerName || 'Prestador'}</b>.
                    </p>

                    ${content}
                  </div>

                  ${
                    link
                      ? `
                      <div style="text-align:center;margin:30px 0;">
                        <a href="${link}" target="_blank"
                          style="background:#008FD3;color:#ffffff;text-decoration:none;padding:14px 26px;border-radius:8px;font-weight:bold;font-size:15px;display:inline-block;">
                          ${buttonText || 'Acessar'}
                        </a>
                      </div>

                      <p style="margin:0;color:#7a8896;font-size:12px;line-height:1.5;">
                        Caso o botão não funcione, copie e cole este link no navegador:<br/>
                        <span style="color:#008FD3;">${link}</span>
                      </p>
                      `
                      : ''
                  }
                </td>
              </tr>

              <tr>
                <td style="background:#f0f4f8;padding:18px 32px;text-align:center;color:#66788a;font-size:12px;">
                  <p style="margin:0;">
                    Operações Omnilink<br/>
                    É sempre um prazer atender você.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}

async function sendInventoryRequest(response, options = {}) {
  const provider = response.provider;
  const link = getInventoryLink(response);

  return sendMail({
    to: provider.email,
    subject: 'Solicitação de Auto Inventário de Peças',
    cc: options.cc || '',
    html: baseTemplate({
      title: 'Auto Inventário de Peças',
      subtitle: 'Está disponível o preenchimento mensal do seu inventário de peças.',
      providerName: provider.name,
      buttonText: 'Acessar Auto Inventário',
      link,
      content: `
        <p style="margin:12px 0 0;color:#12344d;font-size:15px;line-height:1.6;">
          Solicitamos que informe a quantidade disponível de cada peça listada.
        </p>

        <p style="margin:12px 0 0;color:#12344d;font-size:15px;line-height:1.6;">
          O preenchimento é obrigatório para controle mensal de estoque.
        </p>
      `,
    }),
  });
}

async function sendReminder(response, options = {}) {
  const provider = response.provider;
  const link = getInventoryLink(response);

  const subject =
    response.status === 'PARCIAL'
      ? 'Auto Inventário Parcial - Finalize o preenchimento'
      : 'Lembrete - Preencha seu Auto Inventário de Peças';

  return sendMail({
    to: provider.email,
    subject,
    cc: options.cc || '',
    html: baseTemplate({
      title: 'Lembrete de Auto Inventário',
      subtitle: 'Identificamos que seu inventário ainda não foi finalizado.',
      providerName: provider.name,
      buttonText: 'Finalizar Auto Inventário',
      link,
      content: `
        <p style="margin:12px 0 0;color:#12344d;font-size:15px;line-height:1.6;">
          Status atual: <b>${response.status}</b>
        </p>

        <p style="margin:12px 0 0;color:#12344d;font-size:15px;line-height:1.6;">
          Acesse o link abaixo e conclua o preenchimento das peças pendentes.
        </p>
      `,
    }),
  });
}

async function sendCompleted(response) {
  const provider = response.provider;

  return sendMail({
    to: provider.email,
    subject: 'Auto Inventário enviado com sucesso',
    html: baseTemplate({
      title: 'Auto Inventário Recebido',
      subtitle: 'Recebemos seu preenchimento com sucesso.',
      providerName: provider.name,
      content: `
        <p style="margin:12px 0 0;color:#12344d;font-size:15px;line-height:1.6;">
          Obrigado pelo retorno. Seu auto inventário de peças foi registrado em nosso sistema.
        </p>
      `,
    }),
  });
}

module.exports = {
  sendInventoryRequest,
  sendReminder,
  sendCompleted,
};