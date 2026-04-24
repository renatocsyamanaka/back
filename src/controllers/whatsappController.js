const { Op } = require('sequelize');
const { WhatsappConversation, WhatsappMessage, User, sequelize } = require('../models');
const waha = require('../services/wahaService');

function normalizePhone(value) {
  return String(value || '')
    .replace(/@c\.us$/i, '')
    .replace(/@s\.whatsapp\.net$/i, '')
    .replace(/@lid$/i, '')
    .replace(/\D/g, '');
}

function phoneVariants(value) {
  const digits = normalizePhone(value);
  const variants = new Set();

  if (digits) variants.add(digits);

  if (digits.startsWith('55') && digits.length > 11) {
    variants.add(digits.slice(2));
  } else if (digits.length >= 10 && digits.length <= 11) {
    variants.add(`55${digits}`);
  }

  return [...variants].filter(Boolean);
}

function isSamePhone(a, b) {
  const aVariants = phoneVariants(a);
  const bVariants = phoneVariants(b);

  return aVariants.some((item) => bVariants.includes(item));
}

function hasRegisteredPhone(user) {
  return Boolean(normalizePhone(user?.phone));
}

async function findUserByWhatsappPhone(phone) {
  const incomingVariants = phoneVariants(phone);

  if (!incomingVariants.length) return null;

  // Primeiro tenta buscar pelo formato já padronizado.
  let user = await User.findOne({
    where: {
      phone: {
        [Op.in]: incomingVariants,
      },
      isActive: true,
    },
    attributes: ['id', 'name', 'email', 'phone', 'cargoDescritivo', 'isActive'],
  });

  if (user) return user;

  // Fallback para telefones antigos com máscara: (11) 99999-9999, 11-99999-9999 etc.
  const usersWithPhone = await User.findAll({
    where: {
      phone: {
        [Op.ne]: null,
      },
      isActive: true,
    },
    attributes: ['id', 'name', 'email', 'phone', 'cargoDescritivo', 'isActive'],
  });

  return usersWithPhone.find((item) => isSamePhone(item.phone, phone)) || null;
}

function buildUnregisteredPhoneMessage() {
  return (
    '⚠️ Número não cadastrado.\n\n' +
    'Não identificamos seu telefone na base de usuários.\n\n' +
    'Para utilizar o atendimento via WhatsApp, solicite o cadastro do seu número com a equipe de logística.\n\n' +
    'Depois que o cadastro for realizado, envie uma nova mensagem por aqui.'
  );
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

function isGroupChat(chatId) {
  return safeString(chatId).endsWith('@g.us');
}

function isBroadcastChat(chatId) {
  const value = safeString(chatId);
  return value.includes('status@broadcast') || value.includes('@broadcast');
}

function normalizeMessageId(rawValue) {
  if (rawValue == null) return null;
  if (typeof rawValue === 'string') return rawValue;
  if (typeof rawValue === 'number') return String(rawValue);

  if (typeof rawValue === 'object') {
    if (typeof rawValue._serialized === 'string') return rawValue._serialized;
    if (typeof rawValue.id === 'string') return rawValue.id;
    if (typeof rawValue.id === 'number') return String(rawValue.id);

    try {
      return JSON.stringify(rawValue);
    } catch (error) {
      return String(rawValue);
    }
  }

  return String(rawValue);
}

function extractProviderMessageId(payload) {
  const candidate =
    payload?.id ??
    payload?.messageId ??
    payload?.key?.id ??
    payload?.message?.id ??
    payload?._data?.id ??
    null;

  return normalizeMessageId(candidate);
}

function extractIncomingMessage(body) {
  const payload = body?.payload || body?.data || body?.message || body || {};

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

  const rawMessageId =
    payload?.id ??
    payload?.messageId ??
    payload?._data?.id?._serialized ??
    payload?._data?.id?.id ??
    payload?._data?.id ??
    null;

  const messageId = normalizeMessageId(rawMessageId);

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
    messageId,
    fromMe,
    timestamp: Number(timestamp) || Math.floor(Date.now() / 1000),
    raw: body,
  };
}

function getCurrentStep(conversation) {
  return safeString(conversation?.currentStepCode) || 'INIT';
}

async function setCurrentStep(conversation, step) {
  await conversation.update({ currentStepCode: step });
  conversation.currentStepCode = step;
}

async function clearCurrentStep(conversation) {
  await conversation.update({ currentStepCode: 'INIT' });
  conversation.currentStepCode = 'INIT';
}

