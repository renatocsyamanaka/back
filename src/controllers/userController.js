const Joi = require('joi');
const { User, Role, Location } = require('../models');
const { ok, created, bad, notFound } = require('../utils/responses');
const { Op } = require('sequelize');
const baseUrl = process.env.BASE_URL || 'https://api.projetos-rc.online';

const VALID_SECTORS = [
  'OPERACOES',
  'LOGISTICA',
  'SISTEMAS',
  'ATENDIMENTO',
];

const VALID_PERMISSIONS = [
  'DASHBOARD_VIEW',
  'INSTALLATION_PROJECTS_VIEW',
  'PART_REQUESTS_VIEW',
  'MY_PART_REQUESTS_VIEW',
  'TECHS_MAP_VIEW',
  'USERS_VIEW',
  'ORG_VIEW',
  'LOCATIONS_VIEW',
  'PRESTADORES_APROVADOS_VIEW',
  'CLIENTS_VIEW',
  'TASKS_VIEW',
  'TECH_TYPES_VIEW',
  'NEEDS_VIEW',
  'NEEDS_MAP_VIEW',
  'ASSIGNMENTS_VIEW',
  'OVERTIME_VIEW',
  'TIMEOFF_VIEW',
  'NEWS_VIEW',
  'NEWS_ADMIN_VIEW',
  'DELIVERY_REPORTS_VIEW',
  'DELIVERY_REPORTS_ADMIN',
  'DASHBOARD_ACTIVITY_VIEW',
  'DASHBOARD_ACTIVITY_ADMIN',
];

const DEFAULT_PERMISSIONS = [
  'DASHBOARD_VIEW',
  'ASSIGNMENTS_VIEW',
];

const defaultIncludes = [
  { model: Role, as: 'role', attributes: ['id', 'name', 'level'] },
  { model: User, as: 'manager', attributes: ['id', 'name', 'avatarUrl'] },
  { model: Location, as: 'location' },
];
const USER_INCLUDE = [
  { model: Role, as: 'role', attributes: ['id', 'name', 'level'] },
  { model: User, as: 'manager', attributes: ['id', 'name', 'avatarUrl'] },
  { model: Location, as: 'location' },
];

function serializeUser(userInstance) {
  const payload = enrichUserPayload(userInstance);

  return {
    id: payload.id,
    name: payload.name,
    email: payload.email,
    phone: payload.phone,
    avatarUrl: payload.avatarUrl,
    sex: payload.sex ?? null,
    loginEnabled: payload.loginEnabled ?? false,
    managerId: payload.managerId ?? null,
    locationId: payload.locationId ?? null,
    sectors: payload.sectors,
    permissions: payload.permissions,
    estoqueAvancado: !!payload.estoqueAvancado,
    vendorCode: payload.vendorCode ?? null,
    serviceAreaCode: payload.serviceAreaCode ?? null,
    serviceAreaName: payload.serviceAreaName ?? null,
    tipoAtendimento: payload.tipoAtendimento ?? null,
    tipoAtendimentoDescricao: payload.tipoAtendimentoDescricao ?? null,

    cargoDescritivo: payload.cargoDescritivo ?? null,
    ocultarCargo: !!payload.ocultarCargo,

    role: payload.role
      ? {
          id: payload.role.id,
          name: payload.role.name,
          level: payload.role.level,
        }
      : null,
    manager: payload.manager
      ? {
          id: payload.manager.id,
          name: payload.manager.name,
          avatarUrl: payload.manager.avatarUrl ?? null,
        }
      : null,
    location: payload.location || null,
  };
}
function normRoleName(s) {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const WORKER_ALLOWED_ROLES = new Set([
  'tecnico',
  'pso',
  'ata',
  'prp',
  'spot',
]);

function normalizeTipoAtendimento(value) {
  if (value === undefined || value === null || value === '') return null;
  return String(value).trim().toUpperCase();
}

function roleKindFromRoleName(roleName) {
  const r = normRoleName(roleName);
  if (r === 'pso') return 'PSO';
  if (r === 'ata') return 'ATA';
  if (r === 'spot') return 'SPOT';
  if (r === 'prp') return 'PRP';
  if (r === 'tecnico') return 'TECH';
  return 'OTHER';
}

function getTipoAtendimentoDescricao(tipoAtendimento) {
  switch (tipoAtendimento) {
    case 'FX':
      return 'Fixo';
    case 'VL':
      return 'Volante';
    case 'FV':
      return 'Fixo e Volante';
    default:
      return null;
  }
}

function normalizeStringArray(value, fallback = []) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  let arr = value;

  if (typeof arr === 'string') {
    if (arr.includes(',')) {
      arr = arr.split(',');
    } else {
      arr = [arr];
    }
  }

  if (!Array.isArray(arr)) {
    arr = [arr];
  }

  arr = arr
    .map((item) => String(item || '').trim().toUpperCase())
    .filter(Boolean);

  return [...new Set(arr)];
}

function normalizeSectors(value) {
  const arr = normalizeStringArray(value, ['OPERACOES']);
  return arr.length ? arr : ['OPERACOES'];
}

