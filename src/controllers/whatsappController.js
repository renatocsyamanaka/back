const { Op } = require('sequelize');
const { WhatsappConversation, WhatsappMessage, sequelize } = require('../models');
const waha = require('../services/wahaService');

// Memória simples do fluxo.
// Depois, se quiser, a gente migra isso para banco.
const conversationSteps = new Map();

function normalizePhone(value) {
  return String(value || '')
    .replace(/@c\.us$/i, '')
    .replace(/@s\.whatsapp\.net$/i, '')
    .replace(/@lid$/i, '')
    .replace(/\D/g, '');
}

function safeString(value) {
  return String(value || '').trim();
}

function normalizeText(value) {
  return safeString(value).toLowerCase();
}

function isGreeting(text) {
  const value = normalizeText(text);
  return [
    'oi',
    'ola',
    'olá',
    'bom dia',
    'boa tarde',
    'boa noite',
    'menu',
    'iniciar',
    'start',
  ].includes(value);
}

function isYes(text) {
  const value = normalizeText(text);
  return ['sim', 's', 'yes', 'y', 'quero', 'claro', 'ok', 'pode'].includes(value);
}

function isNo(text) {
  const value = normalizeText(text);
  return ['nao', 'não', 'n', 'no', 'sair', 'encerrar', 'cancelar'].includes(value);
}

function extractIncomingMessage(body) {
  const payload = body?.payload || body?.data || body || {};

  const from =
    payload?.from ||
    payload?._data?.from?._serialized ||
    payload?._data?.from ||
    payload?.chatId ||
    payload?.author ||
    payload?.participant ||
    '';

  const text =
    payload?.body ||
    payload?._data?.body ||
    payload?.text ||
    payload?.message ||
    payload?.content ||
    payload?.caption ||
    '';

  const messageId =
    payload?.id ||
    payload?.messageId ||
    payload?._data?.id?._serialized ||
    payload?._data?.id?.id ||
    null;

  const fromMe =
    payload?.fromMe === true ||
    payload?.from_me === true ||
    payload?._data?.id?.fromMe === true;

  const timestamp =
    payload?.timestamp ||
    payload?._data?.t ||
    Math.floor(Date.now() / 1000);

  const event = safeString(body?.event || body?.type || '');

  return {
    event,
    from: safeString(from),
    text: safeString(text),
    messageId: messageId ? String(messageId) : null,
    fromMe,
    timestamp,
    raw: body,
  };
}

async function list(req, res) {
  try {
    const rows = await WhatsappConversation.findAll({
      order: [['lastInteractionAt', 'DESC']],
    });

    return res.json(rows);
  } catch (error) {
    console.error('WHATSAPP LIST ERROR:', error);
    return res.status(500).json({
      error: error.message || 'Erro ao listar conversas',
    });
  }
}

async function detail(req, res) {
  try {
    const { id } = req.params;

    const conversation = await WhatsappConversation.findByPk(id, {
      include: [
        {
          model: WhatsappMessage,
          as: 'messages',
          required: false,
        },
      ],
    });

    if (!conversation) {
      return res.status(404).json({
        error: 'Conversa não encontrada',
      });
    }

    const json = conversation.toJSON();

    json.messages = Array.isArray(json.messages)
      ? [...json.messages].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )
      : [];

    return res.json(json);
  } catch (error) {
    console.error('WHATSAPP DETAIL ERROR:', error);
    return res.status(500).json({
      error: error.message || 'Erro ao buscar conversa',
    });
  }
}

async function sendMessageAndSave({ conversation, phone, text }) {
  const result = await waha.sendText(phone, text);

  await WhatsappMessage.create({
    conversationId: conversation.id,
    direction: 'out',
    providerMessageId:
      result?.id ||
      result?.messageId ||
      result?.key?.id ||
      null,
    text,
    rawPayload: result || null,
  });

  const totalMessages = await WhatsappMessage.count({
    where: { conversationId: conversation.id },
  });

  await conversation.update({
    lastMessage: text,
    messagesCount: totalMessages,
    lastInteractionAt: new Date(),
  });

  return result;
}

function getCurrentStep(phone) {
  return conversationSteps.get(phone) || 'INIT';
}

function setCurrentStep(phone, step) {
  conversationSteps.set(phone, step);
}

