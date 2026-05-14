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
  Role,
} = require('../models');

const autoInventoryMailService = require('../services/autoInventoryMailService');

const generateToken = () => crypto.randomBytes(32).toString('hex');

const getFrontendUrl = () =>
  process.env.API_URL || 'http://localhost:5173';

const getPublicLink = (token) =>
  `${getFrontendUrl()}/auto-inventario/${token}`;

const PROVIDER_KINDS_ALLOWED = new Set(['ATA', 'PRP', 'SPOT', 'PSO']);

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function roleKindFromRoleName(roleName) {
  const role = normalizeText(roleName);

  if (role === 'ATA' || role.includes(' ATA')) return 'ATA';
  if (role === 'PRP' || role.includes(' PRP')) return 'PRP';
  if (role === 'SPOT' || role.includes(' SPOT')) return 'SPOT';
  if (role === 'PSO' || role.includes(' PSO')) return 'PSO';

  return 'OTHER';
}

const roleLevel = (user) => Number(user?.role?.level || 0);

function normalizeId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parseBooleanFilter(value) {
  if (value === undefined || value === null || value === '') return null;
  const text = String(value).trim().toLowerCase();
  if (['true', '1', 'sim', 'yes'].includes(text)) return true;
  if (['false', '0', 'nao', 'não', 'no'].includes(text)) return false;
  return null;
}

async function buildProviderHierarchyMap() {
  const users = await User.findAll({
    attributes: ['id', 'name', 'email', 'managerId'],
    include: [{ model: Role, as: 'role', attributes: ['id', 'name', 'level'] }],
  });

  const byId = new Map(users.map((user) => [user.id, user]));
  const hierarchyByProviderId = new Map();

  const findUpstream = (user, minLevel) => {
    let current = user;
    const visited = new Set();

    while (current?.managerId && !visited.has(current.managerId)) {
      visited.add(current.managerId);
      const manager = byId.get(current.managerId);
      if (!manager) break;

      if (roleLevel(manager) >= minLevel) {
        return manager;
      }

      current = manager;
    }

    return null;
  };

  for (const user of users) {
    const supervisor = findUpstream(user, 3);
    const coordinator = findUpstream(user, 4);

    hierarchyByProviderId.set(user.id, {
      supervisor: supervisor
        ? { id: supervisor.id, name: supervisor.name, email: supervisor.email || null }
        : null,
      coordinator: coordinator
        ? { id: coordinator.id, name: coordinator.name, email: coordinator.email || null }
        : null,
    });
  }

  return hierarchyByProviderId;
}

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



// ================= PRESTADORES / ESTOQUE AVANÇADO =================

