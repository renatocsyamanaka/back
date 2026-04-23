const { WhatsappConversation, WhatsappMessage } = require('../models');

async function list(req, res) {
  try {
    const rows = await WhatsappConversation.findAll({
      order: [['updatedAt', 'DESC']],
    });

    return res.json(rows);
  } catch (error) {
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
      order: [[{ model: WhatsappMessage, as: 'messages' }, 'createdAt', 'ASC']],
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversa não encontrada' });
    }

    return res.json(conversation);
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Erro ao buscar conversa',
    });
  }
}

async function webhook(req, res) {
  console.log('WHATSAPP WEBHOOK BODY:', JSON.stringify(req.body, null, 2));
  return res.sendStatus(200);
}

module.exports = {
  list,
  detail,
  webhook,
};

module.exports = {
  list,
  detail,
  webhook,
};