function clearCurrentStep(phone) {
  conversationSteps.delete(phone);
}

async function findDeliveryByInvoice(noteNumber) {
  const normalized = safeString(noteNumber);

  if (!normalized) return null;

  // Tenta usar model se existir
  const DeliveryReport =
    sequelize?.models?.DeliveryReport ||
    sequelize?.models?.delivery_reports ||
    null;

  if (DeliveryReport) {
    const row = await DeliveryReport.findOne({
      where: {
        [Op.or]: [
          { notaFiscal: normalized },
          { invoiceNumber: normalized },
          { numeroNota: normalized },
          { nfe: normalized },
        ],
      },
      order: [['updatedAt', 'DESC']],
    });

    if (!row) return null;

    return {
      status:
        row.statusEntrega ||
        row.deliveryStatus ||
        row.status ||
        'Sem status',
      previsao:
        row.previsaoEntrega ||
        row.estimatedDeliveryDate ||
        row.previsao ||
        null,
      cte:
        row.cte ||
        row.numeroCte ||
        row.CTE ||
        null,
    };
  }

  // Fallback SQL tolerante.
  // Ajuste nomes se quiser depois.
  try {
    const [rows] = await sequelize.query(
      `
      SELECT
        id,
        notaFiscal,
        status,
        statusEntrega,
        previsaoEntrega,
        updatedAt
      FROM delivery_reports
      WHERE notaFiscal = :note
      ORDER BY updatedAt DESC
      LIMIT 1
      `,
      {
        replacements: { note: normalized },
      }
    );

    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return null;

    return {
      status: row.statusEntrega || row.status || 'Sem status',
      previsao: row.previsaoEntrega || null,
      cte: row.cte || null,
    };
  } catch (error) {
    console.error('DELIVERY LOOKUP ERROR:', error.message);
    return null;
  }
}

function formatBotDeliveryMessage(result) {
  const status = result?.status || 'Sem status';
  const previsao = result?.previsao
    ? new Date(result.previsao).toLocaleDateString('pt-BR')
    : 'Não informada';

  const cteText = result?.cte ? `CTE: ${result.cte}\n` : '';

  return (
    `Localizei sua entrega.\n` +
    `${cteText}` +
    `Status atual: ${status}\n` +
    `Previsão de entrega: ${previsao}\n\n` +
    `Deseja consultar outra nota? Responda Sim ou Não.`
  );
}

async function runBotFlow({ conversation, phone, text }) {
  const step = getCurrentStep(phone);
  const normalized = normalizeText(text);

  if (step === 'INIT') {
    if (isGreeting(normalized) || normalized) {
      await sendMessageAndSave({
        conversation,
        phone,
        text: 'Olá! Deseja rastrear um pedido? Responda Sim ou Não.',
      });

      setCurrentStep(phone, 'ASK_TRACKING');
      return;
    }
  }

  if (step === 'ASK_TRACKING') {
    if (isYes(normalized)) {
      await sendMessageAndSave({
        conversation,
        phone,
        text: 'Perfeito. Digite o número da nota fiscal.',
      });

      setCurrentStep(phone, 'ASK_NOTE');
      return;
    }

    if (isNo(normalized)) {
      await sendMessageAndSave({
        conversation,
        phone,
        text: 'Tudo bem. Quando precisar, é só me chamar novamente.',
      });

      clearCurrentStep(phone);
      return;
    }

    await sendMessageAndSave({
      conversation,
      phone,
      text: 'Não entendi. Responda apenas Sim ou Não.',
    });

    return;
  }

  if (step === 'ASK_NOTE') {
    const noteNumber = safeString(text).replace(/\D/g, '');

    if (!noteNumber) {
      await sendMessageAndSave({
        conversation,
        phone,
        text: 'Por favor, envie apenas o número da nota fiscal.',
      });
      return;
    }

    const result = await findDeliveryByInvoice(noteNumber);

    if (!result) {
      await sendMessageAndSave({
        conversation,
        phone,
        text:
          'Não localizei essa nota no momento. Verifique o número enviado e tente novamente.',
      });
      return;
    }

    await sendMessageAndSave({
      conversation,
      phone,
      text: formatBotDeliveryMessage(result),
    });

    setCurrentStep(phone, 'ASK_ANOTHER_NOTE');
    return;
  }

  if (step === 'ASK_ANOTHER_NOTE') {
    if (isYes(normalized)) {
      await sendMessageAndSave({
        conversation,
        phone,
        text: 'Perfeito. Digite o número da próxima nota fiscal.',
      });

      setCurrentStep(phone, 'ASK_NOTE');
      return;
    }

    if (isNo(normalized)) {
      await sendMessageAndSave({
        conversation,
        phone,
        text: 'Atendimento encerrado. Quando quiser, posso ajudar novamente.',
      });

      clearCurrentStep(phone);
      return;
    }

    await sendMessageAndSave({
      conversation,
      phone,
      text: 'Responda Sim para consultar outra nota ou Não para encerrar.',
    });
  }
}

