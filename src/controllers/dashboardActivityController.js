const { DashboardActivity, User } = require('../models');

const RESPONSIBILITY_TYPES = ['DASHBOARD', 'PROGRAMACAO', 'BOOT', 'PLANILHA', 'OUTROS'];
const PERIODICIDADES = ['DIARIO', 'SEMANAL', 'MENSAL'];
const URGENCIAS = ['BAIXA', 'MEDIA', 'ALTA'];

function clean(value) {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  return str === '' ? null : str;
}

function normalizeUpper(value) {
  const cleaned = clean(value);
  return cleaned ? cleaned.toUpperCase() : null;
}

function isValidUrl(value) {
  try {
    new URL(String(value));
    return true;
  } catch {
    return false;
  }
}

function buildPayload(body = {}) {
  const tipoResponsabilidade = normalizeUpper(body.tipoResponsabilidade);
  const periodicidade = normalizeUpper(body.periodicidade) || 'DIARIO';
  const urgencia = normalizeUpper(body.urgencia) || 'MEDIA';

  return {
    workspace: clean(body.workspace),
    nome: clean(body.nome),
    tipoResponsabilidade,
    dashboardLink: tipoResponsabilidade === 'DASHBOARD' ? clean(body.dashboardLink) : null,
    periodicidade,
    diaAplicacao: clean(body.diaAplicacao),
    responsavelId: body.responsavelId || null,
    urgencia,
    solicitante: clean(body.solicitante),
    observacoes: clean(body.observacoes),
  };
}

function validatePayload(payload) {
  if (!payload.workspace) {
    return 'Workspace é obrigatório.';
  }

  if (!payload.nome) {
    return 'Nome é obrigatório.';
  }

  if (!payload.periodicidade) {
    return 'Periodicidade é obrigatória.';
  }

  if (!PERIODICIDADES.includes(payload.periodicidade)) {
    return 'Periodicidade inválida.';
  }

  if (payload.urgencia && !URGENCIAS.includes(payload.urgencia)) {
    return 'Urgência inválida.';
  }

  if (
    payload.tipoResponsabilidade &&
    !RESPONSIBILITY_TYPES.includes(payload.tipoResponsabilidade)
  ) {
    return 'Tipo de responsabilidade inválido.';
  }

  if (payload.tipoResponsabilidade === 'DASHBOARD') {
    if (!payload.dashboardLink) {
      return 'Link do dashboard é obrigatório quando o tipo de responsabilidade for Dashboard.';
    }

    if (!isValidUrl(payload.dashboardLink)) {
      return 'Link do dashboard inválido.';
    }
  }

  return null;
}

async function findByPkWithRelations(id, includeDeleted = false) {
  const model = includeDeleted
    ? DashboardActivity.scope('withDeleted')
    : DashboardActivity;

  return model.findByPk(id, {
    include: [
      {
        model: User,
        as: 'responsavel',
        attributes: ['id', 'name', 'email'],
        required: false,
      },
    ],
  });
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
      order: [
        ['workspace', 'ASC'],
        ['nome', 'ASC'],
      ],
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
    const item = await findByPkWithRelations(req.params.id);

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
    const validationError = validatePayload(payload);

    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const item = await DashboardActivity.create({
      ...payload,
      createdById: req.user?.id || null,
      updatedById: req.user?.id || null,
    });

    const created = await findByPkWithRelations(item.id);

    return res.status(201).json(created || item);
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
    const validationError = validatePayload(payload);

    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    await item.update({
      ...payload,
      updatedById: req.user?.id || null,
    });

    const updated = await findByPkWithRelations(item.id);

    return res.json(updated || item);
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

    const restored = await findByPkWithRelations(item.id, true);

    return res.json(restored || { message: 'Responsabilidade restaurada com sucesso.' });
  } catch (err) {
    console.error('[dashboardActivity.restore]', err);
    return res.status(500).json({
      error: 'Erro ao restaurar responsabilidade.',
      details: err.message,
    });
  }
};