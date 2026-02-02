/* src/controllers/userController.js */
/* global fetch */
const Joi = require('joi');
const { User, Role, Location } = require('../models');
const { ok, created, bad, notFound } = require('../utils/responses');
const { Op } = require('sequelize');

/* ======================
   ====== CONSTANTES =====
   ====================== */
const baseUrl = process.env.BASE_URL || 'https://api.projetos-rc.online';

const defaultIncludes = [
  { model: Role, as: 'role', attributes: ['id', 'name', 'level'] },
  { model: User, as: 'manager', attributes: ['id', 'name', 'avatarUrl'] },
  { model: Location, as: 'location' },
];

/* ======================
   ====== SCHEMAS =======
   ====================== */

// Cadastro de técnico/PSO (sem login/senha)
const workerSchema = Joi.object({
  name: Joi.string().required(),
  phone: Joi.string().allow('', null),

  // cargo: apenas Técnico/Tecnico ou PSO
  roleId: Joi.number().required(),
  managerId: Joi.number().allow(null), // gestor opcional

  vendorCode: Joi.string().allow('', null),
  serviceAreaCode: Joi.string().allow('', null),
  serviceAreaName: Joi.string().allow('', null),

  // endereço obrigatório
  addressStreet: Joi.string().required(),
  addressNumber: Joi.string().allow(''),
  addressComplement: Joi.string().allow(''),
  addressDistrict: Joi.string().allow(''),
  addressCity: Joi.string().required(),
  addressState: Joi.string().required(),
  addressZip: Joi.string().allow(''),
  addressCountry: Joi.string().default('Brasil'),

  // coordenadas obrigatórias
  lat: Joi.number().required(),
  lng: Joi.number().required(),
});

// Cadastro de usuário com login
const userSchema = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  sex: Joi.string().valid('M', 'F', 'O').optional(),
  roleId: Joi.number().required(),
  managerId: Joi.number().allow(null),
  locationId: Joi.number().allow(null),
  phone: Joi.string().allow('', null),
  vendorCode: Joi.string().allow('', null),
  serviceAreaCode: Joi.string().allow('', null),
  serviceAreaName: Joi.string().allow('', null),
});

// Atualização
const updateSchema = Joi.object({
  name: Joi.string(),
  email: Joi.string().email(),
  password: Joi.string().min(6),
  sex: Joi.string().valid('M','F','O'),
  roleId: Joi.number(),
  managerId: Joi.number().allow(null),
  locationId: Joi.number().allow(null),
  isActive: Joi.boolean(),

  // extras cadastrais
  phone: Joi.string().allow('', null),
  vendorCode: Joi.string().allow('', null),
  serviceAreaCode: Joi.string().allow('', null),
  serviceAreaName: Joi.string().allow('', null),

  // endereço + coords (opcionais)
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

// Endereço (para PATCH /address)
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

/* =============================
   ===== Helpers de endereço ===
   ============================= */
function buildAddressString(v) {
  return [
    `${v.addressStreet || ''} ${v.addressNumber || ''}`.trim(),
    v.addressDistrict, v.addressCity, v.addressState, v.addressZip, v.addressCountry || 'Brasil',
  ].filter(Boolean).join(', ');
}

async function geocodeNominatim(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'operacoes-app/1.0 (contato@empresa.com)' } });
  if (!res.ok) throw new Error('Geocoding error');
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  const { lat, lon } = data[0];
  return { lat: Number(lat), lng: Number(lon) };
}

// ViaCEP (autocomplete por CEP)
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

/* ======================
   ===== Controllers ====
   ====================== */

// Cria usuário COM login
async function create(req, res) {
  const { error, value } = userSchema.validate(req.body, { stripUnknown: true });
  if (error) return bad(res, error.message);

  const exists = await User.findOne({ where: { email: value.email } });
  if (exists) return bad(res, 'E-mail já cadastrado');

  const createdUser = await User.create({
    ...value,
    password_hash: value.password, // hook beforeCreate faz hash se presente
    loginEnabled: true,
  });

  const user = await User.findByPk(createdUser.id, {
    attributes: { exclude: ['password_hash'] },
    include: defaultIncludes,
  });
  return created(res, user);
}

