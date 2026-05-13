const crypto = require('crypto');
const { Op } = require('sequelize');
const XLSX = require('xlsx');

const sequelize = require('../db');

const {
  AutoInventoryCycle,
  AutoInventoryItem,
  AutoInventoryResponse,
  AutoInventoryResponseItem,
  AutoInventoryConfig,
  User,
} = require('../models');

const autoInventoryMailService = require('../services/autoInventoryMailService');

const generateToken = () => crypto.randomBytes(32).toString('hex');

const getFrontendUrl = () =>
  process.env.API_URL || 'http://localhost:5173';

const getPublicLink = (token) =>
  `${getFrontendUrl()}/auto-inventario/${token}`;

const getCycleName = (month, year) => {
  const date = new Date(year, month - 1, 1);

  return date.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
};

async function getOrCreateConfig() {
  let config = await AutoInventoryConfig.findOne();

  if (!config) {
    config = await AutoInventoryConfig.create({
      sendDay: 20,
      emailCc: '',
      enabled: true,
    });
  }

  return config;
}

const detectResponseStatus = async (responseId, finalizar = false) => {
  const responseItems = await AutoInventoryResponseItem.findAll({
    where: { responseId },
  });

  const total = responseItems.length;

  const preenchidos = responseItems.filter(
    (item) =>
      item.quantidade !== null &&
      item.quantidade !== undefined
  ).length;

  if (preenchidos === 0) {
    return 'PENDENTE';
  }

  if (preenchidos < total) {
    return 'PARCIAL';
  }

  return finalizar ? 'COMPLETO' : 'PARCIAL';
};
// ================= CONFIGURAÇÃO =================

exports.getConfig = async (_req, res) => {
  try {
    const config = await getOrCreateConfig();
    return res.json(config);
  } catch (error) {
    console.error('Erro ao buscar configuração:', error);
    return res.status(500).json({
      error: 'Erro ao buscar configuração do auto inventário.',
    });
  }
};

exports.updateConfig = async (req, res) => {
  try {
    const { sendDay, emailCc, enabled } = req.body;

    const config = await getOrCreateConfig();

    if (sendDay !== undefined) {
      const day = Number(sendDay);

      if (Number.isNaN(day) || day < 1 || day > 31) {
        return res.status(400).json({
          error: 'O dia de envio deve estar entre 1 e 31.',
        });
      }

      config.sendDay = day;
    }

    if (emailCc !== undefined) {
      config.emailCc = emailCc || '';
    }

    if (enabled !== undefined) {
      config.enabled = !!enabled;
    }

    await config.save();

    return res.json({
      message: 'Configuração atualizada com sucesso.',
      config,
    });
  } catch (error) {
    console.error('Erro ao atualizar configuração:', error);
    return res.status(500).json({
      error: 'Erro ao atualizar configuração do auto inventário.',
    });
  }
};

// ================= PEÇAS =================

exports.createItem = async (req, res) => {
  try {
    const { codigo, nome } = req.body;

    if (!codigo || !nome) {
      return res.status(400).json({
        error: 'Código e nome são obrigatórios.',
      });
    }

    const exists = await AutoInventoryItem.findOne({
      where: { codigo },
    });

    if (exists) {
      return res.status(400).json({
        error: 'Já existe uma peça com este código.',
      });
    }

    const item = await AutoInventoryItem.create({
      codigo,
      nome,
      ativo: true,
    });

    return res.status(201).json({
      message: 'Peça cadastrada com sucesso.',
      item,
    });
  } catch (error) {
    console.error('Erro ao cadastrar peça:', error);
    return res.status(500).json({
      error: 'Erro ao cadastrar peça.',
    });
  }
};

exports.listItems = async (_req, res) => {
  try {
    const items = await AutoInventoryItem.findAll({
      order: [['nome', 'ASC']],
    });

    return res.json(items);
  } catch (error) {
    console.error('Erro ao listar peças:', error);
    return res.status(500).json({
      error: 'Erro ao listar peças.',
    });
  }
};