exports.listInventoryProviders = async (req, res) => {
  try {
    const {
      q,
      coordinatorId,
      supervisorId,
      estoqueAvancado,
      autoInventoryEnabled,
    } = req.query;

    const selectedCoordinatorId = normalizeId(coordinatorId);
    const selectedSupervisorId = normalizeId(supervisorId);
    const estoqueAvancadoFilter = parseBooleanFilter(estoqueAvancado);
    const autoInventoryFilter = parseBooleanFilter(autoInventoryEnabled);

    const whereUser = {
      isActive: true,
      email: { [Op.ne]: null },
    };

    if (q && String(q).trim()) {
      const term = `%${String(q).trim()}%`;
      whereUser[Op.or] = [
        { name: { [Op.like]: term } },
        { email: { [Op.like]: term } },
      ];
    }

    if (estoqueAvancadoFilter !== null) {
      whereUser.estoqueAvancado = estoqueAvancadoFilter;
    }

    if (autoInventoryFilter !== null) {
      whereUser.autoInventoryEnabled = autoInventoryFilter;
    }

    const users = await User.findAll({
      where: whereUser,
      attributes: [
        'id',
        'name',
        'email',
        'isActive',
        'managerId',
        'estoqueAvancado',
        'autoInventoryEnabled',
      ],
      include: [{ model: Role, as: 'role', attributes: ['id', 'name', 'level'] }],
      order: [['name', 'ASC']],
    });

    const hierarchyByProviderId = await buildProviderHierarchyMap();

    let providers = users
      .map((user) => {
        const kind = roleKindFromRoleName(user.role?.name);
        const hierarchy = hierarchyByProviderId.get(user.id) || {};

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          isActive: !!user.isActive,
          estoqueAvancado: !!user.estoqueAvancado,
          autoInventoryEnabled: !!user.autoInventoryEnabled,
          tipoPrestador: kind,
          role: user.role
            ? { id: user.role.id, name: user.role.name, level: user.role.level }
            : null,
          supervisor: hierarchy.supervisor || null,
          coordinator: hierarchy.coordinator || null,
          supervisorId: hierarchy.supervisor?.id || null,
          coordinatorId: hierarchy.coordinator?.id || null,
        };
      })
      .filter((provider) => PROVIDER_KINDS_ALLOWED.has(provider.tipoPrestador));

    providers = providers.filter((provider) => {
      if (selectedCoordinatorId && provider.coordinatorId !== selectedCoordinatorId) return false;
      if (selectedSupervisorId && provider.supervisorId !== selectedSupervisorId) return false;
      return true;
    });

    const coordinatorsMap = new Map();
    const supervisorsMap = new Map();

    providers.forEach((provider) => {
      if (provider.coordinator?.id) coordinatorsMap.set(provider.coordinator.id, provider.coordinator);
      if (provider.supervisor?.id) supervisorsMap.set(provider.supervisor.id, provider.supervisor);
    });

    return res.json({
      providers,
      resumo: {
        total: providers.length,
        estoqueAvancado: providers.filter((p) => p.estoqueAvancado).length,
        semEstoqueAvancado: providers.filter((p) => !p.estoqueAvancado).length,
        autoInventoryEnabled: providers.filter((p) => p.autoInventoryEnabled).length,
        autoInventoryDisabled: providers.filter((p) => !p.autoInventoryEnabled).length,
      },
      filters: {
        coordinators: Array.from(coordinatorsMap.values()).sort((a, b) =>
          String(a.name || '').localeCompare(String(b.name || ''))
        ),
        supervisors: Array.from(supervisorsMap.values()).sort((a, b) =>
          String(a.name || '').localeCompare(String(b.name || ''))
        ),
        tiposPrestador: Array.from(PROVIDER_KINDS_ALLOWED),
      },
    });
  } catch (error) {
    console.error('Erro ao listar prestadores do auto inventário:', error);
    return res.status(500).json({
      error: 'Erro ao listar prestadores do auto inventário.',
    });
  }
};

