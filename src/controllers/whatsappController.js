const { Op } = require('sequelize');
const { WhatsappConversation, WhatsappMessage, User, sequelize } = require('../models');
const waha = require('../services/wahaService');
const { sendMail } = require('../services/mailer');

function safeString(value) {
  return String(value || '').trim();
}

function normalizeText(value) {
  return safeString(value).toLowerCase();
}

function normalizePhone(value) {
  return String(value || '')
    .replace(/@c\.us$/i, '')
    .replace(/@s\.whatsapp\.net$/i, '')
    .replace(/@lid$/i, '')
    .replace(/\D/g, '');
}

function normalizeIdentifier(value) {
  return safeString(value).toLowerCase().replace(/[.\-/\s]/g, '');
}

function isLidChat(chatId) {
  return safeString(chatId).endsWith('@lid');
}

function isGroupChat(chatId) {
  return safeString(chatId).endsWith('@g.us');
}

function isBroadcastChat(chatId) {
  const value = safeString(chatId);
  return value.includes('status@broadcast') || value.includes('@broadcast');
}

function isYes(text) {
  const value = normalizeText(text);
  return ['sim', 's', 'yes', 'y', 'quero', 'claro', 'ok', 'pode'].includes(value);
}

function isNo(text) {
  const value = normalizeText(text);
  return ['nao', 'não', 'n', 'no', 'sair', 'encerrar', 'cancelar'].includes(value);
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
    } catch {
      return String(rawValue);
    }
  }

  return String(rawValue);
}

function extractProviderMessageId(payload) {
  return normalizeMessageId(
    payload?.id ??
      payload?.messageId ??
      payload?.key?.id ??
      payload?.message?.id ??
      payload?._data?.id ??
      null
  );
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

  const fromMe =
    payload?.fromMe === true ||
    payload?.from_me === true ||
    payload?._data?.id?.fromMe === true;

  const timestamp =
    payload?.timestamp ||
    payload?._data?.t ||
    Math.floor(Date.now() / 1000);

  return {
    event: safeString(body?.event || body?.type || ''),
    from: safeString(from),
    text: safeString(text),
    messageId: normalizeMessageId(rawMessageId),
    fromMe,
    timestamp: Number(timestamp) || Math.floor(Date.now() / 1000),
    raw: body,
  };
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

async function findUserByWhatsappPhone(phone) {
  const incomingVariants = phoneVariants(phone);

  if (!incomingVariants.length) return null;

  const users = await User.findAll({
    where: {
      phone: {
        [Op.ne]: null,
      },
      isActive: true,
    },
    attributes: ['id', 'name', 'email', 'phone', 'cargoDescritivo', 'avatarUrl'],
  });

  return (
    users.find((user) =>
      incomingVariants.some((variant) => normalizePhone(user.phone) === normalizePhone(variant))
    ) || null
  );
}

async function findUserByIdentifier(identifier) {
  const value = safeString(identifier);
  const normalized = normalizeIdentifier(value);

  if (!value) return null;

  const users = await User.findAll({
    where: {
      isActive: true,
    },
    attributes: ['id', 'name', 'email', 'phone', 'cargoDescritivo', 'avatarUrl'],
  });

  return (
    users.find((user) => {
      const email = normalizeIdentifier(user.email);
      const phone = normalizeIdentifier(user.phone);

      return email === normalized || phone === normalized;
    }) || null
  );
}

function generateVerificationCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendVerificationEmail(user, code) {
  if (!user?.email) {
    throw new Error('Usuário não possui e-mail cadastrado para validação.');
  }

  await sendMail({
    to: user.email,
    subject: 'Código de validação do WhatsApp',
    html: `
      <div style="font-family: Arial, sans-serif; color:#111827;">
        <h2>Validação de atendimento via WhatsApp</h2>
        <p>Olá, ${user.name || 'usuário'}.</p>
        <p>Use o código abaixo para liberar seu atendimento no WhatsApp:</p>
        <div style="font-size:28px;font-weight:800;letter-spacing:4px;background:#f3f4f6;padding:14px 18px;border-radius:10px;display:inline-block;">
          ${code}
        </div>
        <p style="margin-top:18px;">Este código expira em 10 minutos.</p>
        <p>Se você não solicitou esse atendimento, ignore este e-mail.</p>
      </div>
    `,
    text: `Seu código de validação do WhatsApp é: ${code}. Ele expira em 10 minutos.`,
  });
}

function getCurrentStep(conversation) {
  return safeString(conversation?.currentStepCode) || 'INIT';
}

async function setCurrentStep(conversation, step, status = null) {
  const payload = { currentStepCode: step };

  if (status) {
    payload.status = status;
    if (status !== 'CLOSED') payload.closedAt = null;
  }

  await conversation.update(payload);
  conversation.currentStepCode = step;
  if (status) conversation.status = status;
}

async function closeConversation(conversation) {
  await conversation.update({
    currentStepCode: 'INIT',
    status: 'CLOSED',
    closedAt: new Date(),
  });

  conversation.currentStepCode = 'INIT';
  conversation.status = 'CLOSED';
}

async function recalcConversationCounters(conversation) {
  const totalMessages = await WhatsappMessage.count({
    where: { conversationId: conversation.id },
  });

  await conversation.update({ messagesCount: totalMessages });
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
  const chatId = safeString(conversation.providerChatId) || safeString(conversation.phone);

  if (!chatId) throw new Error('ChatId não encontrado na conversa.');
  if (isGroupChat(chatId)) throw new Error('Envio para grupos não é permitido.');

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
      where: { notaFiscal: normalized },
      order: [['updatedAt', 'DESC']],
    });

    if (!row) return null;

    return {
      status: row.statusEntrega || row.status || 'Sem status',
      previsao: row.previsaoEntrega || null,
      cte: row.cte || null,
    };
  }

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