// Cria TÉCNICO/PSO (SEM login/senha)
async function createWorker(req, res) {
  const { error, value } = workerSchema.validate(req.body, { stripUnknown: true });
  if (error) return bad(res, error.message);

  const role = await Role.findByPk(value.roleId);
  if (!role) return bad(res, 'Cargo inválido');

  // normaliza: aceita "Técnico", "Tecnico" ou "PSO"
  const norm = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const rname = norm(role.name);
  if (!['tecnico', 'pso'].includes(rname)) {
    return bad(res, 'Este endpoint aceita apenas Técnico ou PSO');
  }

  // valida gestor, se enviado
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
    vendorCode: value.vendorCode || null,
    serviceAreaCode: value.serviceAreaCode || null,
    serviceAreaName: value.serviceAreaName || null,
    loginEnabled: false, // <- sem e-mail/senha
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

  return created(res, populated);
}

/* =========================
   ===== Estrutura (Org) ===
   ========================= */

const mapPerson = (u) => ({
  id: u.id,
  nome: u.name,
  cargo: u.role?.name || '—',
  avatarUrl: u.avatarUrl || null,
});

async function buildAcimaChain(userInstance) {
  const acima = [];
  let cursor = userInstance;

  while (cursor && cursor.managerId) {
    const gestor = await User.findByPk(cursor.managerId, {
      attributes: ['id', 'name', 'managerId', 'avatarUrl'],
      include: [{ model: Role, as: 'role', attributes: ['name'] }],
    });
    if (!gestor) break;
    acima.push(mapPerson(gestor));
    cursor = gestor;
  }
  return acima; // ordem: gestor imediato -> topo
}

async function buildAbaixoList(userId, deep = false) {
  const diretos = await User.findAll({
    where: { managerId: userId },
    attributes: ['id', 'name', 'avatarUrl'],
    include: [{ model: Role, as: 'role', attributes: ['name'] }],
    order: [['name', 'ASC']],
  });

  if (!deep) return diretos.map(mapPerson);

  const fila = [...diretos];
  const resultado = [];

  while (fila.length) {
    const atual = fila.shift();
    resultado.push(mapPerson(atual));

    const filhos = await User.findAll({
      where: { managerId: atual.id },
      attributes: ['id', 'name', 'avatarUrl'],
      include: [{ model: Role, as: 'role', attributes: ['name'] }],
      order: [['name', 'ASC']],
    });
    fila.push(...filhos);
  }

  return resultado;
}

async function getStructure(req, res) {
  try {
    const { id } = req.params;
    const deep = ['1', 'true', 'yes'].includes(String(req.query.deep || '').toLowerCase());
    const depth = Number(req.query.depth ?? (deep ? 99 : 1)); // deep sem depth => sem limite

    const user = await User.findByPk(id, {
      attributes: ['id', 'name', 'managerId', 'isActive', 'avatarUrl'],
      include: [{ model: Role, as: 'role', attributes: ['name'] }],
    });
    if (!user) return notFound(res, 'Usuário não encontrado');

    const [acima, tree] = await Promise.all([
      buildAcimaChain(user),
      buildTree(user.id, depth),
    ]);

    // lista achatada (compatível com seu front atual)
    const abaixo = flattenTree(tree.children);

    return ok(res, {
      acima,
      atual: mapPerson(user),
      abaixo,     // lista "flat" como você já usa
      tree,       // ✅ NOVO: árvore para organograma real
    });
  } catch (err) {
    return bad(res, err.message || 'Erro ao montar estrutura');
  }
}


/* ======================
   ===== CRUD / Utils ===
   ====================== */

async function list(_req, res) {
  const users = await User.findAll({
    attributes: { exclude: ['password_hash'] },
    include: defaultIncludes,
    order: [['name', 'ASC']],
  });
  return ok(res, users);
}