exports.updateItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { codigo, nome, ativo } = req.body;

    const item = await AutoInventoryItem.findByPk(id);

    if (!item) {
      return res.status(404).json({
        error: 'Peça não encontrada.',
      });
    }

    if (codigo !== undefined) item.codigo = codigo;
    if (nome !== undefined) item.nome = nome;
    if (ativo !== undefined) item.ativo = ativo;

    await item.save();

    return res.json({
      message: 'Peça atualizada com sucesso.',
      item,
    });
  } catch (error) {
    console.error('Erro ao atualizar peça:', error);
    return res.status(500).json({
      error: 'Erro ao atualizar peça.',
    });
  }
};

// ================= CICLOS =================

exports.createCycle = async (req, res) => {
  try {
    const { month, year } = req.body;

    if (!month || !year) {
      return res.status(400).json({
        error: 'Mês e ano são obrigatórios.',
      });
    }

    const existing = await AutoInventoryCycle.findOne({
      where: {
        month: Number(month),
        year: Number(year),
      },
    });

    if (existing) {
      return res.status(400).json({
        error: 'Já existe um ciclo de auto inventário para este mês.',
      });
    }

    const cycle = await AutoInventoryCycle.create({
      month: Number(month),
      year: Number(year),
      status: 'ABERTO',
    });

    const providers = await User.findAll({
      where: {
        isActive: true,
        autoInventoryEnabled: true,
        email: {
          [Op.ne]: null,
        },
      },
    });

    const items = await AutoInventoryItem.findAll({
      where: { ativo: true },
    });

    for (const provider of providers) {
      const response = await AutoInventoryResponse.create({
        cycleId: cycle.id,
        providerId: provider.id,
        token: generateToken(),
        status: 'PENDENTE',
      });

      const responseItems = items.map((item) => ({
        responseId: response.id,
        itemId: item.id,
        quantidade: null,
      }));

      if (responseItems.length) {
        await AutoInventoryResponseItem.bulkCreate(responseItems);
      }
    }

    return res.status(201).json({
      message: 'Ciclo criado com sucesso.',
      cycle,
      prestadoresAdicionados: providers.length,
      itensAdicionados: items.length,
    });
  } catch (error) {
    console.error('Erro ao criar ciclo de auto inventário:', error);
    return res.status(500).json({
      error: 'Erro ao criar ciclo de auto inventário.',
    });
  }
};

exports.listCycles = async (_req, res) => {
  try {
    const cycles = await AutoInventoryCycle.findAll({
      order: [
        ['year', 'DESC'],
        ['month', 'DESC'],
      ],
      include: [
        {
          model: AutoInventoryResponse,
          as: 'responses',
          attributes: ['id', 'status'],
        },
      ],
    });

    const result = cycles.map((cycle) => {
      const responses = cycle.responses || [];

      return {
        id: cycle.id,
        month: cycle.month,
        year: cycle.year,
        status: cycle.status,
        sendDate: cycle.sendDate,
        nome: getCycleName(cycle.month, cycle.year),
        totalPrestadores: responses.length,
        pendentes: responses.filter((r) => r.status === 'PENDENTE').length,
        parciais: responses.filter((r) => r.status === 'PARCIAL').length,
        completos: responses.filter((r) => r.status === 'COMPLETO').length,
      };
    });

    return res.json(result);
  } catch (error) {
    console.error('Erro ao listar ciclos:', error);
    return res.status(500).json({
      error: 'Erro ao listar ciclos.',
    });
  }
};

