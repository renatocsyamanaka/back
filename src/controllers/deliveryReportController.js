const { Op } = require('sequelize');
const {
  DeliveryReport,
  DeliveryReportHistory,
  User,
  sequelize,
} = require('../models');

function clean(value) {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  return str === '' ? null : str;
}

function toDecimal(value) {
  if (value === undefined || value === null || value === '') return null;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  let normalized = String(value).trim();
  if (!normalized) return null;

  normalized = normalized.replace(/\s+/g, '').replace(/R\$/gi, '');

  if (normalized.includes('.') && normalized.includes(',')) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if (normalized.includes(',')) {
    normalized = normalized.replace(',', '.');
  }

  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}

function toInteger(value) {
  if (value === undefined || value === null || value === '') return null;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? parseInt(value, 10) : null;
  }

  const parsed = Number(String(value).replace(/[^\d-]/g, ''));
  return Number.isNaN(parsed) ? null : parseInt(parsed, 10);
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
  return {
    cte: clean(body.cte),
    tipo: clean(body.tipo),
    emissao: toDate(body.emissao),

    cidadeOrigem: clean(body.cidadeOrigem),
    ufOrigem: clean(body.ufOrigem),
    remetente: clean(body.remetente),

    cidadeDestino: clean(body.cidadeDestino),
    ufDestino: clean(body.ufDestino),
    destinatario: clean(body.destinatario),

    notaFiscal: clean(body.notaFiscal),
    nfValor: toDecimal(body.nfValor),

    pesoReal: toDecimal(body.pesoReal),
    pesoCubado: toDecimal(body.pesoCubado),
    pesoTaxado: toDecimal(body.pesoTaxado),

    volume: toDecimal(body.volume),
    frete: toDecimal(body.frete),

    icmsPercent: toDecimal(body.icmsPercent),
    icmsValor: toDecimal(body.icmsValor),

    status: clean(body.status),
    previsaoEntrega: toDate(body.previsaoEntrega),
    dataEntrega: toDate(body.dataEntrega),

    modal: clean(body.modal),
    statusEntrega: clean(body.statusEntrega),

    operacao: clean(body.operacao),
    operacaoResumo: clean(body.operacaoResumo),

    cteNovo: clean(body.cteNovo),
    emissaoData: toDate(body.emissaoData),

    transportadora: clean(body.transportadora),
    encomenda: clean(body.encomenda),
    reentregaDevolucao: clean(body.reentregaDevolucao),

    ultimaAtualizacao: toDate(body.ultimaAtualizacao),
    indice: toInteger(body.indice),
    regiao: clean(body.regiao),
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
  deliveryReportId,
  actionType,
  changes = [],
  comments = null,
  req,
}) {
  const userMeta = getUserMeta(req);

  if (!changes.length) {
    await DeliveryReportHistory.create(
      {
        deliveryReportId,
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

  await DeliveryReportHistory.bulkCreate(
    changes.map((change) => ({
      deliveryReportId,
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

async function findDeliveryReportById(id) {
  return DeliveryReport.unscoped().findByPk(id, {
    include: [
      buildUserInclude('createdBy'),
      buildUserInclude('updatedBy'),
      buildUserInclude('deletedBy'),
    ],
  });
}

async function findExistingDeliveryReport({ cte, notaFiscal, excludeId = null, transaction }) {
  const or = [];

  if (cte) {
    or.push({ cte: String(cte).trim() });
  }

  if (notaFiscal) {
    or.push({ notaFiscal: String(notaFiscal).trim() });
  }

  if (!or.length) return null;

  const where = {
    [Op.or]: or,
  };

  if (excludeId) {
    where.id = { [Op.ne]: excludeId };
  }

  return DeliveryReport.unscoped().findOne({
    where,
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
  });
}

function parseYearsParam(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return [
      ...new Set(
        value
          .flatMap((item) => String(item).split(','))
          .map((item) => Number(String(item).trim()))
          .filter((n) => Number.isInteger(n) && n >= 2000 && n <= 2100)
      ),
    ];
  }

  return [
    ...new Set(
      String(value)
        .split(',')
        .map((item) => Number(item.trim()))
        .filter((n) => Number.isInteger(n) && n >= 2000 && n <= 2100)
    ),
  ];
}

function buildYearRanges(years = []) {
  return years.map((year) => ({
    [Op.gte]: new Date(year, 0, 1, 0, 0, 0, 0),
    [Op.lte]: new Date(year, 11, 31, 23, 59, 59, 999),
  }));
}

function normalizeStatusText(value) {
  return String(value || '').trim().toUpperCase();
}
function startOfDaySafe(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function resolveStatusEntrega(payload = {}) {
  const statusManual = normalizeStatusText(payload.statusEntrega);
  const previsao = startOfDaySafe(payload.previsaoEntrega);
  const entrega = startOfDaySafe(payload.dataEntrega);
  const hoje = startOfDaySafe(new Date());

  if (statusManual.includes('CANCEL')) return 'CANCELADA';
  if (statusManual.includes('DEVOL')) return 'DEVOLVIDA';
  if (statusManual.includes('TRANS')) return 'EM TRANSITO';
  if (statusManual.includes('ROTA')) return 'EM ROTA';
  if (statusManual.includes('PEND')) return 'PENDENTE';

  if (previsao && entrega) {
    return entrega.getTime() > previsao.getTime() ? 'FORA DO PRAZO' : 'NO PRAZO';
  }

  if (previsao && !entrega) {
    return hoje.getTime() > previsao.getTime() ? 'FORA DO PRAZO' : 'NO PRAZO';
  }

  if (statusManual.includes('NO PRAZO')) return 'NO PRAZO';
  if (statusManual.includes('FORA DO PRAZO')) return 'FORA DO PRAZO';
  if (statusManual.includes('ATRAS')) return 'FORA DO PRAZO';
  if (statusManual.includes('ENTREG')) return 'ENTREGUE';

  return statusManual || 'PENDENTE';
}

function applyComputedStatusEntrega(payload = {}) {
  return {
    ...payload,
    statusEntrega: resolveStatusEntrega(payload),
  };
}

function buildStatusEntregaCondition(statusEntrega) {
  const normalized = normalizeStatusText(statusEntrega);
  if (!normalized) return null;

  if (normalized.includes('FORA DO PRAZO') || normalized.includes('ATRAS')) {
    return {
      [Op.or]: [
        { [Op.like]: '%FORA DO PRAZO%' },
        { [Op.like]: '%ATRAS%' },
      ],
    };
  }

  if (normalized.includes('NO PRAZO')) {
    return { [Op.like]: '%NO PRAZO%' };
  }

  if (normalized.includes('CANCEL')) {
    return { [Op.like]: '%CANCEL%' };
  }

  if (normalized.includes('ENTREG')) {
    return { [Op.like]: '%ENTREG%' };
  }

  if (normalized.includes('DEVOL')) {
    return { [Op.like]: '%DEVOL%' };
  }

  if (normalized.includes('TRANS')) {
    return { [Op.like]: '%TRANS%' };
  }

  if (normalized.includes('ROTA')) {
    return { [Op.like]: '%ROTA%' };
  }

  if (normalized.includes('PEND')) {
    return { [Op.like]: '%PEND%' };
  }

  return { [Op.like]: `%${normalized}%` };
}

exports.create = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const payload = applyComputedStatusEntrega(buildPayload(req.body));

    if (!payload.cte) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Informe o CTE.' });
    }

    const existing = await findExistingDeliveryReport({
      cte: payload.cte,
      notaFiscal: payload.notaFiscal,
      transaction,
    });

    if (existing?.deletedAt) {
      await transaction.rollback();
      return res.status(409).json({
        message: `O CTE ${payload.cte || existing.cte} está excluído. Restaure o registro antes de cadastrar novamente.`,
        code: 'DELIVERY_REPORT_DELETED',
        existingId: existing.id,
        cte: existing.cte,
      });
    }

    if (existing) {
      await transaction.rollback();
      return res.status(409).json({
        message: `Já existe um registro para o CTE ${existing.cte || payload.cte}.`,
        code: 'DELIVERY_REPORT_ALREADY_EXISTS',
        existingId: existing.id,
        cte: existing.cte,
      });
    }

    const created = await DeliveryReport.create(
      {
        ...payload,
        createdById: req.user?.id || null,
        updatedById: req.user?.id || null,
      },
      { transaction }
    );

    await registerHistory({
      transaction,
      deliveryReportId: created.id,
      actionType: 'CREATED',
      comments: req.body?.comments || 'CTE cadastrado.',
      req,
    });

    await transaction.commit();

    const full = await findDeliveryReportById(created.id);
    return res.status(201).json(full || created);
  } catch (error) {
    await transaction.rollback();
    console.error('[deliveryReport.create]', error);
    return res.status(500).json({
      message: error?.message || 'Erro ao cadastrar CTE.',
    });
  }
};

exports.list = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      cte,
      notaFiscal,
      transportadora,
      statusEntrega,
      includeCancelled = 'true',
      cancelledMode = 'all',
      operacao,
      regiao,
      ufDestino,
      cidadeDestino,
      startDate,
      endDate,
      deletedFilter = 'active',
      yearMode = 'all',
      years,
    } = req.query;

    const where = {};
    const andConditions = [];
    const DeliveryReportQuery = DeliveryReport.unscoped();

    if (deletedFilter === 'active') {
      where.deletedAt = null;
    } else if (deletedFilter === 'only') {
      where.deletedAt = { [Op.not]: null };
    }

    if (search) {
      const searchValue = String(search).trim();
      andConditions.push({
        [Op.or]: [
          { cte: { [Op.like]: `%${searchValue}%` } },
          { notaFiscal: { [Op.like]: `%${searchValue}%` } },
          { destinatario: { [Op.like]: `%${searchValue}%` } },
          { remetente: { [Op.like]: `%${searchValue}%` } },
          { transportadora: { [Op.like]: `%${searchValue}%` } },
          { cidadeDestino: { [Op.like]: `%${searchValue}%` } },
          { cidadeOrigem: { [Op.like]: `%${searchValue}%` } },
          { statusEntrega: { [Op.like]: `%${searchValue}%` } },
        ],
      });
    }

    if (cte) where.cte = { [Op.like]: `%${String(cte).trim()}%` };
    if (notaFiscal) where.notaFiscal = { [Op.like]: `%${String(notaFiscal).trim()}%` };

    if (transportadora) {
      where.transportadora = { [Op.like]: `%${String(transportadora).trim()}%` };
    }

    const normalizedCancelledMode = String(cancelledMode || 'all').trim().toLowerCase();
    const shouldIncludeCancelled = String(includeCancelled) !== 'false';
    const statusCondition = buildStatusEntregaCondition(statusEntrega);

    if (statusCondition) {
      where.statusEntrega = statusCondition;
    } else {
      if (normalizedCancelledMode === 'only') {
        where.statusEntrega = { [Op.like]: '%CANCEL%' };
      } else if (normalizedCancelledMode === 'hide' || !shouldIncludeCancelled) {
        andConditions.push({
          [Op.or]: [
            { statusEntrega: null },
            { statusEntrega: '' },
            {
              statusEntrega: {
                [Op.notLike]: '%CANCEL%',
              },
            },
          ],
        });
      }
    }

    if (operacao) where.operacao = String(operacao).trim();
    if (regiao) where.regiao = String(regiao).trim();
    if (ufDestino) where.ufDestino = String(ufDestino).trim().toUpperCase();

    if (cidadeDestino) {
      where.cidadeDestino = { [Op.like]: `%${String(cidadeDestino).trim()}%` };
    }

    const hasStartDate = !!startDate;
    const hasEndDate = !!endDate;

    if (hasStartDate || hasEndDate) {
      const dateFilter = {};
      if (hasStartDate) dateFilter[Op.gte] = new Date(startDate);
      if (hasEndDate) dateFilter[Op.lte] = new Date(endDate);

      andConditions.push({
        [Op.or]: [{ emissaoData: dateFilter }, { emissao: dateFilter }],
      });
    } else if (yearMode === 'selected') {
      const parsedYears = parseYearsParam(years);

      if (parsedYears.length) {
        const yearRanges = buildYearRanges(parsedYears);

        andConditions.push({
          [Op.or]: yearRanges.flatMap((range) => [
            { emissaoData: range },
            { emissao: range },
          ]),
        });
      }
    }

    if (andConditions.length) {
      where[Op.and] = andConditions;
    }

    const pageNum = Number(page) > 0 ? Number(page) : 1;
    const limitNum = Number(limit) > 0 ? Number(limit) : 20;
    const offset = (pageNum - 1) * limitNum;

    const result = await DeliveryReportQuery.findAndCountAll({
      where,
      include: [
        buildUserInclude('createdBy'),
        buildUserInclude('updatedBy'),
        buildUserInclude('deletedBy'),
      ],
      order: [
        ['deletedAt', 'DESC'],
        ['emissaoData', 'DESC'],
        ['emissao', 'DESC'],
        ['id', 'DESC'],
      ],
      limit: limitNum,
      offset,
      distinct: true,
    });

    return res.json({
      total: result.count,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(result.count / limitNum),
      rows: result.rows,
      appliedFilters: {
        yearMode,
        years: yearMode === 'selected' ? parseYearsParam(years) : [],
        startDate: startDate || null,
        endDate: endDate || null,
        deletedFilter,
        includeCancelled: shouldIncludeCancelled,
        cancelledMode: normalizedCancelledMode,
        statusEntrega: statusEntrega || null,
      },
    });
  } catch (error) {
    console.error('[deliveryReport.list]', error);
    return res.status(500).json({
      message: error?.message || 'Erro ao listar CTEs.',
    });
  }
};

exports.getById = async (req, res) => {
  try {
    const item = await DeliveryReport.unscoped().findOne({
      where: { id: req.params.id },
      include: [
        buildUserInclude('createdBy'),
        buildUserInclude('updatedBy'),
        buildUserInclude('deletedBy'),
        {
          model: DeliveryReportHistory,
          as: 'history',
          required: false,
          include: [
            {
              model: User,
              as: 'performedByUser',
              attributes: ['id', 'name', 'email'],
              required: false,
            },
          ],
        },
      ],
      order: [[{ model: DeliveryReportHistory, as: 'history' }, 'createdAt', 'DESC']],
    });

    if (!item) {
      return res.status(404).json({ message: 'CTE não encontrado.' });
    }

    return res.json(item);
  } catch (error) {
    console.error('[deliveryReport.getById]', error);
    return res.status(500).json({
      message: error?.message || 'Erro ao buscar CTE.',
    });
  }
};

exports.update = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const item = await DeliveryReport.unscoped().findOne({
      where: { id: req.params.id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!item) {
      await transaction.rollback();
      return res.status(404).json({ message: 'CTE não encontrado.' });
    }

    if (item.deletedAt) {
      await transaction.rollback();
      return res.status(400).json({
        message: 'Este CTE está excluído. Restaure antes de editar.',
        code: 'DELIVERY_REPORT_DELETED',
      });
    }

    const payload = applyComputedStatusEntrega(buildPayload(req.body));

    const duplicate = await findExistingDeliveryReport({
      cte: payload.cte,
      notaFiscal: payload.notaFiscal,
      excludeId: item.id,
      transaction,
    });

    if (duplicate?.deletedAt) {
      await transaction.rollback();
      return res.status(409).json({
        message: `Já existe um registro excluído para o CTE ${duplicate.cte || payload.cte}. Restaure o registro em vez de reutilizar este identificador.`,
        code: 'DELIVERY_REPORT_CONFLICTS_WITH_DELETED',
        existingId: duplicate.id,
        cte: duplicate.cte,
      });
    }

    if (duplicate) {
      await transaction.rollback();
      return res.status(409).json({
        message: `Já existe outro registro ativo para o CTE ${duplicate.cte || payload.cte}.`,
        code: 'DELIVERY_REPORT_ALREADY_EXISTS',
        existingId: duplicate.id,
        cte: duplicate.cte,
      });
    }

    const changes = [];

    Object.keys(payload).forEach((key) => {
      if (!(key in req.body)) return;

      const oldValue = formatComparableValue(item.get(key));
      const newValue = formatComparableValue(payload[key]);

      if (oldValue !== newValue) {
        changes.push({
          fieldName: key,
          oldValue,
          newValue,
        });
      }
    });

    if (!changes.length) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Nenhuma alteração identificada.' });
    }

    await item.update(
      {
        ...payload,
        updatedById: req.user?.id || null,
      },
      { transaction }
    );

    await registerHistory({
      transaction,
      deliveryReportId: item.id,
      actionType: 'UPDATED',
      changes,
      comments: req.body?.comments || 'CTE atualizado.',
      req,
    });

    await transaction.commit();

    const full = await findDeliveryReportById(item.id);
    return res.json(full || item);
  } catch (error) {
    await transaction.rollback();
    console.error('[deliveryReport.update]', error);
    return res.status(500).json({
      message: error?.message || 'Erro ao atualizar CTE.',
    });
  }
};

exports.remove = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const item = await DeliveryReport.unscoped().findOne({
      where: { id: req.params.id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!item) {
      await transaction.rollback();
      return res.status(404).json({ message: 'CTE não encontrado.' });
    }

    if (item.deletedAt) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Este CTE já está excluído.' });
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
      deliveryReportId: item.id,
      actionType: 'DELETED',
      comments: req.body?.comments || 'CTE excluído logicamente.',
      req,
    });

    await transaction.commit();

    return res.json({ message: 'CTE excluído com sucesso.' });
  } catch (error) {
    await transaction.rollback();
    console.error('[deliveryReport.remove]', error);
    return res.status(500).json({
      message: error?.message || 'Erro ao excluir CTE.',
    });
  }
};