async function listAdjustable(req, res) {
  const includeSelf = String(req.query.includeSelf ?? '1') !== '0';
  const me = req.user;
  const myLevel = me?.role?.level ?? 0;

  const all = await User.findAll({
    attributes: ['id', 'name', 'email', 'managerId', 'isActive'],
    include: [{ model: Role, as: 'role', attributes: ['id', 'name', 'level'] }],
    order: [['name', 'ASC']],
  });

  const active = all.filter(u => u.isActive !== false);

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
        if (!ids.has(k.id)) { ids.add(k.id); stack.push(k.id); }
      }
    }
    result = active.filter(u => ids.has(u.id));
    if (includeSelf) {
      const myself = all.find(u => u.id === me.id);
      if (myself) result.unshift(myself);
    }
  } else {
    if (includeSelf) {
      const myself = all.find(u => u.id === me.id);
      if (myself) result = [myself];
    }
  }

  return ok(res, result.map(u => ({ id: u.id, name: u.name })));
}

async function setManager(req, res) {
  const { id } = req.params;
  const { managerId } = req.body;

  const user = await User.findByPk(id);
  if (!user) return notFound(res, 'Usuário não encontrado');

  if (managerId === user.id) return bad(res, 'Colaborador não pode ser gestor de si mesmo');

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
  return ok(res, populated);
}

async function update(req, res) {
  const { id } = req.params;
  const { error, value } = updateSchema.validate(req.body);
  if (error) return bad(res, error.message);

  const user = await User.findByPk(id);
  if (!user) return notFound(res, 'Usuário não encontrado');

  if (value.email && value.email !== user.email) {
    const clash = await User.findOne({ where: { email: value.email } });
    if (clash) return bad(res, 'E-mail já cadastrado');
  }
  if (value.managerId === user.id) return bad(res, 'Colaborador não pode ser gestor de si mesmo');

  // senha
  if (value.password) {
    user.password_hash = value.password;
    delete value.password;
  }

  // garanta tipo numérico ou null para DECIMAL
  if ('lat' in value) value.lat = value.lat === '' || value.lat === undefined ? null : Number(value.lat);
  if ('lng' in value) value.lng = value.lng === '' || value.lng === undefined ? null : Number(value.lng);

  Object.assign(user, value);
  await user.save();

  const populated = await User.findByPk(user.id, {
    attributes: { exclude: ['password_hash'] },
    include: defaultIncludes,
  });
  return ok(res, populated);
}

async function uploadAvatar(req, res) {
  const { id } = req.params;
  const user = await User.findByPk(id);
  if (!user) return notFound(res, 'Usuário não encontrado');
  if (!req.file) return bad(res, 'Arquivo não enviado');

  user.avatarUrl = `${baseUrl}/uploads/avatars/${req.file.filename}`;
  await user.save();

  return ok(res, { avatarUrl: user.avatarUrl });
}

async function updateAddress(req, res) {
  const { id } = req.params;
  const user = await User.findByPk(id);
  if (!user) return notFound(res, 'Usuário não encontrado');

  const { error, value } = addressSchema.validate(req.body, { stripUnknown: true });
  if (error) return bad(res, error.message);

  const addr = { ...value };
  let coords = null;

  if (addr.autoGeocode) {
    const query = buildAddressString(addr);
    try { coords = await geocodeNominatim(query); } catch (_) {}
  }

  Object.assign(user, addr);
  if (coords) { user.lat = coords.lat; user.lng = coords.lng; }
  await user.save();

  const populated = await User.findByPk(user.id, {
    attributes: { exclude: ['password_hash'] },
    include: defaultIncludes,
  });
  return ok(res, populated);
}

