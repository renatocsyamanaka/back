const { DashboardActivity, User } = require('../models');

function clean(value) {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  return str === '' ? null : str;
}

function buildPayload(body = {}) {
  return {
    workspace: clean(body.workspace),
    nome: clean(body.nome),
    periodicidade: clean(body.periodicidade)?.toUpperCase() || 'DIARIO',
    diaAplicacao: clean(body.diaAplicacao),
    responsavelId: body.responsavelId || null,
    urgencia: clean(body.urgencia)?.toUpperCase() || 'MEDIA',
    solicitante: clean(body.solicitante),
    observacoes: clean(body.observacoes),
  };
}

exports.list = async (req, res) => {
  try {
    const items = await DashboardActivity.findAll({
      include: [
        {
          model: User,
          as: 'responsavel',
          attributes: ['id', 'name', 'email'],
          required: false,
        },
      ],
      order: [['workspace', 'ASC'], ['nome', 'ASC']],
    });

    return res.json(items);
  } catch (err) {
    console.error('[dashboardActivity.list]', err);
    return res.status(500).json({
      error: 'Erro ao listar responsabilidades.',
      details: err.message,
    });
  }
};

exports.getById = async (req, res) => {
  try {
    const item = await DashboardActivity.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'responsavel',
          attributes: ['id', 'name', 'email'],
          required: false,
        },
      ],
    });

    if (!item) {
      return res.status(404).json({ error: 'Responsabilidade não encontrada.' });
    }

    return res.json(item);
  } catch (err) {
    console.error('[dashboardActivity.getById]', err);
    return res.status(500).json({
      error: 'Erro ao buscar responsabilidade.',
      details: err.message,
    });
  }
};

exports.create = async (req, res) => {
  try {
    const payload = buildPayload(req.body);

    const item = await DashboardActivity.create({
      ...payload,
      createdById: req.user?.id || null,
      updatedById: req.user?.id || null,
    });

    return res.status(201).json(item);
  } catch (err) {
    console.error('[dashboardActivity.create]', err);
    return res.status(500).json({
      error: 'Erro ao criar responsabilidade.',
      details: err.message,
    });
  }
};

exports.update = async (req, res) => {
  try {
    const item = await DashboardActivity.findByPk(req.params.id);

    if (!item) {
      return res.status(404).json({ error: 'Responsabilidade não encontrada.' });
    }

    const payload = buildPayload(req.body);

    await item.update({
      ...payload,
      updatedById: req.user?.id || null,
    });

    return res.json(item);
  } catch (err) {
    console.error('[dashboardActivity.update]', err);
    return res.status(500).json({
      error: 'Erro ao atualizar responsabilidade.',
      details: err.message,
    });
  }
};

exports.remove = async (req, res) => {
  try {
    const item = await DashboardActivity.findByPk(req.params.id);

    if (!item) {
      return res.status(404).json({ error: 'Responsabilidade não encontrada.' });
    }

    await item.update({
      deletedAt: new Date(),
      deletedById: req.user?.id || null,
      updatedById: req.user?.id || null,
    });

    return res.json({ message: 'Responsabilidade excluída com sucesso.' });
  } catch (err) {
    console.error('[dashboardActivity.remove]', err);
    return res.status(500).json({
      error: 'Erro ao excluir responsabilidade.',
      details: err.message,
    });
  }
};

exports.restore = async (req, res) => {
  try {
    const item = await DashboardActivity.scope('withDeleted').findByPk(req.params.id);

    if (!item) {
      return res.status(404).json({ error: 'Responsabilidade não encontrada.' });
    }

    await item.update({
      deletedAt: null,
      deletedById: null,
      updatedById: req.user?.id || null,
    });

    return res.json({ message: 'Responsabilidade restaurada com sucesso.' });
  } catch (err) {
    console.error('[dashboardActivity.restore]', err);
    return res.status(500).json({
      error: 'Erro ao restaurar responsabilidade.',
      details: err.message,
    });
  }
};