function normalizePermissions(value) {
  const arr = normalizeStringArray(value, DEFAULT_PERMISSIONS);
  return arr.length ? arr : DEFAULT_PERMISSIONS;
}

function validateSectorsOrThrow(sectors) {
  const invalid = sectors.filter((sector) => !VALID_SECTORS.includes(sector));
  if (invalid.length > 0) {
    throw new Error(
      `Setores inválidos: ${invalid.join(', ')}. Permitidos: ${VALID_SECTORS.join(', ')}`
    );
  }
}

function validatePermissionsOrThrow(permissions) {
  const invalid = permissions.filter((permission) => !VALID_PERMISSIONS.includes(permission));
  if (invalid.length > 0) {
    throw new Error(
      `Permissões inválidas: ${invalid.join(', ')}. Permitidas: ${VALID_PERMISSIONS.join(', ')}`
    );
  }
}

function enrichUserPayload(userInstance) {
  const payload = userInstance.toJSON();
  payload.tipoAtendimentoDescricao = getTipoAtendimentoDescricao(payload.tipoAtendimento);
  payload.sectors = Array.isArray(payload.sectors) && payload.sectors.length > 0
    ? payload.sectors
    : ['OPERACOES'];
  payload.permissions = Array.isArray(payload.permissions) && payload.permissions.length > 0
    ? payload.permissions
    : DEFAULT_PERMISSIONS;

  payload.cargoDescritivo = payload.cargoDescritivo ?? null;
  payload.ocultarCargo = !!payload.ocultarCargo;

  return payload;
}
const workerSchema = Joi.object({
  name: Joi.string().required(),
  phone: Joi.string().allow('', null),

  roleId: Joi.number().required(),
  managerId: Joi.number().allow(null),

  sectors: Joi.alternatives().try(
    Joi.array().items(Joi.string()),
    Joi.string()
  ).optional(),

  permissions: Joi.alternatives().try(
    Joi.array().items(Joi.string()),
    Joi.string()
  ).optional(),

  estoqueAvancado: Joi.boolean().default(false),

  vendorCode: Joi.string().allow('', null),
  serviceAreaCode: Joi.string().allow('', null),
  serviceAreaName: Joi.string().allow('', null),

  tipoAtendimento: Joi.string().valid('FX', 'VL', 'FV').allow('', null),

  cargoDescritivo: Joi.string().max(150).allow('', null),
  ocultarCargo: Joi.boolean().default(false),

  addressStreet: Joi.string().required(),
  addressNumber: Joi.string().allow(''),
  addressComplement: Joi.string().allow(''),
  addressDistrict: Joi.string().allow(''),
  addressCity: Joi.string().required(),
  addressState: Joi.string().required(),
  addressZip: Joi.string().allow(''),
  addressCountry: Joi.string().default('Brasil'),

  lat: Joi.number().required(),
  lng: Joi.number().required(),
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(6).required(),
  confirmNewPassword: Joi.string().required(),
});

const userSchema = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  sex: Joi.string().valid('M', 'F', 'O').optional(),
  roleId: Joi.number().required(),
  managerId: Joi.number().allow(null),
  locationId: Joi.number().allow(null),

  sectors: Joi.alternatives().try(
    Joi.array().items(Joi.string()),
    Joi.string()
  ).optional(),

  permissions: Joi.alternatives().try(
    Joi.array().items(Joi.string()),
    Joi.string()
  ).optional(),

  phone: Joi.string().allow('', null),
  vendorCode: Joi.string().allow('', null),
  serviceAreaCode: Joi.string().allow('', null),
  serviceAreaName: Joi.string().allow('', null),
  tipoAtendimento: Joi.string().valid('FX', 'VL', 'FV').allow('', null),

  cargoDescritivo: Joi.string().max(150).allow('', null),
  ocultarCargo: Joi.boolean().default(false),
});

const updateSchema = Joi.object({
  name: Joi.string(),
  email: Joi.string().email().allow('', null),
  password: Joi.string().min(6),
  sex: Joi.string().valid('M', 'F', 'O'),
  roleId: Joi.number(),
  managerId: Joi.number().allow(null),
  locationId: Joi.number().allow(null),
  isActive: Joi.boolean(),

  sectors: Joi.alternatives().try(
    Joi.array().items(Joi.string()),
    Joi.string()
  ),

  permissions: Joi.alternatives().try(
    Joi.array().items(Joi.string()),
    Joi.string()
  ),

  estoqueAvancado: Joi.boolean(),

  phone: Joi.string().allow('', null),
  vendorCode: Joi.string().allow('', null),
  serviceAreaCode: Joi.string().allow('', null),
  serviceAreaName: Joi.string().allow('', null),
  tipoAtendimento: Joi.string().valid('FX', 'VL', 'FV').allow('', null),

  cargoDescritivo: Joi.string().max(150).allow('', null),
  ocultarCargo: Joi.boolean(),

  addressStreet: Joi.string().allow('', null),
  addressNumber: Joi.string().allow('', null),
  addressComplement: Joi.string().allow('', null),
  addressDistrict: Joi.string().allow('', null),
  addressCity: Joi.string().allow('', null),
  addressState: Joi.string().allow('', null),
  addressZip: Joi.string().allow('', null),
  addressCountry: Joi.string().allow('', null),

  lat: Joi.number().allow(null),
  lng: Joi.number().allow(null),
}).min(1);