async function startIdentityFlow(conversation) {
  await sendMessageAndSave({
    conversation,
    text:
      '🔐 Não consegui identificar seu número automaticamente.\n\n' +
      'Para continuar com segurança, informe seu e-mail cadastrado.',
  });

  await setCurrentStep(conversation, 'ASK_IDENTITY', 'OPEN');
}

async function handleIdentityStep(conversation, text) {
  const identifier = safeString(text);
  const user = await findUserByIdentifier(identifier);

  if (!user) {
    await sendMessageAndSave({
      conversation,
      text:
        'Não encontrei nenhum usuário ativo com esse e-mail.\n\n' +
        'Verifique e envie novamente o e-mail cadastrado.',
    });

    await setCurrentStep(conversation, 'ASK_IDENTITY', 'OPEN');
    return;
  }

  if (!user.email) {
    await sendMessageAndSave({
      conversation,
      text:
        'Seu cadastro não possui e-mail para validação.\n\n' +
        'Procure a equipe responsável para atualizar seu cadastro.',
    });

    await closeConversation(conversation);
    return;
  }

  const code = generateVerificationCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await conversation.update({
    linkedUserId: user.id,
    pendingIdentifier: identifier,
    verificationCode: code,
    verificationExpiresAt: expiresAt,
    metadata: {
      ...(conversation.metadata || {}),
      pendingUserId: user.id,
      pendingUserName: user.name,
      pendingUserEmail: user.email,
      phoneValidation: 'PENDING_CODE',
      phoneValidatedAt: new Date().toISOString(),
    },
  });

  await sendVerificationEmail(user, code);

  await sendMessageAndSave({
    conversation,
    text:
      '📧 Enviamos um código de confirmação para o e-mail cadastrado.\n\n' +
      'Digite o código recebido para continuar.',
  });

  await setCurrentStep(conversation, 'ASK_VERIFICATION_CODE', 'OPEN');
}

async function handleVerificationCodeStep(conversation, text) {
  const code = safeString(text).replace(/\D/g, '');

  if (!conversation.verificationCode || !conversation.verificationExpiresAt) {
    await sendMessageAndSave({
      conversation,
      text:
        'Sua validação expirou ou não foi iniciada.\n\n' +
        'Informe novamente seu e-mail cadastrado.',
    });

    await setCurrentStep(conversation, 'ASK_IDENTITY', 'OPEN');
    return;
  }

  if (new Date(conversation.verificationExpiresAt).getTime() < Date.now()) {
    await conversation.update({
      verificationCode: null,
      verificationExpiresAt: null,
    });

    await sendMessageAndSave({
      conversation,
      text:
        'O código expirou.\n\n' +
        'Informe novamente seu e-mail cadastrado para receber um novo código.',
    });

    await setCurrentStep(conversation, 'ASK_IDENTITY', 'OPEN');
    return;
  }

  if (code !== String(conversation.verificationCode)) {
    await sendMessageAndSave({
      conversation,
      text: 'Código inválido. Verifique o e-mail e tente novamente.',
    });

    await setCurrentStep(conversation, 'ASK_VERIFICATION_CODE', 'OPEN');
    return;
  }

  const user = await User.findByPk(conversation.linkedUserId, {
    attributes: ['id', 'name', 'email', 'phone', 'cargoDescritivo', 'avatarUrl'],
  });

  await conversation.update({
    verificationCode: null,
    verificationExpiresAt: null,
    pendingIdentifier: null,
    contactName: user?.name || conversation.contactName,
    metadata: {
      ...(conversation.metadata || {}),
      userId: user?.id || conversation.linkedUserId,
      userName: user?.name,
      userEmail: user?.email,
      userPhone: user?.phone,
      userCargo: user?.cargoDescritivo,
      avatarUrl: user?.avatarUrl,
      phoneValidation: 'LINKED_BY_CODE',
      linkedAt: new Date().toISOString(),
    },
  });

  await sendMessageAndSave({
    conversation,
    text: '✅ Validação concluída com sucesso.\n\nDigite o número da nota fiscal.',
  });

  await setCurrentStep(conversation, 'ASK_NOTE', 'WAITING_NOTE');
}

