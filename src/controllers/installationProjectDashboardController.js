const { Op } = require('sequelize');
const dayjs = require('dayjs');

const {
  InstallationProject,
  InstallationProjectItem,
  InstallationProjectProgress,
  InstallationProjectProgressVehicle,
  Client,
  User,
} = require('../models');

const { ok, bad } = require('../utils/responses');

// ======================================================
// Helpers
// ======================================================

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }

  const normalized = String(value).trim().replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : fallback;
}

function toDecimal(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }

  const normalized = String(value).trim().replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : fallback;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeIdList(input) {
  let arr = input;

  if (!arr) return [];

  if (typeof arr === 'string') {
    const trimmed = arr.trim();
    if (!trimmed) return [];

    try {
      arr = JSON.parse(trimmed);
    } catch {
      arr = trimmed.split(',').map((v) => v.trim());
    }
  }

  if (!Array.isArray(arr)) {
    arr = [arr];
  }

  return [
    ...new Set(
      arr
        .map((v) => Number(v))
        .filter((v) => Number.isInteger(v) && v > 0)
    ),
  ];
}

function parseDate(value) {
  if (!value) return null;
  const d = dayjs(String(value).slice(0, 10), 'YYYY-MM-DD', true);
  return d.isValid() ? d.format('YYYY-MM-DD') : null;
}

function dateOnly(value) {
  if (!value) return null;
  return dayjs(value).format('YYYY-MM-DD');
}