const addressSchema = Joi.object({
  addressStreet: Joi.string().required(),
  addressNumber: Joi.string().allow(''),
  addressComplement: Joi.string().allow(''),
  addressDistrict: Joi.string().allow(''),
  addressCity: Joi.string().required(),
  addressState: Joi.string().required(),
  addressZip: Joi.string().allow(''),
  addressCountry: Joi.string().default('Brasil'),
  autoGeocode: Joi.boolean().default(true),
});

function buildAddressString(v) {
  return [
    `${v.addressStreet || ''} ${v.addressNumber || ''}`.trim(),
    v.addressDistrict,
    v.addressCity,
    v.addressState,
    v.addressZip,
    v.addressCountry || 'Brasil',
  ]
    .filter(Boolean)
    .join(', ');
}

async function geocodeNominatim(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'operacoes-app/1.0 (contato@empresa.com)' },
  });
  if (!res.ok) throw new Error('Geocoding error');
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  const { lat, lon } = data[0];
  return { lat: Number(lat), lng: Number(lon) };
}

async function cepLookup(req, res) {
  try {
    const cepRaw = String(req.query.cep || '').replace(/\D/g, '');
    if (!cepRaw) return bad(res, 'CEP inválido');

    const r = await fetch(`https://viacep.com.br/ws/${cepRaw}/json/`);
    if (!r.ok) return bad(res, 'Falha ao buscar CEP');
    const j = await r.json();
    if (j.erro) return notFound(res, 'CEP não encontrado');

    return ok(res, {
      addressStreet: j.logradouro || '',
      addressDistrict: j.bairro || '',
      addressCity: j.localidade || '',
      addressState: j.uf || '',
      addressZip: j.cep || cepRaw,
      addressCountry: 'Brasil',
    });
  } catch (e) {
    return bad(res, 'Erro ao buscar CEP');
  }
}

async function create(req, res) {
  try {
    const body = {
      ...req.body,
      tipoAtendimento:
        req.body.tipoAtendimento !== undefined
          ? normalizeTipoAtendimento(req.body.tipoAtendimento)
          : normalizeTipoAtendimento(req.body.tipo_atendimento),
      sectors:
        req.body.sectors !== undefined
          ? normalizeSectors(req.body.sectors)
          : req.body.sector !== undefined
            ? normalizeSectors(req.body.sector)
            : ['OPERACOES'],
      permissions:
        req.body.permissions !== undefined
          ? normalizePermissions(req.body.permissions)
          : DEFAULT_PERMISSIONS,
    };

    validateSectorsOrThrow(body.sectors);
    validatePermissionsOrThrow(body.permissions);

    const { error, value } = userSchema.validate(body, { stripUnknown: true });
    if (error) return bad(res, error.message);

    const exists = await User.findOne({ where: { email: value.email } });
    if (exists) return bad(res, 'E-mail já cadastrado');

    const createdUser = await User.create({
      ...value,
      sectors: body.sectors,
      permissions: body.permissions,
      cargoDescritivo: value.cargoDescritivo?.trim() || null,
      ocultarCargo: !!value.ocultarCargo,
      password_hash: value.password,
      loginEnabled: true,
    });

    const user = await User.findByPk(createdUser.id, {
      attributes: { exclude: ['password_hash'] },
      include: defaultIncludes,
    });

    return created(res, enrichUserPayload(user));
  } catch (err) {
    return bad(res, err.message || 'Erro ao criar usuário');
  }
}

async function createWorker(req, res) {
  try {
    const body = {
      ...req.body,
      tipoAtendimento:
        req.body.tipoAtendimento !== undefined
          ? normalizeTipoAtendimento(req.body.tipoAtendimento)
          : normalizeTipoAtendimento(req.body.tipo_atendimento),
      sectors:
        req.body.sectors !== undefined
          ? normalizeSectors(req.body.sectors)
          : req.body.sector !== undefined
            ? normalizeSectors(req.body.sector)
            : ['OPERACOES'],
      permissions:
        req.body.permissions !== undefined
          ? normalizePermissions(req.body.permissions)
          : DEFAULT_PERMISSIONS,
    };

    validateSectorsOrThrow(body.sectors);
    validatePermissionsOrThrow(body.permissions);

    const { error, value } = workerSchema.validate(body, { stripUnknown: true });
    if (error) return bad(res, error.message);

    const role = await Role.findByPk(value.roleId);
    if (!role) return bad(res, 'Cargo inválido');

    const rname = normRoleName(role.name);
    if (!WORKER_ALLOWED_ROLES.has(rname)) {
      return bad(res, 'Este endpoint aceita apenas Técnico, PSO, ATA, PRP ou SPOT');
    }

    let managerId = null;
    if (value.managerId != null) {
      const mgr = await User.findByPk(value.managerId);
      if (!mgr) return bad(res, 'Gestor informado não existe');
      managerId = value.managerId;
    }

    const user = await User.create({
      name: value.name,
      roleId: value.roleId,
      managerId,
      phone: value.phone || null,
      sectors: body.sectors,
      permissions: body.permissions,
      estoqueAvancado: value.estoqueAvancado ?? false,
      vendorCode: value.vendorCode || null,
      serviceAreaCode: value.serviceAreaCode || null,
      serviceAreaName: value.serviceAreaName || null,
      tipoAtendimento: value.tipoAtendimento || null,
      loginEnabled: false,
    });

    Object.assign(user, {
      addressStreet: value.addressStreet,
      addressNumber: value.addressNumber || '',
      addressComplement: value.addressComplement || '',
      addressDistrict: value.addressDistrict || '',
      addressCity: value.addressCity,
      addressState: value.addressState,
      addressZip: value.addressZip || '',
      addressCountry: value.addressCountry || 'Brasil',
      lat: value.lat,
      lng: value.lng,
    });

    await user.save();

    const populated = await User.findByPk(user.id, {
      attributes: { exclude: ['password_hash'] },
      include: defaultIncludes,
    });

    return created(res, enrichUserPayload(populated));
  } catch (err) {
    return bad(res, err.message || 'Erro ao criar colaborador');
  }
}