exports.syncCycleProviders = async (req, res) => {
  try {
    const { month, year } = req.body;

    const cycle = await AutoInventoryCycle.findOne({
      where: {
        month: Number(month),
        year: Number(year),
      },
    });

    if (!cycle) {
      return res.status(404).json({
        error: 'Ciclo não encontrado.',
      });
    }

    const providers = await User.findAll({
      where: {
        isActive: true,
        autoInventoryEnabled: true,
        email: {
          [Op.ne]: null,
        },
      },
    });

    const items = await AutoInventoryItem.findAll({
      where: { ativo: true },
    });

    let createdCount = 0;
    let createdItemsCount = 0;

    for (const provider of providers) {
      let response = await AutoInventoryResponse.findOne({
        where: {
          cycleId: cycle.id,
          providerId: provider.id,
        },
      });

      if (!response) {
        response = await AutoInventoryResponse.create({
          cycleId: cycle.id,
          providerId: provider.id,
          token: generateToken(),
          status: 'PENDENTE',
        });

        createdCount++;
      }

      for (const item of items) {
        const exists = await AutoInventoryResponseItem.findOne({
          where: {
            responseId: response.id,
            itemId: item.id,
          },
        });

        if (!exists) {
          await AutoInventoryResponseItem.create({
            responseId: response.id,
            itemId: item.id,
            quantidade: null,
          });

          createdItemsCount++;
        }
      }

      response.status = await detectResponseStatus(response.id);
      await response.save();
    }

    return res.json({
      message: 'Ciclo sincronizado com sucesso.',
      prestadoresEncontrados: providers.length,
      novosPrestadoresAdicionados: createdCount,
      itensAtivos: items.length,
      novosItensAdicionados: createdItemsCount,
    });
  } catch (error) {
    console.error('Erro ao sincronizar ciclo:', error);
    return res.status(500).json({
      error: 'Erro ao sincronizar ciclo.',
    });
  }
};

// ================= DASHBOARD =================

exports.getDashboard = async (req, res) => {
  try {
    const { month, year } = req.query;

    const whereCycle = {};

    if (month) whereCycle.month = Number(month);
    if (year) whereCycle.year = Number(year);

    const cycle = await AutoInventoryCycle.findOne({
      where: whereCycle,
      order: [
        ['year', 'DESC'],
        ['month', 'DESC'],
      ],
      include: [
        {
          model: AutoInventoryResponse,
          as: 'responses',
          include: [
            {
              model: User,
              as: 'provider',
              attributes: ['id', 'name', 'email', 'isActive'],
            },
            {
              model: User,
              as: 'validatedBy',
              attributes: ['id', 'name', 'email'],
            },
            {
              model: AutoInventoryResponseItem,
              as: 'items',
              include: [
                {
                  model: AutoInventoryItem,
                  as: 'item',
                  attributes: ['id', 'codigo', 'nome'],
                },
              ],
            },
          ],
        },
      ],
    });

    if (!cycle) {
      return res.status(404).json({
        error: 'Ciclo não encontrado.',
      });
    }

    const config = await getOrCreateConfig();

    const providers = (cycle.responses || []).map((response) => {
      const items = response.items || [];

      const totalItens = items.length;
      const preenchidos = items.filter(
        (i) => i.quantidade !== null && i.quantidade !== undefined
      ).length;

      return {
        responseId: response.id,
        providerId: response.providerId,
        prestador: response.provider,
        status: response.status,
        link: getPublicLink(response.token),
        openedAt: response.openedAt,
        submittedAt: response.submittedAt,
        lastUpdateAt: response.lastUpdateAt,
        reminderSentAt: response.reminderSentAt,
        completedMailSentAt: response.completedMailSentAt,
        validatedAt: response.validatedAt,
        validatedBy: response.validatedBy,
        totalItens,
        preenchidos,
        faltantes: totalItens - preenchidos,
      };
    });

    return res.json({
      cycle: {
        id: cycle.id,
        month: cycle.month,
        year: cycle.year,
        status: cycle.status,
        nome: getCycleName(cycle.month, cycle.year),
        sendDate: cycle.sendDate,
        config: {
          sendDay: config.sendDay,
          emailCc: config.emailCc,
          enabled: config.enabled,
        },
      },
      resumo: {
        totalPrestadores: providers.length,
        pendentes: providers.filter((p) => p.status === 'PENDENTE').length,
        parciais: providers.filter((p) => p.status === 'PARCIAL').length,
        completos: providers.filter((p) => p.status === 'COMPLETO').length,
      },
      providers,
    });
  } catch (error) {
    console.error('Erro ao carregar dashboard:', error);
    return res.status(500).json({
      error: 'Erro ao carregar dashboard.',
    });
  }
};