function overlapPeriod(startA, endA, startB, endB) {
  const a1 = startA ? dayjs(startA) : null;
  const a2 = endA ? dayjs(endA) : null;
  const b1 = startB ? dayjs(startB) : null;
  const b2 = endB ? dayjs(endB) : null;

  if (!b1 && !b2) return true;

  const left = a1 || a2;
  const right = a2 || a1;

  if (!left && !right) return true;

  const rangeAStart = a1 || right;
  const rangeAEnd = a2 || left;

  const rangeBStart = b1 || b2;
  const rangeBEnd = b2 || b1;

  return !rangeAEnd.isBefore(rangeBStart, 'day') && !rangeAStart.isAfter(rangeBEnd, 'day');
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function normalizeCity(value) {
  return normalizeText(value).replace(/--+/g, '').trim();
}

function normalizeUF(value) {
  const uf = normalizeText(value).replace(/[^A-Z]/g, '');

  const aliases = {
    SA: 'SP',
    SAA: 'SP',
    SPS: 'SP',
    SPO: 'SP',
    SPA: 'SP',
    RI: 'RS',
    RIO: 'RJ',
    PA: 'PR', // usado como correção prática para casos como COLOMBO
  };

  if (aliases[uf]) return aliases[uf];

  const validUFs = new Set([
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
    'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
    'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
  ]);

  if (validUFs.has(uf)) return uf;

  return '';
}

function getMacroRegion(uf) {
  const value = normalizeUF(uf);

  const map = {
    AC: 'Norte',
    AP: 'Norte',
    AM: 'Norte',
    PA: 'Norte',
    RO: 'Norte',
    RR: 'Norte',
    TO: 'Norte',

    AL: 'Nordeste',
    BA: 'Nordeste',
    CE: 'Nordeste',
    MA: 'Nordeste',
    PB: 'Nordeste',
    PE: 'Nordeste',
    PI: 'Nordeste',
    RN: 'Nordeste',
    SE: 'Nordeste',

    DF: 'Centro-Oeste',
    GO: 'Centro-Oeste',
    MT: 'Centro-Oeste',
    MS: 'Centro-Oeste',

    ES: 'Sudeste',
    MG: 'Sudeste',
    RJ: 'Sudeste',
    SP: 'Sudeste',

    PR: 'Sul',
    RS: 'Sul',
    SC: 'Sul',
  };

  return map[value] || 'Não informado';
}

function hasValidCoords(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat !== 0 &&
    lng !== 0 &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function mapProjectStatus(rawStatus) {
  const value = String(rawStatus || '').toUpperCase();

  if (value === 'A_INICIAR') return 'AGENDADO';
  if (value === 'INICIADO') return 'EM_ANDAMENTO';
  if (value === 'FINALIZADO') return 'CONCLUIDO';
  return 'NAO_INFORMADO';
}

function extractFailureReason(notes = '') {
  const txt = String(notes || '').toLowerCase();

  if (!txt) return null;
  if (txt.includes('cliente ausente')) return 'CLIENTE_AUSENTE';
  if (txt.includes('problema técnico') || txt.includes('problema tecnico')) return 'PROBLEMA_TECNICO';
  if (txt.includes('veículo indisponível') || txt.includes('veiculo indisponivel')) return 'VEICULO_INDISPONIVEL';
  if (txt.includes('reagend')) return 'REAGENDADO';
  if (txt.includes('cancel')) return 'CANCELADO';
  if (txt.includes('endereço incorreto') || txt.includes('endereco incorreto')) return 'ENDERECO_INCORRETO';

  return 'OUTROS';
}

function getProjectPlanned(project) {
  const items = safeArray(project.items);
  const itemsPlanned = items.reduce((sum, item) => sum + toNumber(item.qty, 0), 0);

  if (itemsPlanned > 0) return itemsPlanned;
  if (toNumber(project.equipmentsTotal, 0) > 0) return toNumber(project.equipmentsTotal, 0);
  if (toNumber(project.trucksTotal, 0) > 0) return toNumber(project.trucksTotal, 0);
  return 0;
}

function getProjectDone(project) {
  const progress = safeArray(project.progress);
  const byProgress = progress.reduce((sum, p) => sum + toNumber(p.trucksDoneToday, 0), 0);

  if (byProgress > 0) return byProgress;
  return toNumber(project.trucksDone, 0);
}

function getProjectPending(project) {
  const planned = getProjectPlanned(project);
  const done = getProjectDone(project);
  return Math.max(planned - done, 0);
}

function isDelayed(project, refDate = dayjs()) {
  const plannedEnd = project.endPlannedAt ? dayjs(project.endPlannedAt) : null;
  if (!plannedEnd) return false;
  if (String(project.status) === 'FINALIZADO') return false;
  return plannedEnd.isBefore(refDate, 'day');
}

// ======================================================
// Fallback de coordenadas por cidade/UF
// ======================================================

const CITY_UF_COORDS = {
  'PORTO VELHO__RO': { lat: -8.76194, lng: -63.90389 },
  'MANAUS__AM': { lat: -3.11903, lng: -60.02173 },
  'OSASCO__SP': { lat: -23.53289, lng: -46.79161 },
  'GUARULHOS__SP': { lat: -23.4538, lng: -46.5333 },
  'COLOMBO__PR': { lat: -25.2916, lng: -49.2242 },
  'SANTO ANTONIO DOS LOPES__MA': { lat: -4.8666, lng: -44.3653 },
  'SAO PAULO__SP': { lat: -23.55052, lng: -46.63331 },
  'TUPA__SP': { lat: -21.9347, lng: -50.5136 },
  'BARIRI__SP': { lat: -22.0731, lng: -48.7433 },
  'CAMPINAS__SP': { lat: -22.90556, lng: -47.06083 },
  'VALINHOS__SP': { lat: -22.97056, lng: -46.99583 },
  'JUNDIAI__SP': { lat: -23.1858, lng: -46.8978 },
  'SANTA CRUZ DO SUL__RS': { lat: -29.7174, lng: -52.4259 },
  'CURITIBA__PR': { lat: -25.4284, lng: -49.2733 },
  'RIO DE JANEIRO__RJ': { lat: -22.90685, lng: -43.1729 },
  'BELO HORIZONTE__MG': { lat: -19.9167, lng: -43.9345 },
};

function resolveProjectCoords(project) {
  const rawLat = toDecimal(project.client?.latitude, null);
  const rawLng = toDecimal(project.client?.longitude, null);

  if (hasValidCoords(rawLat, rawLng)) {
    return {
      lat: rawLat,
      lng: rawLng,
      city: normalizeCity(project.client?.cidade) || null,
      uf: normalizeUF(project.client?.estado) || null,
      source: 'client',
    };
  }

  const city = normalizeCity(project.client?.cidade);
  const uf = normalizeUF(project.client?.estado);
  const key = `${city}__${uf}`;

  if (CITY_UF_COORDS[key]) {
    return {
      lat: CITY_UF_COORDS[key].lat,
      lng: CITY_UF_COORDS[key].lng,
      city,
      uf,
      source: 'city_fallback',
    };
  }

  return null;
}

async function loadDashboardProjects(filters = {}) {
  const where = {};

  if (filters.clientId) where.clientId = Number(filters.clientId);
  if (filters.coordinatorId) where.coordinatorId = Number(filters.coordinatorId);

  if (filters.status) {
    const statuses = String(filters.status)
      .split(',')
      .map((v) => v.trim().toUpperCase())
      .filter(Boolean);

    if (statuses.length) {
      where.status = { [Op.in]: statuses };
    }
  }

  const projects = await InstallationProject.findAll({
    where,
    include: [
      {
        model: Client,
        as: 'client',
        required: false,
        attributes: [
          'id',
          'name',
          'nomeFantasia',
          'cidade',
          'estado',
          'latitude',
          'longitude',
        ],
      },
      {
        model: User,
        as: 'coordinator',
        required: false,
        attributes: ['id', 'name'],
      },
      {
        model: User,
        as: 'technician',
        required: false,
        attributes: ['id', 'name'],
      },
      {
        model: InstallationProjectItem,
        as: 'items',
        required: false,
        attributes: ['id', 'equipmentName', 'equipmentCode', 'qty'],
      },
      {
        model: InstallationProjectProgress,
        as: 'progress',
        required: false,
        attributes: ['id', 'date', 'trucksDoneToday', 'notes', 'createdById'],
        include: [
          {
            model: InstallationProjectProgressVehicle,
            as: 'vehicles',
            required: false,
            attributes: ['id', 'plate', 'serial'],
          },
        ],
      },
    ],
    order: [['id', 'DESC']],
  });

  const raw = projects.map((p) => p.toJSON());

  const allTechnicianIds = [
    ...new Set(
      raw.flatMap((project) =>
        normalizeIdList(
          safeArray(project.technicianIds).length ? project.technicianIds : project.technicianId
        )
      )
    ),
  ];

  let techniciansById = new Map();

  if (allTechnicianIds.length) {
    const technicians = await User.findAll({
      where: { id: { [Op.in]: allTechnicianIds } },
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
    });

    techniciansById = new Map(technicians.map((t) => [t.id, t.name]));
  }

  let rows = raw.map((project) => {
    const technicianIds = normalizeIdList(
      safeArray(project.technicianIds).length ? project.technicianIds : project.technicianId
    );

    const technicianNames = technicianIds
      .map((id) => techniciansById.get(id))
      .filter(Boolean);

    return {
      ...project,
      technicianIdsNormalized: technicianIds,
      technicianNames,
    };
  });

  if (filters.technicianId) {
    const technicianId = Number(filters.technicianId);
    rows = rows.filter((p) => p.technicianIdsNormalized.includes(technicianId));
  }

  if (filters.region) {
    const wanted = String(filters.region).trim().toLowerCase();
    rows = rows.filter((p) => {
      const region = getMacroRegion(p.client?.estado);
      return region.toLowerCase() === wanted;
    });
  }

  if (filters.uf) {
    const wanted = normalizeUF(filters.uf);
    rows = rows.filter((p) => normalizeUF(p.client?.estado) === wanted);
  }

  if (filters.city) {
    const wanted = normalizeCity(filters.city).toLowerCase();
    rows = rows.filter((p) => normalizeCity(p.client?.cidade).toLowerCase() === wanted);
  }

  if (filters.product) {
    const wanted = String(filters.product).trim().toLowerCase();
    rows = rows.filter((p) =>
      safeArray(p.items).some((item) =>
        `${item.equipmentName || ''} ${item.equipmentCode || ''}`.toLowerCase().includes(wanted)
      )
    );
  }

  if (filters.q) {
    const q = String(filters.q).trim().toLowerCase();

    rows = rows.filter((p) => {
      const haystack = [
        p.title,
        p.af,
        p.client?.name,
        p.client?.nomeFantasia,
        p.coordinator?.name,
        ...(p.technicianNames || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(q);
    });
  }

  const startDate = parseDate(filters.startDate);
  const endDate = parseDate(filters.endDate);

  if (startDate || endDate) {
    rows = rows.filter((p) => {
      const projectMatches = overlapPeriod(
        p.startPlannedAt || p.startAt,
        p.endPlannedAt || p.endAt,
        startDate,
        endDate
      );

      const hasProgressInRange = safeArray(p.progress).some((progress) => {
        const d = dateOnly(progress.date);
        if (!d) return false;
        if (startDate && dayjs(d).isBefore(dayjs(startDate), 'day')) return false;
        if (endDate && dayjs(d).isAfter(dayjs(endDate), 'day')) return false;
        return true;
      });

      return projectMatches || hasProgressInRange;
    });
  }

  return rows;
}

function buildOverview(projects) {
  const today = dayjs();

  const totals = projects.reduce(
    (acc, project) => {
      const planned = getProjectPlanned(project);
      const done = getProjectDone(project);
      const pending = Math.max(planned - done, 0);

      acc.planned += planned;
      acc.done += done;
      acc.pending += pending;

      if (isDelayed(project, today)) acc.delayedProjects += 1;

      return acc;
    },
    {
      planned: 0,
      done: 0,
      pending: 0,
      delayedProjects: 0,
    }
  );

  const totalProjects = projects.length;
  const percentDone = totals.planned
    ? Number(((totals.done / totals.planned) * 100).toFixed(2))
    : 0;

  return {
    totalProjects,
    planned: totals.planned,
    done: totals.done,
    pending: totals.pending,
    delayedProjects: totals.delayedProjects,
    percentDone,
  };
}

function buildProductivity(projects) {
  const dailyMap = new Map();

  for (const project of projects) {
    for (const progress of safeArray(project.progress)) {
      const key = dateOnly(progress.date);
      if (!key) continue;

      dailyMap.set(key, (dailyMap.get(key) || 0) + toNumber(progress.trucksDoneToday, 0));
    }
  }

  const daily = [...dailyMap.entries()]
    .map(([date, installed]) => ({ date, installed }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const weeklyMap = new Map();

  for (const row of daily) {
    const weekStart = dayjs(row.date).startOf('week').format('YYYY-MM-DD');
    weeklyMap.set(weekStart, (weeklyMap.get(weekStart) || 0) + row.installed);
  }

  const weekly = [...weeklyMap.entries()]
    .map(([weekStart, installed]) => ({ weekStart, installed }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));

  const totalInstalled = daily.reduce((sum, row) => sum + row.installed, 0);

  const avgDaily = daily.length ? Number((totalInstalled / daily.length).toFixed(2)) : 0;
  const avgWeekly = weekly.length ? Number((totalInstalled / weekly.length).toFixed(2)) : 0;

  const dailyTarget = projects.reduce((sum, p) => sum + toNumber(p.equipmentsPerDay, 0), 0);
  const weeklyTarget = dailyTarget * 5;

  const compareDailyPct = dailyTarget
    ? Number(((avgDaily / dailyTarget) * 100).toFixed(2))
    : 0;

  const compareWeeklyPct = weeklyTarget
    ? Number(((avgWeekly / weeklyTarget) * 100).toFixed(2))
    : 0;

  return {
    totalInstalled,
    averageDaily: avgDaily,
    averageWeekly: avgWeekly,
    targetDaily: dailyTarget,
    targetWeekly: weeklyTarget,
    compareDailyPct,
    compareWeeklyPct,
    byDay: daily,
    byWeek: weekly,
  };
}

function buildByClient(projects) {
  const map = new Map();

  for (const project of projects) {
    const clientId = project.client?.id || project.clientId || 0;
    const clientName =
      project.client?.name ||
      project.client?.nomeFantasia ||
      `Cliente ${clientId || 'Não informado'}`;

    if (!map.has(clientId)) {
      map.set(clientId, {
        clientId,
        clientName,
        planned: 0,
        done: 0,
        pending: 0,
        projects: 0,
        percentDone: 0,
      });
    }

    const row = map.get(clientId);
    row.projects += 1;
    row.planned += getProjectPlanned(project);
    row.done += getProjectDone(project);
    row.pending += getProjectPending(project);
  }

  return [...map.values()]
    .map((row) => ({
      ...row,
      percentDone: row.planned ? Number(((row.done / row.planned) * 100).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.done - a.done || b.planned - a.planned);
}

function buildByStatus(projects) {
  const base = {
    AGENDADO: 0,
    EM_ANDAMENTO: 0,
    CONCLUIDO: 0,
    CANCELADO: 0,
    REAGENDADO: 0,
    NAO_INFORMADO: 0,
  };

  for (const project of projects) {
    const normalized = mapProjectStatus(project.status);
    base[normalized] = (base[normalized] || 0) + 1;
  }

  return Object.entries(base).map(([status, total]) => ({
    status,
    total,
  }));
}

function buildSuccessRate(projects) {
  const reasons = {
    CLIENTE_AUSENTE: 0,
    PROBLEMA_TECNICO: 0,
    VEICULO_INDISPONIVEL: 0,
    REAGENDADO: 0,
    CANCELADO: 0,
    ENDERECO_INCORRETO: 0,
    OUTROS: 0,
  };

  let successfulInstallations = 0;
  let failedAttempts = 0;

  for (const project of projects) {
    for (const progress of safeArray(project.progress)) {
      const doneToday = toNumber(progress.trucksDoneToday, 0);
      const reason = extractFailureReason(progress.notes);

      if (doneToday > 0) {
        successfulInstallations += doneToday;
      } else if (reason) {
        failedAttempts += 1;
        reasons[reason] = (reasons[reason] || 0) + 1;
      }
    }
  }

  const attempts = successfulInstallations + failedAttempts;
  const successRate = attempts
    ? Number(((successfulInstallations / attempts) * 100).toFixed(2))
    : 0;

  return {
    attempts,
    successfulInstallations,
    failedAttempts,
    successRate,
    failureReasons: Object.entries(reasons).map(([reason, total]) => ({
      reason,
      total,
    })),
  };
}

function buildByCoordinator(projects) {
  const map = new Map();

  for (const project of projects) {
    const id = project.coordinator?.id || project.coordinatorId || 0;
    const name = project.coordinator?.name || 'Sem coordenador';

    if (!map.has(id)) {
      map.set(id, {
        coordinatorId: id,
        coordinatorName: name,
        projects: 0,
        planned: 0,
        done: 0,
        pending: 0,
        delayedProjects: 0,
        percentDone: 0,
      });
    }

    const row = map.get(id);
    row.projects += 1;
    row.planned += getProjectPlanned(project);
    row.done += getProjectDone(project);
    row.pending += getProjectPending(project);
    if (isDelayed(project)) row.delayedProjects += 1;
  }

  return [...map.values()]
    .map((row) => ({
      ...row,
      percentDone: row.planned ? Number(((row.done / row.planned) * 100).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.done - a.done || b.projects - a.projects);
}

function buildByTechnician(projects) {
  const map = new Map();

  for (const project of projects) {
    const techIds = safeArray(project.technicianIdsNormalized);
    const names = safeArray(project.technicianNames);

    if (!techIds.length) {
      const key = 0;

      if (!map.has(key)) {
        map.set(key, {
          technicianId: 0,
          technicianName: 'Sem técnico/prestador',
          projects: 0,
          planned: 0,
          done: 0,
          pending: 0,
          percentDone: 0,
        });
      }

      const row = map.get(key);
      row.projects += 1;
      row.planned += getProjectPlanned(project);
      row.done += getProjectDone(project);
      row.pending += getProjectPending(project);
      continue;
    }

    const planned = getProjectPlanned(project);
    const done = getProjectDone(project);
    const pending = getProjectPending(project);
    const divisor = techIds.length || 1;

    techIds.forEach((techId, index) => {
      if (!map.has(techId)) {
        map.set(techId, {
          technicianId: techId,
          technicianName: names[index] || `Técnico ${techId}`,
          projects: 0,
          planned: 0,
          done: 0,
          pending: 0,
          percentDone: 0,
        });
      }

      const row = map.get(techId);
      row.projects += 1;
      row.planned += Number((planned / divisor).toFixed(2));
      row.done += Number((done / divisor).toFixed(2));
      row.pending += Number((pending / divisor).toFixed(2));
    });
  }

  return [...map.values()]
    .map((row) => ({
      ...row,
      percentDone: row.planned ? Number(((row.done / row.planned) * 100).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.done - a.done || b.projects - a.projects);
}

function buildByRegion(projects) {
  const map = new Map();

  for (const project of projects) {
    const uf = normalizeUF(project.client?.estado) || 'N/I';
    const city = normalizeCity(project.client?.cidade) || 'Não informada';
    const macroRegion = getMacroRegion(uf);

    const key = `${macroRegion}__${uf}__${city}`;

    if (!map.has(key)) {
      map.set(key, {
        region: macroRegion,
        uf,
        city,
        projects: 0,
        planned: 0,
        done: 0,
        pending: 0,
        delayedProjects: 0,
        percentDone: 0,
      });
    }

    const row = map.get(key);
    row.projects += 1;
    row.planned += getProjectPlanned(project);
    row.done += getProjectDone(project);
    row.pending += getProjectPending(project);
    if (isDelayed(project)) row.delayedProjects += 1;
  }

  return [...map.values()]
    .map((row) => ({
      ...row,
      percentDone: row.planned ? Number(((row.done / row.planned) * 100).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.planned - a.planned || b.done - a.done);
}

function buildByProduct(projects) {
  const map = new Map();

  for (const project of projects) {
    const items = safeArray(project.items);
    const totalQty = items.reduce((sum, item) => sum + toNumber(item.qty, 0), 0);
    const projectDone = getProjectDone(project);

    for (const item of items) {
      const productKey = item.equipmentCode || item.equipmentName || 'NÃO INFORMADO';
      const productName = item.equipmentName || item.equipmentCode || 'NÃO INFORMADO';
      const planned = toNumber(item.qty, 0);

      const proportionalDone =
        totalQty > 0 ? Number(((projectDone * planned) / totalQty).toFixed(2)) : 0;

      if (!map.has(productKey)) {
        map.set(productKey, {
          product: productName,
          code: item.equipmentCode || null,
          planned: 0,
          done: 0,
          pending: 0,
          percentDone: 0,
        });
      }

      const row = map.get(productKey);
      row.planned += planned;
      row.done += proportionalDone;
    }
  }

  return [...map.values()]
    .map((row) => {
      const pending = Math.max(row.planned - row.done, 0);
      return {
        ...row,
        pending: Number(pending.toFixed(2)),
        done: Number(row.done.toFixed(2)),
        percentDone: row.planned ? Number(((row.done / row.planned) * 100).toFixed(2)) : 0,
      };
    })
    .sort((a, b) => b.planned - a.planned || b.done - a.done);
}

function buildMapData(projects) {
  const map = new Map();

  for (const project of projects) {
    const coords = resolveProjectCoords(project);
    if (!coords) continue;

    const key = `${coords.lat}_${coords.lng}`;

    if (!map.has(key)) {
      map.set(key, {
        lat: coords.lat,
        lng: coords.lng,
        city: coords.city || null,
        uf: coords.uf || null,
        region: getMacroRegion(coords.uf),
        clients: new Set(),
        projects: 0,
        planned: 0,
        done: 0,
        pending: 0,
        delayedProjects: 0,
        heat: 0,
        source: coords.source,
      });
    }

    const row = map.get(key);
    row.projects += 1;
    row.planned += getProjectPlanned(project);
    row.done += getProjectDone(project);
    row.pending += getProjectPending(project);
    row.heat += getProjectPlanned(project);

    if (project.client?.name) {
      row.clients.add(project.client.name);
    }

    if (isDelayed(project)) {
      row.delayedProjects += 1;
    }
  }

  return [...map.values()].map((row) => ({
    ...row,
    clients: [...row.clients],
  }));
}

// ======================================================
// Controllers
// ======================================================

async function overview(req, res) {
  try {
    const projects = await loadDashboardProjects(req.query);

    const response = {
      filters: req.query,
      overview: buildOverview(projects),
      productivity: buildProductivity(projects),
      byClient: buildByClient(projects),
      byStatus: buildByStatus(projects),
      byCoordinator: buildByCoordinator(projects),
      byTechnician: buildByTechnician(projects),
      byRegion: buildByRegion(projects),
      byProduct: buildByProduct(projects),
      successRate: buildSuccessRate(projects),
      map: buildMapData(projects),
    };

    return ok(res, response);
  } catch (err) {
    console.error('installationProjectDashboard.overview:', err);
    return bad(res, err.message || 'Erro ao montar dashboard');
  }
}

async function summary(req, res) {
  try {
    const projects = await loadDashboardProjects(req.query);

    return ok(res, {
      filters: req.query,
      data: buildOverview(projects),
    });
  } catch (err) {
    console.error('installationProjectDashboard.summary:', err);
    return bad(res, err.message || 'Erro ao montar resumo do dashboard');
  }
}

async function productivity(req, res) {
  try {
    const projects = await loadDashboardProjects(req.query);

    return ok(res, {
      filters: req.query,
      data: buildProductivity(projects),
    });
  } catch (err) {
    console.error('installationProjectDashboard.productivity:', err);
    return bad(res, err.message || 'Erro ao montar produtividade');
  }
}

async function byClient(req, res) {
  try {
    const projects = await loadDashboardProjects(req.query);

    return ok(res, {
      filters: req.query,
      data: buildByClient(projects),
    });
  } catch (err) {
    console.error('installationProjectDashboard.byClient:', err);
    return bad(res, err.message || 'Erro ao montar visão por cliente');
  }
}

async function byStatus(req, res) {
  try {
    const projects = await loadDashboardProjects(req.query);

    return ok(res, {
      filters: req.query,
      data: buildByStatus(projects),
    });
  } catch (err) {
    console.error('installationProjectDashboard.byStatus:', err);
    return bad(res, err.message || 'Erro ao montar status das instalações');
  }
}

async function successRate(req, res) {
  try {
    const projects = await loadDashboardProjects(req.query);

    return ok(res, {
      filters: req.query,
      data: buildSuccessRate(projects),
    });
  } catch (err) {
    console.error('installationProjectDashboard.successRate:', err);
    return bad(res, err.message || 'Erro ao montar taxa de sucesso');
  }
}

async function byCoordinator(req, res) {
  try {
    const projects = await loadDashboardProjects(req.query);

    return ok(res, {
      filters: req.query,
      data: buildByCoordinator(projects),
    });
  } catch (err) {
    console.error('installationProjectDashboard.byCoordinator:', err);
    return bad(res, err.message || 'Erro ao montar visão por coordenador');
  }
}

async function byTechnician(req, res) {
  try {
    const projects = await loadDashboardProjects(req.query);

    return ok(res, {
      filters: req.query,
      data: buildByTechnician(projects),
    });
  } catch (err) {
    console.error('installationProjectDashboard.byTechnician:', err);
    return bad(res, err.message || 'Erro ao montar visão por técnico');
  }
}

async function byRegion(req, res) {
  try {
    const projects = await loadDashboardProjects(req.query);

    return ok(res, {
      filters: req.query,
      data: buildByRegion(projects),
    });
  } catch (err) {
    console.error('installationProjectDashboard.byRegion:', err);
    return bad(res, err.message || 'Erro ao montar visão por região');
  }
}

async function byProduct(req, res) {
  try {
    const projects = await loadDashboardProjects(req.query);

    return ok(res, {
      filters: req.query,
      data: buildByProduct(projects),
    });
  } catch (err) {
    console.error('installationProjectDashboard.byProduct:', err);
    return bad(res, err.message || 'Erro ao montar visão por produto');
  }
}

async function map(req, res) {
  try {
    const projects = await loadDashboardProjects(req.query);

    return ok(res, {
      filters: req.query,
      data: buildMapData(projects),
    });
  } catch (err) {
    console.error('installationProjectDashboard.map:', err);
    return bad(res, err.message || 'Erro ao montar mapa');
  }
}

module.exports = {
  overview,
  summary,
  productivity,
  byClient,
  byStatus,
  successRate,
  byCoordinator,
  byTechnician,
  byRegion,
  byProduct,
  map,
};