/* =========================
   ===== Estrutura (Org) ===
   ========================= */

const mapPerson = (u) => ({
  id: u.id,
  nome: u.name,
  cargo: u.ocultarCargo ? '—' : (u.cargoDescritivo || u.role?.name || '—'),
  avatarUrl: u.avatarUrl || null,
  sectors: Array.isArray(u.sectors) && u.sectors.length > 0 ? u.sectors : ['OPERACOES'],
  permissions: Array.isArray(u.permissions) && u.permissions.length > 0 ? u.permissions : DEFAULT_PERMISSIONS,
});

async function buildAcimaChain(userInstance) {
  const acima = [];
  let cursor = userInstance;

  while (cursor && cursor.managerId) {
    const gestor = await User.findByPk(cursor.managerId, {
      attributes: ['id', 'name', 'managerId', 'avatarUrl', 'sectors', 'permissions'],
      include: [{ model: Role, as: 'role', attributes: ['name'] }],
    });
    if (!gestor) break;
    acima.push(mapPerson(gestor));
    cursor = gestor;
  }
  return acima;
}

/* ======================
   ===== CRUD / Utils ===
   ====================== */

async function list(_req, res) {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password_hash'] },
      include: defaultIncludes,
      order: [['name', 'ASC']],
    });

    const payload = users.map((u) => enrichUserPayload(u));
    return ok(res, payload);
  } catch (err) {
    return bad(res, err.message || 'Erro ao listar usuários');
  }
}

async function listPublicSignupOptions(_req, res) {
  try {
    const [roles, users] = await Promise.all([
      Role.findAll({
        attributes: ['id', 'name', 'level'],
        order: [['level', 'ASC'], ['name', 'ASC']],
      }),
      User.findAll({
        where: { isActive: true },
        attributes: ['id', 'name', 'sectors', 'permissions'],
        include: [
          {
            model: Role,
            as: 'role',
            attributes: ['id', 'name', 'level'],
            required: false,
          },
        ],
        order: [['name', 'ASC']],
      }),
    ]);

    const managers = users
      .filter((u) => Number(u.role?.level || 0) >= 3)
      .map((u) => ({
        id: u.id,
        name: u.name,
        sectors: Array.isArray(u.sectors) && u.sectors.length > 0 ? u.sectors : ['OPERACOES'],
        permissions: Array.isArray(u.permissions) && u.permissions.length > 0 ? u.permissions : DEFAULT_PERMISSIONS,
        role: u.role
          ? {
              id: u.role.id,
              name: u.role.name,
              level: u.role.level,
            }
          : null,
      }));

    const payload = {
      roles: roles.map((r) => ({
        id: r.id,
        name: r.name,
        level: r.level,
      })),
      managers,
      availableSectors: VALID_SECTORS,
      availablePermissions: VALID_PERMISSIONS,
    };

    return ok(res, payload);
  } catch (err) {
    return bad(res, err.message || 'Erro ao carregar opções do pré-cadastro');
  }
}
async function changeMyPassword(req, res) {
  try {
    const { error, value } = changePasswordSchema.validate(req.body, { stripUnknown: true });
    if (error) return bad(res, error.message);

    const { currentPassword, newPassword, confirmNewPassword } = value;

    if (newPassword !== confirmNewPassword) {
      return bad(res, 'A confirmação da nova senha não confere');
    }

    if (currentPassword === newPassword) {
      return bad(res, 'A nova senha deve ser diferente da senha atual');
    }

    const user = await User.findByPk(req.user.id);
    if (!user) return notFound(res, 'Usuário não encontrado');

    if (!user.loginEnabled) {
      return bad(res, 'Este usuário não possui login habilitado');
    }

    const passwordOk = await user.checkPassword(currentPassword);
    if (!passwordOk) {
      return bad(res, 'Senha atual incorreta');
    }

    user.password_hash = newPassword;
    await user.save();

    return ok(res, { message: 'Senha alterada com sucesso' });
  } catch (err) {
    return bad(res, err.message || 'Erro ao alterar senha');
  }
}
async function listAdjustable(req, res) {
  try {
    const includeSelf = String(req.query.includeSelf ?? '1') !== '0';
    const me = req.user;
    const myLevel = me?.role?.level ?? 0;

    const all = await User.findAll({
      attributes: ['id', 'name', 'email', 'managerId', 'isActive', 'sectors', 'permissions'],
      include: [{ model: Role, as: 'role', attributes: ['id', 'name', 'level'] }],
      order: [['name', 'ASC']],
    });

    const active = all.filter((u) => u.isActive !== false);

    const childrenByMgr = new Map();
    for (const u of active) {
      const key = u.managerId || 0;
      if (!childrenByMgr.has(key)) childrenByMgr.set(key, []);
      childrenByMgr.get(key).push(u);
    }

    let result = [];

    if (myLevel >= 4) {
      result = active;
    } else if (myLevel >= 2) {
      const stack = [me.id];
      const ids = new Set();
      while (stack.length) {
        const id = stack.pop();
        const kids = childrenByMgr.get(id) || [];
        for (const k of kids) {
          if (!ids.has(k.id)) {
            ids.add(k.id);
            stack.push(k.id);
          }
        }
      }
      result = active.filter((u) => ids.has(u.id));
      if (includeSelf) {
        const myself = all.find((u) => u.id === me.id);
        if (myself) result.unshift(myself);
      }
    } else {
      if (includeSelf) {
        const myself = all.find((u) => u.id === me.id);
        if (myself) result = [myself];
      }
    }

    return ok(
      res,
      result.map((u) => ({
        id: u.id,
        name: u.name,
        sectors: Array.isArray(u.sectors) && u.sectors.length > 0 ? u.sectors : ['OPERACOES'],
        permissions: Array.isArray(u.permissions) && u.permissions.length > 0 ? u.permissions : DEFAULT_PERMISSIONS,
      }))
    );
  } catch (err) {
    return bad(res, err.message || 'Erro ao listar usuários ajustáveis');
  }
}