exports.getProviderInventory = async (req, res) => {
  try {
    const { providerId } = req.params;
    const { month, year } = req.query;

    const whereCycle = {};
    if (month) whereCycle.month = Number(month);
    if (year) whereCycle.year = Number(year);

    const response = await AutoInventoryResponse.findOne({
      where: { providerId },
      include: [
        {
          model: AutoInventoryCycle,
          as: 'cycle',
          where: whereCycle,
        },
        {
          model: User,
          as: 'provider',
          attributes: ['id', 'name', 'email', 'isActive'],
        },
        {
          model: AutoInventoryResponseItem,
          as: 'items',
          include: [
            {
              model: AutoInventoryItem,
              as: 'item',
              attributes: ['id', 'codigo', 'nome'],
            },
          ],
        },
      ],
    });

    if (!response) {
      return res.status(404).json({
        error: 'Inventário do prestador não encontrado.',
      });
    }

    return res.json({
      ...response.toJSON(),
      link: getPublicLink(response.token),
    });
  } catch (error) {
    console.error('Erro ao buscar inventário do prestador:', error);
    return res.status(500).json({
      error: 'Erro ao buscar inventário do prestador.',
    });
  }
};
exports.validateProviderInventory = async (req, res) => {
  try {
    const { responseId } = req.params;
    const userId = req.user?.id;

    const response = await AutoInventoryResponse.findByPk(responseId);

    if (!response) {
      return res.status(404).json({
        error: 'Inventário não encontrado.',
      });
    }

    if (!['PARCIAL', 'COMPLETO'].includes(response.status)) {
      return res.status(400).json({
        error: 'Só é possível validar inventários parciais ou completos.',
      });
    }

    response.validatedAt = new Date();
    response.validatedById = userId;

    await response.save();

    return res.json({
      message: 'Inventário validado com sucesso.',
    });
  } catch (error) {
    console.error('Erro ao validar inventário:', error);
    return res.status(500).json({
      error: 'Erro ao validar inventário.',
    });
  }
};
// ================= PÚBLICO =================

exports.getPublicInventory = async (req, res) => {
  try {
    const { token } = req.params;

    const response = await AutoInventoryResponse.findOne({
      where: { token },
      include: [
        {
          model: AutoInventoryCycle,
          as: 'cycle',
        },
        {
          model: User,
          as: 'provider',
          attributes: ['id', 'name', 'email'],
        },
        {
          model: AutoInventoryResponseItem,
          as: 'items',
          include: [
            {
              model: AutoInventoryItem,
              as: 'item',
              attributes: ['id', 'codigo', 'nome'],
            },
          ],
        },
      ],
    });

    if (!response) {
      return res.status(404).json({
        error: 'Link inválido ou expirado.',
      });
    }

    if (!response.openedAt) {
      response.openedAt = new Date();
      await response.save();
    }

    return res.json({
      id: response.id,
      status: response.status,
      cycle: response.cycle,
      provider: response.provider,
      items: response.items,
    });
  } catch (error) {
    console.error('Erro ao abrir inventário público:', error);
    return res.status(500).json({
      error: 'Erro ao abrir inventário.',
    });
  }
};