async function ensureConversationIsLinked(conversation, phone) {
  if (conversation.linkedUserId) return true;

  if (!isLidChat(conversation.providerChatId)) {
    const user = await findUserByWhatsappPhone(phone);

    if (user) {
      await conversation.update({
        linkedUserId: user.id,
        contactName: user.name || conversation.contactName,
        metadata: {
          ...(conversation.metadata || {}),
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          userPhone: user.phone,
          userCargo: user.cargoDescritivo,
          avatarUrl: user.avatarUrl,
          phoneValidation: 'REGISTERED_PHONE',
          linkedAt: new Date().toISOString(),
        },
      });

      conversation.linkedUserId = user.id;
      return true;
    }
  }

  return false;
}

async function runBotFlow({ conversation, text, phone }) {
  const step = getCurrentStep(conversation);
  const normalized = normalizeText(text);

  console.log('🤖 BOT FLOW STEP:', step);
  console.log('🤖 BOT FLOW TEXT:', text);

  if (step === 'ASK_IDENTITY') {
    await handleIdentityStep(conversation, text);
    return;
  }

  if (step === 'ASK_VERIFICATION_CODE') {
    await handleVerificationCodeStep(conversation, text);
    return;
  }

  const isLinked = await ensureConversationIsLinked(conversation, phone);

  if (!isLinked && isLidChat(conversation.providerChatId)) {
    await startIdentityFlow(conversation);
    return;
  }

  if (!isLinked) {
    await sendMessageAndSave({
      conversation,
      text:
        '⚠️ Número não cadastrado.\n\n' +
        'Não identificamos seu telefone na base de usuários.\n\n' +
        'Para utilizar o atendimento via WhatsApp, solicite o cadastro do seu número com a equipe responsável.',
    });

    await closeConversation(conversation);
    return;
  }

  if (step === 'INIT' || step === 'GREETING') {
    await sendMessageAndSave({
      conversation,
      text: 'Olá! Deseja rastrear um pedido? Responda Sim ou Não.',
    });

    await setCurrentStep(conversation, 'ASK_TRACKING', 'OPEN');
    return;
  }

  if (step === 'ASK_TRACKING') {
    if (isYes(normalized)) {
      await sendMessageAndSave({
        conversation,
        text: 'Perfeito. Digite o número da nota fiscal.',
      });

      await setCurrentStep(conversation, 'ASK_NOTE', 'WAITING_NOTE');
      return;
    }

    if (isNo(normalized)) {
      await sendMessageAndSave({
        conversation,
        text: 'Tudo bem. Quando precisar, é só me chamar novamente.',
      });

      await closeConversation(conversation);
      return;
    }

    await sendMessageAndSave({
      conversation,
      text: 'Não entendi. Responda apenas Sim ou Não.',
    });

    await setCurrentStep(conversation, 'ASK_TRACKING', 'OPEN');
    return;
  }

  if (step === 'ASK_NOTE') {
    const noteNumber = safeString(text).replace(/\D/g, '');

    if (!noteNumber) {
      await sendMessageAndSave({
        conversation,
        text: 'Por favor, envie apenas o número da nota fiscal.',
      });

      await setCurrentStep(conversation, 'ASK_NOTE', 'WAITING_NOTE');
      return;
    }

    const result = await findDeliveryByInvoice(noteNumber);

    if (!result) {
      await sendMessageAndSave({
        conversation,
        text: 'Não localizei essa nota no momento. Verifique o número enviado e tente novamente.',
      });

      await setCurrentStep(conversation, 'ASK_NOTE', 'WAITING_NOTE');
      return;
    }

    await conversation.update({
      lastNoteNumber: noteNumber,
      lastCte: result?.cte || null,
    });

    await sendMessageAndSave({
      conversation,
      text: formatBotDeliveryMessage(result),
    });

    await setCurrentStep(conversation, 'ASK_ANOTHER_NOTE', 'WAITING_CONFIRMATION');
    return;
  }

  if (step === 'ASK_ANOTHER_NOTE') {
    if (isYes(normalized)) {
      await sendMessageAndSave({
        conversation,
        text: 'Perfeito. Digite o número da próxima nota fiscal.',
      });

      await setCurrentStep(conversation, 'ASK_NOTE', 'WAITING_NOTE');
      return;
    }

    if (isNo(normalized)) {
      await sendMessageAndSave({
        conversation,
        text: 'Atendimento encerrado. Quando quiser, posso ajudar novamente.',
      });

      await closeConversation(conversation);
      return;
    }

    await sendMessageAndSave({
      conversation,
      text: 'Responda Sim para consultar outra nota ou Não para encerrar.',
    });

    await setCurrentStep(conversation, 'ASK_ANOTHER_NOTE', 'WAITING_CONFIRMATION');
    return;
  }

  await sendMessageAndSave({
    conversation,
    text: 'Olá! Deseja rastrear um pedido? Responda Sim ou Não.',
  });

  await setCurrentStep(conversation, 'ASK_TRACKING', 'OPEN');
}