async function setManager(req, res) {
  try {
    const { id } = req.params;
    const { managerId } = req.body;

    const user = await User.findByPk(id);
    if (!user) return notFound(res, 'Usuário não encontrado');

    if (Number(managerId) === Number(user.id)) {
      return bad(res, 'Colaborador não pode ser gestor de si mesmo');
    }

    if (managerId) {
      const mgr = await User.findByPk(managerId);
      if (!mgr) return bad(res, 'Gestor informado não existe');
    }

    user.managerId = managerId ?? null;
    await user.save();

    const populated = await User.findByPk(user.id, {
      attributes: { exclude: ['password_hash'] },
      include: defaultIncludes,
    });

    return ok(res, enrichUserPayload(populated));
  } catch (err) {
    return bad(res, err.message || 'Erro ao definir gestor');
  }
}

async function update(req, res) {
  try {
    const { id } = req.params;

    const body = {
      ...req.body,
      tipoAtendimento:
        req.body.tipoAtendimento !== undefined
          ? normalizeTipoAtendimento(req.body.tipoAtendimento)
          : req.body.tipo_atendimento !== undefined
            ? normalizeTipoAtendimento(req.body.tipo_atendimento)
            : req.body.tipoAtendimento,
    };

    if (req.body.sectors !== undefined) {
      body.sectors = normalizeSectors(req.body.sectors);
    } else if (req.body.sector !== undefined) {
      body.sectors = normalizeSectors(req.body.sector);
    }

    if (req.body.permissions !== undefined) {
      body.permissions = normalizePermissions(req.body.permissions);
    }

    if (body.sectors !== undefined) {
      validateSectorsOrThrow(body.sectors);
    }

    if (body.permissions !== undefined) {
      validatePermissionsOrThrow(body.permissions);
    }

    const { error, value } = updateSchema.validate(body, { stripUnknown: true });
    if (error) return bad(res, error.message);

    const user = await User.findByPk(id);
    if (!user) return notFound(res, 'Usuário não encontrado');

    if (value.email && value.email !== user.email) {
      const clash = await User.findOne({ where: { email: value.email } });
      if (clash) return bad(res, 'E-mail já cadastrado');
    }

    if (Number(value.managerId) === Number(user.id)) {
      return bad(res, 'Colaborador não pode ser gestor de si mesmo');
    }

    if (value.password) {
      user.password_hash = value.password;
      delete value.password;
    }

    if ('lat' in value) {
      value.lat = value.lat === '' || value.lat === undefined ? null : Number(value.lat);
    }

    if ('lng' in value) {
      value.lng = value.lng === '' || value.lng === undefined ? null : Number(value.lng);
    }
    if ('cargoDescritivo' in value) {
      value.cargoDescritivo = value.cargoDescritivo?.trim() || null;
    }

    if ('ocultarCargo' in value) {
      value.ocultarCargo = !!value.ocultarCargo;
    }
    Object.assign(user, value);
    await user.save();

    const populated = await User.findByPk(user.id, {
      attributes: { exclude: ['password_hash'] },
      include: defaultIncludes,
    });

    return ok(res, enrichUserPayload(populated));
  } catch (err) {
    return bad(res, err.message || 'Erro ao atualizar usuário');
  }
}