async function recalcConversationCounters(conversation) {
  const totalMessages = await WhatsappMessage.count({
    where: { conversationId: conversation.id },
  });

  await conversation.update({
    messagesCount: totalMessages,
  });

  conversation.messagesCount = totalMessages;
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

async function sendMessageAndSave({ conversation, text, senderType = 'BOT' }) {
  const chatId =
    safeString(conversation.providerChatId) ||
    safeString(conversation.phone);

  if (!chatId) {
    throw new Error('ChatId não encontrado na conversa');
  }

  const now = new Date();
  const result = await waha.sendText(chatId, text);

  await WhatsappMessage.create({
    conversationId: conversation.id,
    direction: 'OUT',
    senderType,
    messageType: 'TEXT',
    providerMessageId: extractProviderMessageId(result),
    text,
    rawPayload: result || null,
    sentAt: now,
  });

  await recalcConversationCounters(conversation);

  await conversation.update({
    lastMessage: text,
    lastBotMessageAt: now,
    lastInteractionAt: now,
  });

  conversation.lastMessage = text;
  conversation.lastBotMessageAt = now;
  conversation.lastInteractionAt = now;

  return result;
}

async function findDeliveryByInvoice(noteNumber) {
  const normalized = safeString(noteNumber);

  if (!normalized) return null;

  const DeliveryReport =
    sequelize?.models?.DeliveryReport ||
    sequelize?.models?.delivery_reports ||
    null;

  if (DeliveryReport) {
    const row = await DeliveryReport.findOne({
      where: {
        notaFiscal: normalized,
      },
      order: [['updatedAt', 'DESC']],
    });

    if (!row) return null;

    return {
      status: row.statusEntrega || row.status || 'Sem status',
      previsao: row.previsaoEntrega || null,
      cte: row.cte || null,
    };
  }

  try {
    const [rows] = await sequelize.query(
      `
      SELECT
        id,
        cte,
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

async function runBotFlow({ conversation, text }) {
  const step = getCurrentStep(conversation);
  const normalized = normalizeText(text);

  if (step === 'INIT' || step === 'GREETING') {
    await sendMessageAndSave({
      conversation,
      text: 'Olá! Deseja rastrear um pedido? Responda Sim ou Não.',
    });

    await setCurrentStep(conversation, 'ASK_TRACKING');
    return;
  }

  if (step === 'ASK_TRACKING') {
    if (isYes(normalized)) {
      await sendMessageAndSave({
        conversation,
        text: 'Perfeito. Digite o número da nota fiscal.',
      });

      await setCurrentStep(conversation, 'ASK_NOTE');
      return;
    }

    if (isNo(normalized)) {
      await sendMessageAndSave({
        conversation,
        text: 'Tudo bem. Quando precisar, é só me chamar novamente.',
      });

      await clearCurrentStep(conversation);
      return;
    }

    await sendMessageAndSave({
      conversation,
      text: 'Não entendi. Responda apenas Sim ou Não.',
    });
    return;
  }

  if (step === 'ASK_NOTE') {
    const noteNumber = safeString(text).replace(/\D/g, '');

    if (!noteNumber) {
      await sendMessageAndSave({
        conversation,
        text: 'Por favor, envie apenas o número da nota fiscal.',
      });
      return;
    }

    const result = await findDeliveryByInvoice(noteNumber);

    if (!result) {
      await sendMessageAndSave({
        conversation,
        text: 'Não localizei essa nota no momento. Verifique o número enviado e tente novamente.',
      });
      return;
    }

    await conversation.update({
      lastNoteNumber: noteNumber,
      lastCte: result?.cte || null,
    });

    conversation.lastNoteNumber = noteNumber;
    conversation.lastCte = result?.cte || null;

    await sendMessageAndSave({
      conversation,
      text: formatBotDeliveryMessage(result),
    });

    await setCurrentStep(conversation, 'ASK_ANOTHER_NOTE');
    return;
  }

  if (step === 'ASK_ANOTHER_NOTE') {
    if (isYes(normalized)) {
      await sendMessageAndSave({
        conversation,
        text: 'Perfeito. Digite o número da próxima nota fiscal.',
      });

      await setCurrentStep(conversation, 'ASK_NOTE');
      return;
    }

    if (isNo(normalized)) {
      await sendMessageAndSave({
        conversation,
        text: 'Atendimento encerrado. Quando quiser, posso ajudar novamente.',
      });

      await clearCurrentStep(conversation);
      return;
    }

    await sendMessageAndSave({
      conversation,
      text: 'Responda Sim para consultar outra nota ou Não para encerrar.',
    });
    return;
  }

  await clearCurrentStep(conversation);

  await sendMessageAndSave({
    conversation,
    text: 'Olá! Deseja rastrear um pedido? Responda Sim ou Não.',
  });

  await setCurrentStep(conversation, 'ASK_TRACKING');
}

async function webhook(req, res) {
  try {
    const parsed = extractIncomingMessage(req.body);

    const phone = normalizePhone(parsed.from);
    const text = safeString(parsed.text);
    const interactionDate = new Date(parsed.timestamp * 1000);

    if (isGroupChat(parsed.from)) {
      return res.status(200).json({
        ok: true,
        ignored: true,
        reason: 'group_message',
      });
    }

    if (isBroadcastChat(parsed.from)) {
      return res.status(200).json({
        ok: true,
        ignored: true,
        reason: 'broadcast_message',
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

    if (parsed.event && parsed.event !== 'message') {
      return res.status(200).json({
        ok: true,
        ignored: true,
        reason: 'unsupported_event',
      });
    }

    const registeredUser = await findUserByWhatsappPhone(phone);

    let conversation = await WhatsappConversation.findOne({
      where: { phone },
    });

    if (!conversation) {
      conversation = await WhatsappConversation.create({
        phone,
        providerChatId: parsed.from,
        contactName: registeredUser?.name || phone,
        status: 'OPEN',
        provider: 'waha',
        lastMessage: text,
        messagesCount: 0,
        lastUserMessageAt: interactionDate,
        lastInteractionAt: interactionDate,
        currentFlowCode: 'DEFAULT_TRACKING',
        currentStepCode: 'INIT',
        metadata: registeredUser
          ? {
              userId: registeredUser.id,
              userName: registeredUser.name,
              userEmail: registeredUser.email,
              userCargo: registeredUser.cargoDescritivo,
              phoneValidatedAt: new Date().toISOString(),
            }
          : {
              phoneValidation: 'NOT_REGISTERED',
              phoneValidatedAt: new Date().toISOString(),
            },
      });
    } else {
      await conversation.update({
        providerChatId: parsed.from,
        contactName: registeredUser?.name || conversation.contactName || phone,
        lastMessage: text,
        status: 'OPEN',
        lastUserMessageAt: interactionDate,
        lastInteractionAt: interactionDate,
        metadata: {
          ...(conversation.metadata || {}),
          ...(registeredUser
            ? {
                userId: registeredUser.id,
                userName: registeredUser.name,
                userEmail: registeredUser.email,
                userCargo: registeredUser.cargoDescritivo,
                phoneValidation: 'REGISTERED',
                phoneValidatedAt: new Date().toISOString(),
              }
            : {
                phoneValidation: 'NOT_REGISTERED',
                phoneValidatedAt: new Date().toISOString(),
              }),
        },
      });

      await conversation.reload();
    }

    if (parsed.messageId) {
      const alreadyExists = await WhatsappMessage.findOne({
        where: {
          conversationId: conversation.id,
          providerMessageId: parsed.messageId,
        },
      });

      if (alreadyExists) {
        return res.status(200).json({
          ok: true,
          conversationId: conversation.id,
          duplicated: true,
        });
      }
    }

    await WhatsappMessage.create({
      conversationId: conversation.id,
      direction: 'IN',
      senderType: 'USER',
      messageType: 'TEXT',
      providerMessageId: parsed.messageId,
      text,
      rawPayload: parsed.raw,
    });

    await recalcConversationCounters(conversation);

    await conversation.update({
      lastMessage: text,
      lastUserMessageAt: interactionDate,
      lastInteractionAt: interactionDate,
    });

    await conversation.reload();

    if (!registeredUser || !hasRegisteredPhone(registeredUser)) {
      await sendMessageAndSave({
        conversation,
        text: buildUnregisteredPhoneMessage(),
      });

      await conversation.reload();

      return res.status(200).json({
        ok: true,
        conversationId: conversation.id,
        duplicated: false,
        blocked: true,
        reason: 'phone_not_registered_in_users',
      });
    }

    await runBotFlow({
      conversation,
      text,
    });

    await conversation.reload();

    return res.status(200).json({
      ok: true,
      conversationId: conversation.id,
      duplicated: false,
      currentStepCode: conversation.currentStepCode,
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
    const conversationId = req.params?.id || req.body?.conversationId;
    const text = safeString(req.body?.message || req.body?.text);

    if (!conversationId) {
      return res.status(400).json({
        error: 'ID da conversa é obrigatório.',
      });
    }

    if (!text) {
      return res.status(400).json({
        error: 'Mensagem obrigatória.',
      });
    }

    const conversation = await WhatsappConversation.findByPk(conversationId);

    if (!conversation) {
      return res.status(404).json({
        error: 'Conversa não encontrada.',
      });
    }

    if (isGroupChat(conversation.providerChatId)) {
      return res.status(400).json({
        error: 'Envio para grupos não é permitido.',
      });
    }

    const result = await sendMessageAndSave({
      conversation,
      text,
      senderType: 'HUMAN',
    });

    await conversation.reload();

    return res.json({
      ok: true,
      result,
      conversation,
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