async function listMyTeam(req, res) {
  const users = await User.findAll({
    attributes: ['id', 'name', 'email', 'managerId'],
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

  return ok(res, result);
}
async function listTechnicians(req, res) {
  const activeOnly = String(req.query.activeOnly ?? '1') !== '0';
  const q = String(req.query.q || '').trim();

  const whereUser = {};
  if (activeOnly) whereUser.isActive = { [Op.ne]: false };

  if (q) {
    whereUser.name = { [Op.like]: `%${q}%` };
  }

  // normaliza nome do role sem acento
  const roleNames = ['TECNICO', 'TÉCNICO', 'PSO'];

  const rows = await User.findAll({
    where: whereUser,
    attributes: ['id', 'name', 'avatarUrl', 'managerId', 'isActive'],
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
            { name: 'PSO' },
          ],
        },
        required: true,
      },''
    ],
    order: [['name', 'ASC']],
  });

  return ok(res, rows.map(u => ({
    id: u.id,
    name: u.name,
    avatarUrl: u.avatarUrl || null,
    managerId: u.managerId ?? null,
    isActive: u.isActive !== false,
    role: u.role ? { id: u.role.id, name: u.role.name, level: u.role.level } : null,
  })));
}

async function mapTechs(req, res) {
  // flags
  const onlyGeocoded = String(req.query.onlyGeocoded ?? '1') !== '0';
  const activeOnly   = String(req.query.activeOnly ?? '1') !== '0';

  // filtros opcionais
  const supervisorId   = req.query.supervisorId ? Number(req.query.supervisorId) : undefined;
  const coordinatorId  = req.query.coordinatorId ? Number(req.query.coordinatorId) : undefined;

  // quais grupos incluir
  const includeTech = String(req.query.includeTech ?? '1') !== '0';
  const includePSO  = String(req.query.includePSO ?? '1') !== '0';

  // carrega todo mundo de uma vez (leve)
  const users = await User.findAll({
    attributes: ['id','name','email','managerId','isActive','lat','lng'],
    include: [{ model: Role, as: 'role', attributes: ['id','name','level'] }],
    order: [['name','ASC']],
  });

  const byId = new Map(users.map(u => [u.id, u]));

  // Se foi informado supervisorId, criamos o conjunto de IDs do "downline" (subárvore) dele
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

  // helpers pra subir na cadeia e achar primeiro com minLevel (2=Supervisor, 3=Coordenador)
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

  // classifica "tipo" para separar no front
  function roleKind(u) {
    const name = (u.role?.name || '').toUpperCase();
    if (name === 'PSO') return 'PSO';
    if ((u.role?.level || 0) === 1) return 'TECH';
    return 'OTHER';
  }

  const items = [];
  for (const u of users) {
    if (activeOnly && !u.isActive) continue;
    if (onlyGeocoded && !(u.lat != null && u.lng != null)) continue;

    const kind = roleKind(u);
    if (kind === 'TECH' && !includeTech) continue;
    if (kind === 'PSO'  && !includePSO)  continue;
    if (!(kind === 'TECH' || kind === 'PSO')) continue;

    // restringe ao downline do supervisor (se passado)
    if (allowedDownline && !allowedDownline.has(u.id)) continue;

    const supervisor = findUpstream(u, 3);
    const coordinator = findUpstream(u, 4);

    // filtrar por coordenador específico, se pedido
    if (coordinatorId && (!coordinator || coordinator.id !== coordinatorId)) continue;

    items.push({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role ? { id: u.role.id, name: u.role.name, level: u.role.level } : null,
      lat: u.lat,
      lng: u.lng,
      supervisor: supervisor ? { id: supervisor.id, name: supervisor.name } : null,
      coordinator: coordinator ? { id: coordinator.id, name: coordinator.name } : null,
      kind, // 'TECH' | 'PSO'
    });
  }

  // listas únicas pra popular filtros
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
}

module.exports = {
  // CRUD
  create,
  list,
  update,
  setManager,
  uploadAvatar,
  updateAddress,

  // Técnicos/PSO
  createWorker,
  mapTechs,
  listTechnicians,
  // Estrutura
  listAdjustable,
  listMyTeam,
  getStructure,

  // CEP
  cepLookup,
};