async function uploadAvatar(req, res) {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) return notFound(res, 'Usuário não encontrado');
    if (!req.file) return bad(res, 'Arquivo não enviado');

    user.avatarUrl = `${baseUrl}/uploads/avatars/${req.file.filename}`;
    await user.save();

    return ok(res, { avatarUrl: user.avatarUrl });
  } catch (err) {
    return bad(res, err.message || 'Erro ao enviar avatar');
  }
}

async function listProviders(req, res) {
  try {
    const q = String(req.query.q || '').trim();

    const rows = await User.findAll({
      attributes: ['id', 'name', 'email', 'sectors', 'permissions'],
      include: [
        {
          model: Role,
          as: 'role',
          attributes: [],
          where: { level: 1 },
          required: true,
        },
      ],
      where: {
        isActive: true,
        ...(q
          ? {
              name: {
                [Op.like]: `%${q}%`,
              },
            }
          : {}),
      },
      order: [['name', 'ASC']],
      limit: q ? 20 : 200,
    });

    return ok(
      res,
      rows.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        sectors: Array.isArray(u.sectors) && u.sectors.length > 0 ? u.sectors : ['OPERACOES'],
        permissions: Array.isArray(u.permissions) && u.permissions.length > 0 ? u.permissions : DEFAULT_PERMISSIONS,
      }))
    );
  } catch (err) {
    return bad(res, err.message || 'Erro ao listar prestadores');
  }
}

async function updateAddress(req, res) {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) return notFound(res, 'Usuário não encontrado');

    const { error, value } = addressSchema.validate(req.body, { stripUnknown: true });
    if (error) return bad(res, error.message);

    const addr = { ...value };
    let coords = null;

    if (addr.autoGeocode) {
      const query = buildAddressString(addr);
      try {
        coords = await geocodeNominatim(query);
      } catch (_) {}
    }

    Object.assign(user, addr);
    if (coords) {
      user.lat = coords.lat;
      user.lng = coords.lng;
    }

    await user.save();

    const populated = await User.findByPk(user.id, {
      attributes: { exclude: ['password_hash'] },
      include: defaultIncludes,
    });

    return ok(res, enrichUserPayload(populated));
  } catch (err) {
    return bad(res, err.message || 'Erro ao atualizar endereço');
  }
}

async function listMyTeam(req, res) {
  try {
    const users = await User.findAll({
      attributes: ['id', 'name', 'email', 'managerId', 'sectors', 'permissions'],
      include: [{ model: Role, as: 'role', attributes: ['id', 'name', 'level'] }],
      order: [['name', 'ASC']],
    });

    const byMgr = new Map();
    for (const u of users) {
      if (!byMgr.has(u.managerId)) byMgr.set(u.managerId, []);
      byMgr.get(u.managerId).push(u);
    }

    const result = [];
    const q = [req.user.id];
    const seen = new Set(q);

    while (q.length) {
      const mgrId = q.shift();
      const children = byMgr.get(mgrId) || [];
      for (const kid of children) {
        if (!seen.has(kid.id)) {
          seen.add(kid.id);
          result.push(kid);
          q.push(kid.id);
        }
      }
    }

    return ok(
      res,
      result.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        managerId: u.managerId,
        sectors: Array.isArray(u.sectors) && u.sectors.length > 0 ? u.sectors : ['OPERACOES'],
        permissions: Array.isArray(u.permissions) && u.permissions.length > 0 ? u.permissions : DEFAULT_PERMISSIONS,
        role: u.role ? { id: u.role.id, name: u.role.name, level: u.role.level } : null,
      }))
    );
  } catch (err) {
    return bad(res, err.message || 'Erro ao listar equipe');
  }
}