exports.restore = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const item = await DeliveryReport.unscoped().findOne({
      where: { id: req.params.id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!item) {
      await transaction.rollback();
      return res.status(404).json({ message: 'CTE não encontrado.' });
    }

    if (!item.deletedAt) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Este CTE não está excluído.' });
    }

    const duplicateActive = await DeliveryReport.unscoped().findOne({
      where: {
        id: { [Op.ne]: item.id },
        deletedAt: null,
        [Op.or]: [
          item.cte ? { cte: item.cte } : null,
          item.notaFiscal ? { notaFiscal: item.notaFiscal } : null,
        ].filter(Boolean),
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (duplicateActive) {
      await transaction.rollback();
      return res.status(409).json({
        message: `Não foi possível restaurar. Já existe um registro ativo com o CTE ${duplicateActive.cte || item.cte}.`,
        code: 'DELIVERY_REPORT_ACTIVE_DUPLICATE',
        existingId: duplicateActive.id,
      });
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
      deliveryReportId: item.id,
      actionType: 'RESTORED',
      comments: req.body?.comments || 'CTE restaurado.',
      req,
    });

    await transaction.commit();

    const full = await findDeliveryReportById(item.id);
    return res.json(full || { message: 'CTE restaurado com sucesso.' });
  } catch (error) {
    await transaction.rollback();
    console.error('[deliveryReport.restore]', error);
    return res.status(500).json({
      message: error?.message || 'Erro ao restaurar CTE.',
    });
  }
};

exports.history = async (req, res) => {
  try {
    const exists = await DeliveryReport.unscoped().findByPk(req.params.id, {
      attributes: ['id'],
    });

    if (!exists) {
      return res.status(404).json({ message: 'CTE não encontrado.' });
    }

    const rows = await DeliveryReportHistory.findAll({
      where: { deliveryReportId: req.params.id },
      include: [
        {
          model: User,
          as: 'performedByUser',
          attributes: ['id', 'name', 'email'],
          required: false,
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    return res.json(rows);
  } catch (error) {
    console.error('[deliveryReport.history]', error);
    return res.status(500).json({
      message: error?.message || 'Erro ao buscar histórico do CTE.',
    });
  }
};