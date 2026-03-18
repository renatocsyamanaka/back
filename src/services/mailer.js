// src/services/mailer.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_ENDERECO_SMTP,
  port: Number(process.env.EMAIL_PORTA_SMTP || 587),
  secure: String(process.env.EMAIL_SECURE).toLowerCase() === 'true',
  auth: {
    user: process.env.EMAIL_USUARIO,
    pass: process.env.EMAIL_SENHA_ORIGEM,
  },
  requireTLS: true,
});

async function sendMail({ to, cc, bcc, subject, html, text, replyTo }) {
  const fromName = process.env.EMAIL_FROM_NAME || 'Omnilink';
  const from = `${fromName} <${process.env.EMAIL_USUARIO}>`;

  return transporter.sendMail({
    from,
    to,
    cc,
    bcc,
    replyTo,
    subject,
    html,
    text,
  });
}

module.exports = { sendMail };