async function listTechnicians(req, res) {
  try {
    const activeOnly = String(req.query.activeOnly ?? '1') !== '0';
    const q = String(req.query.q || '').trim();

    const whereUser = {};
    if (activeOnly) whereUser.isActive = { [Op.ne]: false };

    if (q) {
      whereUser.name = { [Op.like]: `%${q}%` };
    }

    const roleNames = ['TECNICO', 'TÉCNICO', 'PSO', 'ATA', 'PRP', 'SPOT'];

    const rows = await User.findAll({
      where: whereUser,
      attributes: [
        'id',
        'name',
        'avatarUrl',
        'managerId',
        'isActive',
        'estoqueAvancado',
        'vendorCode',
        'serviceAreaCode',
        'serviceAreaName',
        'tipoAtendimento',
        'sectors',
        'permissions',
      ],
      include: [
        {
          model: Role,
          as: 'role',
          attributes: ['id', 'name', 'level'],
          where: {
            [Op.or]: [
              { name: { [Op.in]: roleNames } },
              { name: { [Op.like]: '%Tecnico%' } },
              { name: { [Op.like]: '%Técnico%' } },
              { name: { [Op.like]: '%PRP%' } },
            ],
          },
          required: true,
        },
      ],
      order: [['name', 'ASC']],
    });

    return ok(
      res,
      rows.map((u) => ({
        id: u.id,
        name: u.name,
        avatarUrl: u.avatarUrl || null,
        managerId: u.managerId ?? null,
        isActive: u.isActive !== false,
        estoqueAvancado: !!u.estoqueAvancado,
        vendorCode: u.vendorCode ?? null,
        serviceAreaCode: u.serviceAreaCode ?? null,
        serviceAreaName: u.serviceAreaName ?? null,
        tipoAtendimento: u.tipoAtendimento ?? null,
        tipoAtendimentoDescricao: getTipoAtendimentoDescricao(u.tipoAtendimento),
        sectors: Array.isArray(u.sectors) && u.sectors.length > 0 ? u.sectors : ['OPERACOES'],
        permissions: Array.isArray(u.permissions) && u.permissions.length > 0 ? u.permissions : DEFAULT_PERMISSIONS,
        role: u.role ? { id: u.role.id, name: u.role.name, level: u.role.level } : null,
      }))
    );
  } catch (err) {
    return bad(res, err.message || 'Erro ao listar técnicos');
  }
}
async function getMyProfile(req, res) {
  try {
    const user = await User.findByPk(req.user.id, { include: USER_INCLUDE });

    if (!user) return notfound(res, 'Usuário não encontrado');

    return ok(res, serializeUser(user));
  } catch (err) {
    return bad(res, err.message || 'Erro ao carregar perfil');
  }
}

async function getMyProfile(req, res) {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password_hash'] },
      include: USER_INCLUDE,
    });

    if (!user) return notFound(res, 'Usuário não encontrado');

    return ok(res, serializeUser(user));
  } catch (err) {
    return bad(res, err.message || 'Erro ao carregar perfil');
  }
}

async function updateMyProfile(req, res) {
  try {
    const schema = Joi.object({
      phone: Joi.string().allow('', null),
    });

    const { error, value } = schema.validate(req.body, { stripUnknown: true });
    if (error) return bad(res, error.message);

    const user = await User.findByPk(req.user.id);
    if (!user) return notFound(res, 'Usuário não encontrado');

    user.phone = value.phone || null;
    await user.save();

    const refreshed = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password_hash'] },
      include: USER_INCLUDE,
    });

    return ok(res, serializeUser(refreshed));
  } catch (err) {
    return bad(res, err.message || 'Erro ao atualizar perfil');
  }
}

async function uploadMyAvatar(req, res) {
  try {
    if (!req.file) return bad(res, 'Arquivo não enviado');

    const user = await User.findByPk(req.user.id);
    if (!user) return notFound(res, 'Usuário não encontrado');

    user.avatarUrl = `${baseUrl}/uploads/avatars/${req.file.filename}`;
    await user.save();

    const refreshed = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password_hash'] },
      include: USER_INCLUDE,
    });

    return ok(res, serializeUser(refreshed));
  } catch (err) {
    return bad(res, err.message || 'Erro ao enviar avatar');
  }
}
async function mapTechs(req, res) {
  try {
    const onlyGeocoded = String(req.query.onlyGeocoded ?? '1') !== '0';
    const activeOnly = String(req.query.activeOnly ?? '1') !== '0';

    const supervisorId = req.query.supervisorId ? Number(req.query.supervisorId) : undefined;
    const coordinatorId = req.query.coordinatorId ? Number(req.query.coordinatorId) : undefined;

    const includeTech = String(req.query.includeTech ?? '1') !== '0';
    const includePSO = String(req.query.includePSO ?? '1') !== '0';
    const includeATA = String(req.query.includeATA ?? '1') !== '0';
    const includeSpot = String(req.query.includeSPOT ?? '1') !== '0';
    const includePRP = String(req.query.includePRP ?? '1') !== '0';

    const users = await User.findAll({
      attributes: [
        'id',
        'name',
        'email',
        'managerId',
        'isActive',
        'lat',
        'lng',
        'estoqueAvancado',
        'vendorCode',
        'serviceAreaCode',
        'serviceAreaName',
        'tipoAtendimento',
        'sectors',
        'permissions',
      ],
      include: [{ model: Role, as: 'role', attributes: ['id', 'name', 'level'] }],
      order: [['name', 'ASC']],
    });

    const byId = new Map(users.map((u) => [u.id, u]));

    let allowedDownline = null;
    if (supervisorId) {
      allowedDownline = new Set();
      const stack = [supervisorId];
      while (stack.length) {
        const mgr = stack.pop();
        for (const u of users) {
          if (u.managerId === mgr && !allowedDownline.has(u.id)) {
            allowedDownline.add(u.id);
            stack.push(u.id);
          }
        }
      }
    }

    function findUpstream(user, minLevel) {
      let cur = user;
      while (cur && cur.managerId) {
        const mgr = byId.get(cur.managerId);
        if (!mgr) break;
        if ((mgr.role?.level || 0) >= minLevel) return mgr;
        cur = mgr;
      }
      return null;
    }

    const items = [];
    for (const u of users) {
      if (activeOnly && !u.isActive) continue;
      if (onlyGeocoded && !(u.lat != null && u.lng != null)) continue;

      const kind = roleKindFromRoleName(u.role?.name);

      if (kind === 'TECH' && !includeTech) continue;
      if (kind === 'PSO' && !includePSO) continue;
      if (kind === 'ATA' && !includeATA) continue;
      if (kind === 'SPOT' && !includeSpot) continue;
      if (kind === 'PRP' && !includePRP) continue;

      const allowedKinds = new Set(['TECH', 'PSO', 'ATA', 'SPOT', 'PRP']);
      if (!allowedKinds.has(kind)) continue;

      if (allowedDownline && !allowedDownline.has(u.id)) continue;

      const supervisor = findUpstream(u, 3);
      const coordinator = findUpstream(u, 4);

      if (coordinatorId && (!coordinator || coordinator.id !== coordinatorId)) continue;

      items.push({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role ? { id: u.role.id, name: u.role.name, level: u.role.level } : null,
        lat: u.lat,
        lng: u.lng,
        estoqueAvancado: !!u.estoqueAvancado,
        vendorCode: u.vendorCode ?? null,
        serviceAreaCode: u.serviceAreaCode ?? null,
        serviceAreaName: u.serviceAreaName ?? null,
        tipoAtendimento: u.tipoAtendimento ?? null,
        tipoAtendimentoDescricao: getTipoAtendimentoDescricao(u.tipoAtendimento),
        sectors: Array.isArray(u.sectors) && u.sectors.length > 0 ? u.sectors : ['OPERACOES'],
        permissions: Array.isArray(u.permissions) && u.permissions.length > 0 ? u.permissions : DEFAULT_PERMISSIONS,
        supervisor: supervisor ? { id: supervisor.id, name: supervisor.name } : null,
        coordinator: coordinator ? { id: coordinator.id, name: coordinator.name } : null,
        kind,
      });
    }

    const supervisors = [];
    const supSeen = new Set();
    const coordinators = [];
    const corSeen = new Set();

    for (const it of items) {
      if (it.supervisor && !supSeen.has(it.supervisor.id)) {
        supSeen.add(it.supervisor.id);
        supervisors.push(it.supervisor);
      }
      if (it.coordinator && !corSeen.has(it.coordinator.id)) {
        corSeen.add(it.coordinator.id);
        coordinators.push(it.coordinator);
      }
    }

    return ok(res, { items, supervisors, coordinators });
  } catch (err) {
    return bad(res, err.message || 'Erro ao montar mapa de técnicos');
  }
}