async function webhook(req, res) {
  try {
    const parsed = extractIncomingMessage(req.body);

    console.log('📲 EVENT:', parsed.event);
    console.log('📲 FROM RAW:', parsed.from);
    console.log('📲 PHONE FINAL:', normalizePhone(parsed.from));
    console.log('📲 TEXT:', parsed.text);
    console.log('📲 MESSAGE ID:', parsed.messageId);
    console.log('📲 FROM ME:', parsed.fromMe);

    const text = safeString(parsed.text);
    const phone = normalizePhone(parsed.from);
    const interactionDate = new Date(parsed.timestamp * 1000);

    if (isGroupChat(parsed.from)) {
      return res.status(200).json({ ok: true, ignored: true, reason: 'group_message' });
    }

    if (isBroadcastChat(parsed.from)) {
      return res.status(200).json({ ok: true, ignored: true, reason: 'broadcast_message' });
    }

    if (!phone) {
      return res.status(200).json({ ok: true, ignored: true, reason: 'phone_not_found' });
    }

    if (parsed.fromMe) {
      return res.status(200).json({ ok: true, ignored: true, reason: 'from_me' });
    }

    if (!text) {
      return res.status(200).json({ ok: true, ignored: true, reason: 'empty_text' });
    }

    if (parsed.event && parsed.event !== 'message' && parsed.event !== 'message.any') {
      return res.status(200).json({
        ok: true,
        ignored: true,
        reason: 'unsupported_event',
        event: parsed.event,
      });
    }

    let conversation = await WhatsappConversation.findOne({
      where: { providerChatId: parsed.from },
    });

    if (!conversation) {
      conversation = await WhatsappConversation.findOne({
        where: { phone },
      });
    }

    if (!conversation) {
      conversation = await WhatsappConversation.create({
        phone,
        providerChatId: parsed.from,
        contactName: phone,
        status: 'OPEN',
        provider: 'waha',
        lastMessage: text,
        messagesCount: 0,
        lastUserMessageAt: interactionDate,
        lastInteractionAt: interactionDate,
        currentFlowCode: 'DEFAULT_TRACKING',
        currentStepCode: 'INIT',
        metadata: {
          phoneValidation: 'NOT_VALIDATED',
          phoneValidatedAt: new Date().toISOString(),
        },
      });
    } else {
      const nextStatus =
        conversation.status === 'CLOSED'
          ? 'OPEN'
          : conversation.status || 'OPEN';

      await conversation.update({
        providerChatId: parsed.from,
        lastMessage: text,
        status: nextStatus,
        lastUserMessageAt: interactionDate,
        lastInteractionAt: interactionDate,
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

    await runBotFlow({
      conversation,
      text,
      phone,
    });

    await conversation.reload();

    return res.status(200).json({
      ok: true,
      conversationId: conversation.id,
      duplicated: false,
      currentStepCode: conversation.currentStepCode,
      status: conversation.status,
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
    const rawText = safeString(req.body?.message || req.body?.text);
    const senderName = safeString(req.body?.senderName);

    const text = senderName ? `*${senderName}:*\n${rawText}` : rawText;

    if (!conversationId) {
      return res.status(400).json({ error: 'ID da conversa é obrigatório.' });
    }

    if (!rawText) {
      return res.status(400).json({ error: 'Mensagem obrigatória.' });
    }

    const conversation = await WhatsappConversation.findByPk(conversationId);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversa não encontrada.' });
    }

    if (isGroupChat(conversation.providerChatId)) {
      return res.status(400).json({ error: 'Envio para grupos não é permitido.' });
    }

    const result = await sendMessageAndSave({
      conversation,
      text,
      senderType: 'AGENT',
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