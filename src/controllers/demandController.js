const { Op } = require('sequelize');
const {
  Demand,
  DemandHistory,
  User,
  sequelize,
} = require('../models');

const ALLOWED_STATUS = [
  'A_INICIAR',
  'EM_ANDAMENTO',
  'DISPONIVEL_TESTE',
  'EM_TESTE',
  'IMPEDIDO',
  'CONCLUIDO',
];

function clean(value) {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  return str === '' ? null : str;
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatComparableValue(value) {
  if (value instanceof Date) return value.toISOString();
  if (value === undefined || value === null) return null;
  return String(value);
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function normalizeStatus(status) {
  const raw = clean(status);
  if (!raw) return null;

  const normalized = normalizeText(raw).toUpperCase().replace(/\s+/g, '_');

  const map = {
    A_INICIAR: 'A_INICIAR',
    AINICIAR: 'A_INICIAR',
    EM_ANDAMENTO: 'EM_ANDAMENTO',
    EMANDAMENTO: 'EM_ANDAMENTO',
    DISPONIVEL_PARA_TESTE: 'DISPONIVEL_TESTE',
    DISPONIVEL_TESTE: 'DISPONIVEL_TESTE',
    DISPONIVELPARATESTE: 'DISPONIVEL_TESTE',
    EM_TESTE: 'EM_TESTE',
    EMTESTE: 'EM_TESTE',
    IMPEDIDO: 'IMPEDIDO',
    CONCLUIDO: 'CONCLUIDO',
  };

  return map[normalized] || normalized;
}

function validateStatusOrThrow(status) {
  if (!status) return;
  if (!ALLOWED_STATUS.includes(status)) {
    const error = new Error('Status inválido.');
    error.statusCode = 400;
    throw error;
  }
}

function getUserMeta(req) {
  return {
    performedByUserId: req.user?.id || null,
    performedByName:
      req.user?.name ||
      req.user?.fullName ||
      req.user?.nome ||
      req.user?.email ||
      'Sistema',
    performedByProfile:
      req.user?.role?.name ||
      req.user?.roleName ||
      req.user?.profile ||
      null,
  };
}

function buildPayload(body = {}) {
  const status = normalizeStatus(body.status);
  validateStatusOrThrow(status);

  return {
    tipo: clean(body.tipo),
    nome: clean(body.nome),
    plataforma: clean(body.plataforma),
    periodicidade: clean(body.periodicidade),
    diaAplicacao: clean(body.diaAplicacao),
    urgencia: clean(body.urgencia),
    solicitante: clean(body.solicitante),
    descricao: clean(body.descricao),
    observacoes: clean(body.observacoes),
    status,
    entregaPrevista: toDate(body.entregaPrevista),
    dataEntrega: toDate(body.dataEntrega),
    workspace: clean(body.workspace),
    origemExcelAba: clean(body.origemExcelAba),
    responsavelId: body.responsavelId || null,
  };
}

function buildUserInclude(alias) {
  return {
    model: User,
    as: alias,
    attributes: ['id', 'name', 'email'],
    required: false,
  };
}

async function registerHistory({
  transaction,
  demandId,
  actionType,
  changes = [],
  comments = null,
  req,
}) {
  const userMeta = getUserMeta(req);

  if (!changes.length) {
    await DemandHistory.create(
      {
        demandId,
        actionType,
        fieldName: null,
        oldValue: null,
        newValue: null,
        comments,
        ...userMeta,
      },
      { transaction }
    );
    return;
  }

  await DemandHistory.bulkCreate(
    changes.map((change) => ({
      demandId,
      actionType,
      fieldName: change.fieldName,
      oldValue: change.oldValue,
      newValue: change.newValue,
      comments,
      ...userMeta,
    })),
    { transaction }
  );
}

async function findDemandById(id) {
  return Demand.scope('withDeleted').findByPk(id, {
    include: [
      buildUserInclude('responsavel'),
      buildUserInclude('createdBy'),
      buildUserInclude('updatedBy'),
      buildUserInclude('deletedBy'),
    ],
  });
}

module.exports = {
  async list(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        tipo,
        status,
        urgencia,
        responsavelId,
        includeDeleted,
      } = req.query;

      const currentPage = Math.max(parseInt(page, 10) || 1, 1);
      const currentLimit = Math.max(parseInt(limit, 10) || 20, 1);
      const offset = (currentPage - 1) * currentLimit;

      const where = {};

      if (includeDeleted !== 'true') {
        where.deletedAt = null;
      }

      if (search) {
        const term = String(search).trim();
        where[Op.or] = [
          { nome: { [Op.like]: `%${term}%` } },
          { solicitante: { [Op.like]: `%${term}%` } },
          { plataforma: { [Op.like]: `%${term}%` } },
          { workspace: { [Op.like]: `%${term}%` } },
          { status: { [Op.like]: `%${term}%` } },
          { descricao: { [Op.like]: `%${term}%` } },
          { observacoes: { [Op.like]: `%${term}%` } },
        ];
      }

      if (tipo) where.tipo = clean(tipo);

      if (status) {
        const normalizedStatus = normalizeStatus(status);
        validateStatusOrThrow(normalizedStatus);
        where.status = normalizedStatus;
      }

      if (urgencia) where.urgencia = clean(urgencia);
      if (responsavelId) where.responsavelId = responsavelId;

      const scopeName = includeDeleted === 'true' ? 'withDeleted' : null;

      const { rows, count } = await (scopeName ? Demand.scope(scopeName) : Demand).findAndCountAll({
        where,
        include: [
          buildUserInclude('responsavel'),
          buildUserInclude('createdBy'),
          buildUserInclude('updatedBy'),
          buildUserInclude('deletedBy'),
        ],
        distinct: true,
        limit: currentLimit,
        offset,
        order: [
          ['deletedAt', 'ASC'],
          ['status', 'ASC'],
          ['entregaPrevista', 'ASC'],
          ['dataEntrega', 'DESC'],
          ['createdAt', 'DESC'],
        ],
      });

      return res.json({
        data: rows,
        meta: {
          total: count,
          page: currentPage,
          limit: currentLimit,
          totalPages: Math.ceil(count / currentLimit),
        },
      });
    } catch (error) {
      console.error('[demand.list]', error);
      return res.status(error.statusCode || 500).json({
        error: error.message || 'Erro ao listar demandas.',
      });
    }
  },

  async getById(req, res) {
    try {
      const item = await findDemandById(req.params.id);

      if (!item) {
        return res.status(404).json({ error: 'Demanda não encontrada.' });
      }

      return res.json(item);
    } catch (error) {
      console.error('[demand.getById]', error);
      return res.status(500).json({ error: 'Erro ao buscar demanda.' });
    }
  },

  async create(req, res) {
    const transaction = await sequelize.transaction();

    try {
      const payload = buildPayload(req.body);

      const item = await Demand.create(
        {
          ...payload,
          createdById: req.user?.id || null,
          updatedById: req.user?.id || null,
        },
        { transaction }
      );

      await registerHistory({
        transaction,
        demandId: item.id,
        actionType: 'CREATED',
        comments: req.body?.comments || null,
        req,
      });

      await transaction.commit();

      const created = await findDemandById(item.id);
      return res.status(201).json(created);
    } catch (error) {
      await transaction.rollback();
      console.error('[demand.create]', error);
      return res.status(error.statusCode || 500).json({
        error: error.message || 'Erro ao criar demanda.',
      });
    }
  },

  async update(req, res) {
    const transaction = await sequelize.transaction();

    try {
      const item = await Demand.scope('withDeleted').findByPk(req.params.id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!item) {
        await transaction.rollback();
        return res.status(404).json({ error: 'Demanda não encontrada.' });
      }

      const payload = buildPayload(req.body);
      const changes = [];

      Object.entries(payload).forEach(([fieldName, newValue]) => {
        const oldValue = item[fieldName];

        if (formatComparableValue(oldValue) !== formatComparableValue(newValue)) {
          changes.push({
            fieldName,
            oldValue: formatComparableValue(oldValue),
            newValue: formatComparableValue(newValue),
          });
        }
      });

      await item.update(
        {
          ...payload,
          updatedById: req.user?.id || null,
        },
        { transaction }
      );

      await registerHistory({
        transaction,
        demandId: item.id,
        actionType: 'UPDATED',
        changes,
        comments: req.body?.comments || null,
        req,
      });

      await transaction.commit();

      const updated = await findDemandById(item.id);
      return res.json(updated);
    } catch (error) {
      await transaction.rollback();
      console.error('[demand.update]', error);
      return res.status(error.statusCode || 500).json({
        error: error.message || 'Erro ao atualizar demanda.',
      });
    }
  },

  async remove(req, res) {
    const transaction = await sequelize.transaction();

    try {
      const item = await Demand.scope('withDeleted').findByPk(req.params.id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!item) {
        await transaction.rollback();
        return res.status(404).json({ error: 'Demanda não encontrada.' });
      }

      if (item.deletedAt) {
        await transaction.rollback();
        return res.status(400).json({ error: 'Demanda já excluída.' });
      }

      await item.update(
        {
          deletedAt: new Date(),
          deletedById: req.user?.id || null,
          updatedById: req.user?.id || null,
        },
        { transaction }
      );

      await registerHistory({
        transaction,
        demandId: item.id,
        actionType: 'DELETED',
        comments: req.body?.comments || null,
        req,
      });

      await transaction.commit();

      return res.json({ message: 'Demanda excluída com sucesso.' });
    } catch (error) {
      await transaction.rollback();
      console.error('[demand.remove]', error);
      return res.status(error.statusCode || 500).json({
        error: error.message || 'Erro ao excluir demanda.',
      });
    }
  },

  async restore(req, res) {
    const transaction = await sequelize.transaction();

    try {
      const item = await Demand.scope('withDeleted').findByPk(req.params.id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!item) {
        await transaction.rollback();
        return res.status(404).json({ error: 'Demanda não encontrada.' });
      }

      await item.update(
        {
          deletedAt: null,
          deletedById: null,
          updatedById: req.user?.id || null,
        },
        { transaction }
      );

      await registerHistory({
        transaction,
        demandId: item.id,
        actionType: 'RESTORED',
        comments: req.body?.comments || null,
        req,
      });

      await transaction.commit();

      const restored = await findDemandById(item.id);
      return res.json(restored);
    } catch (error) {
      await transaction.rollback();
      console.error('[demand.restore]', error);
      return res.status(error.statusCode || 500).json({
        error: error.message || 'Erro ao restaurar demanda.',
      });
    }
  },

  async history(req, res) {
    try {
      const rows = await DemandHistory.findAll({
        where: { demandId: req.params.id },
        include: [buildUserInclude('performedByUser')],
        order: [['createdAt', 'DESC']],
      });

      return res.json(rows);
    } catch (error) {
      console.error('[demand.history]', error);
      return res.status(500).json({ error: 'Erro ao buscar histórico.' });
    }
  },

  async summary(req, res) {
    try {
      const baseWhere = { deletedAt: null };

      const [
        total,
        programacao,
        concluidas,
        rotina,
        dashboards,
        aIniciar,
        emAndamento,
        disponivelTeste,
        emTeste,
        impedido,
        concluido,
      ] = await Promise.all([
        Demand.count({ where: baseWhere }),
        Demand.count({ where: { ...baseWhere, tipo: 'PROGRAMACAO' } }),
        Demand.count({ where: { ...baseWhere, tipo: 'CONCLUIDA' } }),
        Demand.count({ where: { ...baseWhere, tipo: 'ROTINA' } }),
        Demand.count({ where: { ...baseWhere, tipo: 'DASHBOARD' } }),
        Demand.count({ where: { ...baseWhere, status: 'A_INICIAR' } }),
        Demand.count({ where: { ...baseWhere, status: 'EM_ANDAMENTO' } }),
        Demand.count({ where: { ...baseWhere, status: 'DISPONIVEL_TESTE' } }),
        Demand.count({ where: { ...baseWhere, status: 'EM_TESTE' } }),
        Demand.count({ where: { ...baseWhere, status: 'IMPEDIDO' } }),
        Demand.count({ where: { ...baseWhere, status: 'CONCLUIDO' } }),
      ]);

      return res.json({
        total,
        programacao,
        concluidas,
        rotina,
        dashboards,
        status: {
          aIniciar,
          emAndamento,
          disponivelTeste,
          emTeste,
          impedido,
          concluido,
        },
      });
    } catch (error) {
      console.error('[demand.summary]', error);
      return res.status(500).json({ error: 'Erro ao gerar resumo.' });
    }
  },
};