exports.updateProviderAutoInventory = async (req, res) => {
  try {
    const { providerId } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        error: 'Informe enabled como true ou false.',
      });
    }

    const provider = await User.findByPk(Number(providerId), {
      attributes: ['id', 'name', 'email', 'autoInventoryEnabled'],
    });

    if (!provider) {
      return res.status(404).json({
        error: 'Prestador não encontrado.',
      });
    }

    await User.update(
      { autoInventoryEnabled: enabled },
      {
        where: { id: provider.id },
        validate: false,
        hooks: false,
      }
    );

    return res.json({
      message: enabled
        ? 'Prestador habilitado para estoque avançado.'
        : 'Prestador desabilitado do estoque avançado.',
      provider: {
        id: provider.id,
        name: provider.name,
        email: provider.email,
        autoInventoryEnabled: enabled,
      },
    });
  } catch (error) {
    console.error('Erro ao atualizar estoque avançado do prestador:', error);
    return res.status(500).json({
      error: 'Erro ao atualizar estoque avançado do prestador.',
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

    const providerRows = await User.findAll({
      where: {
        isActive: true,
        autoInventoryEnabled: true,
        email: {
          [Op.ne]: null,
        },
      },
      include: [{ model: Role, as: 'role', attributes: ['id', 'name', 'level'] }],
    });

    const providers = providerRows.filter((provider) =>
      PROVIDER_KINDS_ALLOWED.has(getAutoInventoryProviderKind(provider))
    );

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

    const providerRows = await User.findAll({
      where: {
        isActive: true,
        autoInventoryEnabled: true,
        email: {
          [Op.ne]: null,
        },
      },
      include: [{ model: Role, as: 'role', attributes: ['id', 'name', 'level'] }],
    });

    const providers = providerRows.filter((provider) =>
      PROVIDER_KINDS_ALLOWED.has(getAutoInventoryProviderKind(provider))
    );

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
    const { month, year, coordinatorId, supervisorId } = req.query;

    const selectedCoordinatorId = normalizeId(coordinatorId);
    const selectedSupervisorId = normalizeId(supervisorId);

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
              attributes: ['id', 'name', 'email', 'isActive', 'managerId'],
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
    const hierarchyByProviderId = await buildProviderHierarchyMap();

    const providers = (cycle.responses || [])
      .map((response) => {
        const items = response.items || [];
        const hierarchy = hierarchyByProviderId.get(response.providerId) || {};

        const totalItens = items.length;
        const preenchidos = items.filter(
          (i) => i.quantidade !== null && i.quantidade !== undefined
        ).length;

        return {
          responseId: response.id,
          providerId: response.providerId,
          prestador: response.provider,
          provider: response.provider,
          supervisor: hierarchy.supervisor || null,
          coordinator: hierarchy.coordinator || null,
          supervisorId: hierarchy.supervisor?.id || null,
          coordinatorId: hierarchy.coordinator?.id || null,
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
      })
      .filter((provider) => {
        if (selectedCoordinatorId && provider.coordinatorId !== selectedCoordinatorId) return false;
        if (selectedSupervisorId && provider.supervisorId !== selectedSupervisorId) return false;
        return true;
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
          attributes: ['id', 'name', 'email', 'isActive', 'managerId'],
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
          attributes: ['id', 'name', 'email', 'isActive', 'managerId'],
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
              attributes: ['id', 'name', 'email', 'isActive', 'managerId'],
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



// ================= PRESTADORES / CONFIGURAÇÃO DE ENVIO =================

function normalizeRoleNameAutoInventory(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function getAutoInventoryProviderKind(userOrRoleName) {
  const roleName =
    typeof userOrRoleName === 'string'
      ? userOrRoleName
      : userOrRoleName?.role?.name;

  const estoqueAvancado =
    typeof userOrRoleName === 'object'
      ? !!userOrRoleName?.estoqueAvancado
      : false;

  const role = normalizeRoleNameAutoInventory(roleName);

  // Prestadores cadastrados diretamente pelo perfil/cargo
  if (role === 'ATA' || /\bATA\b/.test(role)) return 'ATA';
  if (role === 'PRP' || /\bPRP\b/.test(role)) return 'PRP';
  if (role === 'SPOT' || /\bSPOT\b/.test(role)) return 'SPOT';
  if (role === 'PSO' || /\bPSO\b/.test(role)) return 'PSO';

  // No mapa de prestadores, muitos ATAs aparecem como TECNICO + Estoque Avançado.
  // Por isso eles também precisam entrar no Auto Inventário.
  if (estoqueAvancado && /\bTECNICO\b/.test(role)) return 'ATA';

  return null;
}

function parseBooleanQuery(value) {
  if (value === undefined || value === null || value === '') return null;

  const normalized = String(value).trim().toLowerCase();

  if (['1', 'true', 'sim', 'yes', 's'].includes(normalized)) return true;
  if (['0', 'false', 'nao', 'não', 'no', 'n'].includes(normalized)) return false;

  return null;
}

function findAutoInventoryUpstream(user, usersById, minLevel) {
  let current = user;
  const visited = new Set();

  while (current && current.managerId) {
    if (visited.has(current.managerId)) break;
    visited.add(current.managerId);

    const manager = usersById.get(current.managerId);
    if (!manager) break;

    if ((Number(manager.role?.level) || 0) >= minLevel) {
      return manager;
    }

    current = manager;
  }

  return null;
}

function optionFromUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email || null,
  };
}

exports.listInventoryProviders = async (req, res) => {
  try {
    const q = String(req.query.q || '').trim().toLowerCase();
    const coordinatorId = req.query.coordinatorId ? Number(req.query.coordinatorId) : null;
    const supervisorId = req.query.supervisorId ? Number(req.query.supervisorId) : null;
    const estoqueAvancadoFilter = parseBooleanQuery(req.query.estoqueAvancado);
    const autoInventoryFilter = parseBooleanQuery(req.query.autoInventoryEnabled);

    const users = await User.findAll({
      // Não filtra por isActive aqui para manter a mesma base do cadastro/mapa de prestadores.
      // O envio mensal continua dependendo somente de autoInventoryEnabled.
      where: {},
      attributes: [
        'id',
        'name',
        'email',
        'managerId',
        'isActive',
        'estoqueAvancado',
        'autoInventoryEnabled',
        'vendorCode',
        'serviceAreaCode',
        'serviceAreaName',
        'tipoAtendimento',
      ],
      include: [
        {
          model: Role,
          as: 'role',
          attributes: ['id', 'name', 'level'],
          required: false,
        },
      ],
      order: [['name', 'ASC']],
    });

    const usersById = new Map(users.map((user) => [user.id, user]));
    const allowedKinds = new Set(['ATA', 'PRP', 'SPOT', 'PSO']);

    const baseProviders = users
      .map((user) => {
        const tipoPrestador = getAutoInventoryProviderKind(user);

        if (!allowedKinds.has(tipoPrestador)) return null;

        const supervisor = findAutoInventoryUpstream(user, usersById, 3);
        const coordinator = findAutoInventoryUpstream(user, usersById, 4);

        return {
          id: user.id,
          name: user.name,
          email: user.email || null,
          tipoPrestador,
          role: user.role
            ? {
                id: user.role.id,
                name: user.role.name,
                level: user.role.level,
              }
            : null,
          estoqueAvancado: !!user.estoqueAvancado,
          autoInventoryEnabled: !!user.autoInventoryEnabled,
          vendorCode: user.vendorCode || null,
          serviceAreaCode: user.serviceAreaCode || null,
          serviceAreaName: user.serviceAreaName || null,
          tipoAtendimento: user.tipoAtendimento || null,
          coordinator: optionFromUser(coordinator),
          coordinatorId: coordinator?.id || null,
          supervisor: optionFromUser(supervisor),
          supervisorId: supervisor?.id || null,
        };
      })
      .filter(Boolean);

    const coordinatorMap = new Map();
    const supervisorMap = new Map();

    for (const provider of baseProviders) {
      if (provider.coordinator && !coordinatorMap.has(provider.coordinator.id)) {
        coordinatorMap.set(provider.coordinator.id, provider.coordinator);
      }

      if (provider.supervisor && !supervisorMap.has(provider.supervisor.id)) {
        supervisorMap.set(provider.supervisor.id, provider.supervisor);
      }
    }

    let providers = baseProviders;

    if (q) {
      providers = providers.filter((provider) => {
        const searchable = [
          provider.name,
          provider.email,
          provider.vendorCode,
          provider.serviceAreaCode,
          provider.serviceAreaName,
          provider.tipoPrestador,
          provider.coordinator?.name,
          provider.supervisor?.name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return searchable.includes(q);
      });
    }

    if (coordinatorId) {
      providers = providers.filter((provider) => Number(provider.coordinatorId) === coordinatorId);
    }

    if (supervisorId) {
      providers = providers.filter((provider) => Number(provider.supervisorId) === supervisorId);
    }

    if (estoqueAvancadoFilter !== null) {
      providers = providers.filter((provider) => provider.estoqueAvancado === estoqueAvancadoFilter);
    }

    if (autoInventoryFilter !== null) {
      providers = providers.filter((provider) => provider.autoInventoryEnabled === autoInventoryFilter);
    }

    return res.json({
      providers,
      resumo: {
        total: providers.length,
        estoqueAvancado: providers.filter((provider) => provider.estoqueAvancado).length,
        semEstoqueAvancado: providers.filter((provider) => !provider.estoqueAvancado).length,
        autoInventarioAtivo: providers.filter((provider) => provider.autoInventoryEnabled).length,
        autoInventarioInativo: providers.filter((provider) => !provider.autoInventoryEnabled).length,
        totalBase: baseProviders.length,
      },
      filters: {
        coordinators: Array.from(coordinatorMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
        supervisors: Array.from(supervisorMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
      },
    });
  } catch (error) {
    console.error('Erro ao listar prestadores do auto inventário:', error);

    return res.status(500).json({
      error: 'Erro ao listar prestadores do auto inventário.',
    });
  }
};

exports.updateProviderAutoInventory = async (req, res) => {
  try {
    const { providerId } = req.params;
    const enabled = !!req.body.enabled;

    const provider = await User.findByPk(providerId, {
      include: [
        {
          model: Role,
          as: 'role',
          attributes: ['id', 'name', 'level'],
          required: false,
        },
      ],
    });

    if (!provider) {
      return res.status(404).json({ error: 'Prestador não encontrado.' });
    }

    const tipoPrestador = getAutoInventoryProviderKind(provider);

    if (!['ATA', 'PRP', 'SPOT', 'PSO'].includes(tipoPrestador)) {
      return res.status(400).json({
        error: 'Auto inventário permitido somente para prestadores ATA, PRP, SPOT ou PSO.',
      });
    }

    await User.update(
      { autoInventoryEnabled: enabled },
      {
        where: { id: Number(providerId) },
        validate: false,
        hooks: false,
      }
    );

    return res.json({
      message: enabled
        ? 'Prestador habilitado para auto inventário.'
        : 'Prestador desabilitado do auto inventário.',
      provider: {
        id: provider.id,
        name: provider.name,
        email: provider.email || null,
        tipoPrestador,
        estoqueAvancado: !!provider.estoqueAvancado,
        autoInventoryEnabled: enabled,
      },
    });
  } catch (error) {
    console.error('Erro ao atualizar prestador do auto inventário:', error);

    return res.status(500).json({
      error: 'Erro ao atualizar prestador do auto inventário.',
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