async function getStructure(req, res) {
  try {
    const { id } = req.params;
    const deep = ['1', 'true', 'yes'].includes(String(req.query.deep || '').toLowerCase());

    const user = await User.findByPk(id, {
      attributes: ['id', 'name', 'managerId', 'isActive', 'avatarUrl', 'sectors', 'permissions'],
      include: [{ model: Role, as: 'role', attributes: ['name'] }],
    });
    if (!user) return notFound(res, 'Usuário não encontrado');

    const acima = await buildAcimaChain(user);

    const users = await User.findAll({
      attributes: ['id', 'name', 'email', 'managerId', 'isActive', 'avatarUrl', 'sectors', 'permissions'],
      include: [{ model: Role, as: 'role', attributes: ['id', 'name', 'level'] }],
      order: [['name', 'ASC']],
    });

    const byMgr = new Map();
    for (const u of users) {
      const key = u.managerId ?? 0;
      if (!byMgr.has(key)) byMgr.set(key, []);
      byMgr.get(key).push(u);
    }

    const mapPersonLocal = (u) => ({
      id: u.id,
      nome: u.name,
      cargo: u.ocultarCargo ? '—' : (u.cargoDescritivo || u.role?.name || '—'),
      avatarUrl: u.avatarUrl || null,
      sectors: Array.isArray(u.sectors) && u.sectors.length > 0 ? u.sectors : ['OPERACOES'],
      permissions: Array.isArray(u.permissions) && u.permissions.length > 0 ? u.permissions : DEFAULT_PERMISSIONS,
    });

    let abaixo = [];

    if (!deep) {
      const diretos = byMgr.get(user.id) || [];
      abaixo = diretos.map(mapPersonLocal);
    } else {
      const stack = [...(byMgr.get(user.id) || [])];
      const seen = new Set();

      while (stack.length) {
        const cur = stack.shift();
        if (!cur || seen.has(cur.id)) continue;
        seen.add(cur.id);
        abaixo.push(mapPersonLocal(cur));

        const filhos = byMgr.get(cur.id) || [];
        stack.push(...filhos);
      }
    }

    return ok(res, {
      acima,
      atual: mapPersonLocal(user),
      abaixo,
    });
  } catch (err) {
    return bad(res, err.message || 'Erro ao montar estrutura');
  }
}

module.exports = {
  create,
  list,
  update,
  setManager,
  uploadAvatar,
  updateAddress,
  listProviders,
  createWorker,
  mapTechs,
  listTechnicians,
  listAdjustable,
  listMyTeam,
  getStructure,
  cepLookup,
  listPublicSignupOptions,
  changeMyPassword,
  getMyProfile,
  updateMyProfile,
  uploadMyAvatar,
};