exports.updatePublicInventory = async (req, res) => {
  try {
    const { token } = req.params;
    const { items = [], finalizar = false } = req.body;

    const response = await AutoInventoryResponse.findOne({
      where: { token },
      include: [
        {
          model: AutoInventoryResponseItem,
          as: 'items',
        },
      ],
    });

    if (!response) {
      return res.status(404).json({
        error: 'Link inválido ou expirado.',
      });
    }

    for (const item of items) {
      const responseItem = await AutoInventoryResponseItem.findOne({
        where: {
          responseId: response.id,
          itemId: item.itemId,
        },
      });

      if (responseItem) {
        responseItem.quantidade =
          item.quantidade === '' ||
          item.quantidade === null ||
          item.quantidade === undefined
            ? null
            : Number(item.quantidade);

        await responseItem.save();
      }
    }

    const status = await detectResponseStatus(
      response.id,
      finalizar
    );

    response.status = status;
    response.lastUpdateAt = new Date();

      if (finalizar && status === 'COMPLETO') {
        response.submittedAt = new Date();
      } else {
        response.submittedAt = null;
      }

    await response.save();

    return res.json({
      message:
        status === 'COMPLETO'
          ? 'Inventário enviado com sucesso.'
          : 'Inventário salvo parcialmente. Ainda existem itens sem preenchimento.',
      status,
    });
  } catch (error) {
    console.error('Erro ao atualizar inventário público:', error);
    return res.status(500).json({
      error: 'Erro ao salvar inventário.',
    });
  }
};

// ================= E-MAIL =================

exports.resendProviderInventory = async (req, res) => {
  try {
    const { providerId } = req.params;
    const { month, year } = req.body;

    const cycle = await AutoInventoryCycle.findOne({
      where: {
        month: Number(month),
        year: Number(year),
      },
    });

    if (!cycle) {
      return res.status(404).json({
        error: 'Ciclo não encontrado.',
      });
    }

    const response = await AutoInventoryResponse.findOne({
      where: {
        providerId,
        cycleId: cycle.id,
      },
      include: [
        {
          model: User,
          as: 'provider',
          attributes: ['id', 'name', 'email', 'isActive'],
        },
      ],
    });

    if (!response) {
      return res.status(404).json({
        error: 'Inventário do prestador não encontrado.',
      });
    }

    const config = await getOrCreateConfig();

    await autoInventoryMailService.sendInventoryRequest(response, {
      cc: config.emailCc,
    });

    return res.json({
      message: 'Solicitação reenviada com sucesso.',
      link: getPublicLink(response.token),
    });
  } catch (error) {
    console.error('Erro ao reenviar solicitação:', error);
    return res.status(500).json({
      error: 'Erro ao reenviar solicitação.',
    });
  }
};

exports.sendCycleEmails = async (req, res) => {
  try {
    const { month, year } = req.body;

    const cycle = await AutoInventoryCycle.findOne({
      where: {
        month: Number(month),
        year: Number(year),
      },
      include: [
        {
          model: AutoInventoryResponse,
          as: 'responses',
          include: [
            {
              model: User,
              as: 'provider',
              attributes: ['id', 'name', 'email', 'isActive'],
            },
          ],
        },
      ],
    });

    if (!cycle) {
      return res.status(404).json({
        error: 'Ciclo não encontrado.',
      });
    }

    const config = await getOrCreateConfig();

    let sent = 0;
    let skipped = 0;

    for (const response of cycle.responses || []) {
      if (!response.provider?.email) {
        skipped++;
        continue;
      }

      if (response.status === 'COMPLETO') {
        skipped++;
        continue;
      }

      await autoInventoryMailService.sendInventoryRequest(response, {
        cc: config.emailCc,
      });

      sent++;
    }

    cycle.sendDate = new Date();
    await cycle.save();

    return res.json({
      message: 'E-mails enviados com sucesso.',
      enviados: sent,
      ignorados: skipped,
    });
  } catch (error) {
    console.error('Erro ao enviar e-mails do ciclo:', error);
    return res.status(500).json({
      error: 'Erro ao enviar e-mails do ciclo.',
    });
  }
};

// ================= EXPORTAÇÃO =================