async function webhook(req, res) {
  try {
    console.log('WHATSAPP WEBHOOK BODY:', JSON.stringify(req.body, null, 2));

    const parsed = extractIncomingMessage(req.body);

    const phone = normalizePhone(parsed.from);
    const text = safeString(parsed.text);

    // Ignora duplicado do WAHA se vier message.any + message
    if (parsed.event && !['message', 'message.any', ''].includes(parsed.event)) {
      return res.status(200).json({
        ok: true,
        ignored: true,
        reason: 'unsupported_event',
      });
    }

    if (!phone) {
      return res.status(200).json({
        ok: true,
        ignored: true,
        reason: 'phone_not_found',
      });
    }

    if (parsed.fromMe) {
      return res.status(200).json({
        ok: true,
        ignored: true,
        reason: 'from_me',
      });
    }

    if (!text) {
      return res.status(200).json({
        ok: true,
        ignored: true,
        reason: 'empty_text',
      });
    }

    let conversation = await WhatsappConversation.findOne({
      where: { phone },
    });

    if (!conversation) {
      conversation = await WhatsappConversation.create({
        phone,
        contactName: phone,
        status: 'OPEN',
        lastMessage: text,
        messagesCount: 0,
        provider: 'waha',
        lastInteractionAt: new Date(parsed.timestamp * 1000),
      });
    } else {
      await conversation.update({
        lastMessage: text,
        status: 'OPEN',
        lastInteractionAt: new Date(parsed.timestamp * 1000),
      });
    }

    let alreadyExists = null;

    if (parsed.messageId) {
      alreadyExists = await WhatsappMessage.findOne({
        where: {
          conversationId: conversation.id,
          providerMessageId: parsed.messageId,
        },
      });
    }

    if (!alreadyExists) {
      await WhatsappMessage.create({
        conversationId: conversation.id,
        direction: 'in',
        providerMessageId: parsed.messageId,
        text,
        rawPayload: parsed.raw,
      });
    }

    const totalMessages = await WhatsappMessage.count({
      where: { conversationId: conversation.id },
    });

    await conversation.update({
      messagesCount: totalMessages,
      lastMessage: text,
      lastInteractionAt: new Date(parsed.timestamp * 1000),
    });

    if (!alreadyExists) {
      await runBotFlow({
        conversation,
        phone,
        text,
      });
    }

    return res.status(200).json({
      ok: true,
      conversationId: conversation.id,
      duplicated: !!alreadyExists,
    });
  } catch (error) {
    console.error('WHATSAPP WEBHOOK ERROR:', error);
    return res.status(500).json({
      error: error.message || 'Erro no webhook',
    });
  }
}

async function send(req, res) {
  try {
    const { id } = req.params;
    const text = safeString(req.body?.message);

    if (!text) {
      return res.status(400).json({
        error: 'Mensagem obrigatória.',
      });
    }

    const conversation = await WhatsappConversation.findByPk(id);

    if (!conversation) {
      return res.status(404).json({
        error: 'Conversa não encontrada.',
      });
    }

    const phone = normalizePhone(conversation.phone);

    const result = await sendMessageAndSave({
      conversation,
      phone,
      text,
    });

    return res.json({
      ok: true,
      result,
    });
  } catch (error) {
    console.error('WHATSAPP SEND ERROR:', error);
    return res.status(500).json({
      error: error.message || 'Erro ao enviar mensagem.',
    });
  }
}

module.exports = {
  list,
  detail,
  webhook,
  send,
};