const { WhatsappConversation, WhatsappMessage } = require('../models');

function normalizePhone(value) {
  return String(value || '')
    .replace(/@c\.us$/i, '')
    .replace(/@s\.whatsapp\.net$/i, '')
    .replace(/\D/g, '');
}

function safeString(value) {
  return String(value || '').trim();
}

function extractIncomingMessage(body) {
  const event = body?.event || body?.type || '';

  const payload = body?.payload || body?.data || body || {};

  const from =
    payload?.from ||
    payload?.chatId ||
    payload?.author ||
    payload?.participant ||
    '';

  const text =
    payload?.body ||
    payload?.text ||
    payload?.message ||
    payload?.content ||
    payload?.caption ||
    '';

  const messageId =
    payload?.id ||
    payload?.messageId ||
    payload?.key?.id ||
    null;

  const fromMe =
    payload?.fromMe === true ||
    payload?.from_me === true ||
    payload?.key?.fromMe === true;

  return {
    event: safeString(event),
    from: safeString(from),
    text: safeString(text),
    messageId: messageId ? String(messageId) : null,
    fromMe,
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

async function webhook(req, res) {
  try {
    console.log('WHATSAPP WEBHOOK BODY:', JSON.stringify(req.body, null, 2));

    const parsed = extractIncomingMessage(req.body);

    const phone = normalizePhone(parsed.from);
    const text = safeString(parsed.text);

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
        lastInteractionAt: new Date(),
      });
    } else {
      await conversation.update({
        lastMessage: text,
        status: conversation.status || 'OPEN',
        lastInteractionAt: new Date(),
      });
    }

    let alreadyExists = null;

    if (parsed.messageId) {
      alreadyExists = await WhatsappMessage.findOne({
        where: {
          conversationId: conversation.id,
          messageId: parsed.messageId,
        },
      });
    }

    if (!alreadyExists) {
      await WhatsappMessage.create({
        conversationId: conversation.id,
        direction: 'in',
        messageId: parsed.messageId,
        content: text,
        rawPayload: parsed.raw,
      });
    }

    const totalMessages = await WhatsappMessage.count({
      where: { conversationId: conversation.id },
    });

    await conversation.update({
      messagesCount: totalMessages,
      lastMessage: text,
      lastInteractionAt: new Date(),
    });

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

module.exports = {
  list,
  detail,
  webhook,
};