exports.exportMonthlyInventory = async (req, res) => {
  try {
    const { month, year, providerId } = req.query;

    if (!month || !year) {
      return res.status(400).json({
        error: 'Mês e ano são obrigatórios.',
      });
    }

    const cycle = await AutoInventoryCycle.findOne({
      where: {
        month: Number(month),
        year: Number(year),
      },
      include: [
        {
          model: AutoInventoryResponse,
          as: 'responses',
          include: [
            {
              model: User,
              as: 'provider',
              attributes: [
                'id',
                'name',
                'email',
                'vendorCode',
                'serviceAreaCode',
                'serviceAreaName',
              ],
            },
            {
              model: AutoInventoryResponseItem,
              as: 'items',
              include: [
                {
                  model: AutoInventoryItem,
                  as: 'item',
                  attributes: ['codigo', 'nome'],
                },
              ],
            },
          ],
        },
      ],
    });

    if (!cycle) {
      return res.status(404).json({
        error: 'Ciclo não encontrado.',
      });
    }

    const responses = providerId
      ? (cycle.responses || []).filter(
          (response) => Number(response.providerId) === Number(providerId)
        )
      : cycle.responses || [];

    const rows = [];

    for (const response of responses) {
      for (const responseItem of response.items || []) {
        rows.push({
          Mes: cycle.month,
          Ano: cycle.year,
          Prestador: response.provider?.name || '',
          Email: response.provider?.email || '',
          CodigoFornecedor: response.provider?.vendorCode || '',
          CodigoArea: response.provider?.serviceAreaCode || '',
          NomeArea: response.provider?.serviceAreaName || '',
          Status: response.status,
          Codigo: responseItem.item?.codigo || '',
          Peca: responseItem.item?.nome || '',
          Quantidade:
            responseItem.quantidade === null ||
            responseItem.quantidade === undefined
              ? ''
              : responseItem.quantidade,
          AbertoEm: response.openedAt || '',
          EnviadoEm: response.submittedAt || '',
          UltimaAtualizacao: response.lastUpdateAt || '',
          EmailLembreteEnviadoEm: response.reminderSentAt || '',
          EmailCompletoEnviadoEm: response.completedMailSentAt || '',
        });
      }
    }

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Auto Inventario');

    const buffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    });

    const filename = providerId
      ? `auto-inventario-prestador-${providerId}-${month}-${year}.xlsx`
      : `auto-inventario-${month}-${year}.xlsx`;

    res.setHeader(
      'Content-Disposition',
      `attachment; filename=${filename}`
    );

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    return res.send(buffer);
  } catch (error) {
    console.error('Erro ao exportar inventário:', error);
    return res.status(500).json({
      error: 'Erro ao exportar inventário.',
    });
  }
};

// ================= REMOVER =================

exports.removeProviderFromCycle = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { providerId } = req.params;
    const { month, year } = req.body;

    if (!month || !year) {
      await transaction.rollback();

      return res.status(400).json({
        error: 'Mês e ano são obrigatórios.',
      });
    }

    const cycle = await AutoInventoryCycle.findOne({
      where: {
        month: Number(month),
        year: Number(year),
      },
      transaction,
    });

    if (!cycle) {
      await transaction.rollback();

      return res.status(404).json({
        error: 'Ciclo não encontrado.',
      });
    }

    const response = await AutoInventoryResponse.findOne({
      where: {
        cycleId: cycle.id,
        providerId: Number(providerId),
      },
      transaction,
    });

    if (!response) {
      await transaction.rollback();

      return res.status(404).json({
        error: 'Prestador não encontrado neste ciclo.',
      });
    }

    await AutoInventoryResponseItem.destroy({
      where: {
        responseId: response.id,
      },
      transaction,
    });

    await response.destroy({ transaction });

    await User.update(
      {
        autoInventoryEnabled: false,
      },
      {
        where: {
          id: Number(providerId),
        },
        transaction,
        validate: false,
        hooks: false,
      }
    );

    await transaction.commit();

    return res.json({
      message:
        'Prestador removido do inventário deste mês e desabilitado para próximos ciclos.',
    });
  } catch (error) {
    await transaction.rollback();

    console.error('Erro ao remover prestador do ciclo:', error);

    return res.status(500).json({
      error: 'Erro ao remover prestador do inventário.',
    });
  }
};