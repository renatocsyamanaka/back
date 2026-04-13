const XLSX = require('xlsx');
const crypto = require('crypto');
const { Op } = require('sequelize');
const {
  DeliveryReport,
  DeliveryReportHistory,
  sequelize,
} = require('../models');

const importJobs = new Map();

const JOB_TTL_MS = 1000 * 60 * 30; // 30 minutos
const JOB_CLEANUP_INTERVAL = 1000 * 60 * 5; // 5 minutos
const MAX_JOBS = 100;

const IMPORT_COMPARE_FIELDS = [
  'tipo',
  'emissao',
  'cidadeOrigem',
  'ufOrigem',
  'remetente',
  'cidadeDestino',
  'ufDestino',
  'destinatario',
  'notaFiscal',
  'nfValor',
  'pesoReal',
  'pesoCubado',
  'pesoTaxado',
  'volume',
  'frete',
  'icmsPercent',
  'icmsValor',
  'status',
  'previsaoEntrega',
  'dataEntrega',
  'modal',
  'statusEntrega',
  'operacao',
  'operacaoResumo',
  'cteNovo',
  'emissaoData',
  'transportadora',
  'encomenda',
  'reentregaDevolucao',
  'ultimaAtualizacao',
  'indice',
  'regiao',
];

const DATE_FIELDS = new Set([
  'emissao',
  'previsaoEntrega',
  'dataEntrega',
  'emissaoData',
  'ultimaAtualizacao',
]);

const NUMBER_FIELDS = new Set([
  'nfValor',
  'pesoReal',
  'pesoCubado',
  'pesoTaxado',
  'volume',
  'frete',
  'icmsPercent',
  'icmsValor',
  'indice',
]);

const TEXT_FIELDS = new Set([
  'tipo',
  'cidadeOrigem',
  'ufOrigem',
  'remetente',
  'cidadeDestino',
  'ufDestino',
  'destinatario',
  'notaFiscal',
  'status',
  'modal',
  'statusEntrega',
  'operacao',
  'operacaoResumo',
  'cteNovo',
  'transportadora',
  'encomenda',
  'reentregaDevolucao',
  'regiao',
]);

function cleanupOldJobs() {
  const now = Date.now();

  for (const [jobId, job] of importJobs.entries()) {
    const finishedAt = job.finishedAt ? new Date(job.finishedAt).getTime() : null;
    if (finishedAt && now - finishedAt > JOB_TTL_MS) {
      importJobs.delete(jobId);
    }
  }
}

setInterval(() => {
  cleanupOldJobs();
}, JOB_CLEANUP_INTERVAL);

function generateJobId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function clean(value) {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  return str === '' ? null : str;
}

function cleanTextNumber(value) {
  const str = clean(value);
  if (!str) return null;

  if (/^\d{1,3}(,\d{3})+$/.test(str)) {
    return str.replace(/,/g, '');
  }

  if (/^\d+\.0+$/.test(str)) {
    return str.replace(/\.0+$/, '');
  }

  return str;
}

function toDecimal(value) {
  if (value === undefined || value === null || value === '') return null;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  let str = String(value).trim();
  if (!str) return null;

  str = str.replace(/\s+/g, '').replace(/R\$/gi, '');

  if (str.includes('.') && str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }

  const parsed = Number(str);
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

  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;

    return new Date(
      parsed.y,
      parsed.m - 1,
      parsed.d,
      parsed.H || 0,
      parsed.M || 0,
      parsed.S || 0
    );
  }

  const str = String(value).trim();
  if (!str) return null;

  const brMatch = str.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (brMatch) {
    const [, dd, mm, yyyy, hh = '00', mi = '00', ss = '00'] = brMatch;
    const d = new Date(
      Number(yyyy),
      Number(mm) - 1,
      Number(dd),
      Number(hh),
      Number(mi),
      Number(ss)
    );
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const isoMatch = str.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (isoMatch) {
    const [, yyyy, mm, dd, hh = '00', mi = '00', ss = '00'] = isoMatch;
    const d = new Date(
      Number(yyyy),
      Number(mm) - 1,
      Number(dd),
      Number(hh),
      Number(mi),
      Number(ss)
    );
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeKey(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function normalizeDateOnly(value) {
  if (!value) return null;

  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

function formatComparableValue(value) {
  if (value === undefined || value === null || value === '') return null;

  if (value instanceof Date) {
    return normalizeDateOnly(value);
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? Number(value) : null;
  }

  if (typeof value === 'string') {
    const str = value.trim();
    if (!str) return null;

    const maybeDate = normalizeDateOnly(str);
    if (maybeDate) return maybeDate;

    const numeric = Number(str.replace(',', '.'));
    if (!Number.isNaN(numeric) && /^-?\d+([.,]\d+)?$/.test(str)) {
      return numeric;
    }

    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase();
  }

  return String(value).trim();
}

function normalizeValueByField(field, value) {
  if (value === undefined || value === null || value === '') return null;

  if (DATE_FIELDS.has(field)) {
    return normalizeDateOnly(value);
  }

  if (NUMBER_FIELDS.has(field)) {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? Number(value) : null;
    }

    let str = String(value).trim();
    if (!str) return null;

    str = str.replace(/\s+/g, '').replace(/R\$/gi, '');

    if (str.includes('.') && str.includes(',')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else if (str.includes(',')) {
      str = str.replace(',', '.');
    }

    const parsed = Number(str);
    return Number.isNaN(parsed) ? null : parsed;
  }

  if (TEXT_FIELDS.has(field)) {
    const str = String(value).trim();
    if (!str) return null;

    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase();
  }

  return formatComparableValue(value);
}

function getUserMeta(user) {
  return {
    performedByUserId: user?.id || null,
    performedByName:
      user?.name ||
      user?.fullName ||
      user?.nome ||
      user?.email ||
      'Sistema',
    performedByProfile:
      user?.role?.name ||
      user?.roleName ||
      user?.profile ||
      null,
  };
}

async function registerHistory({
  transaction,
  deliveryReportId,
  actionType,
  comments,
  userMeta,
  fieldName = null,
  oldValue = null,
  newValue = null,
}) {
  await DeliveryReportHistory.create(
    {
      deliveryReportId,
      actionType,
      fieldName,
      oldValue,
      newValue,
      comments,
      ...userMeta,
    },
    { transaction }
  );
}

function parseYearsParam(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return [...new Set(
      value
        .flatMap((item) => String(item).split(','))
        .map((item) => Number(String(item).trim()))
        .filter((n) => Number.isInteger(n) && n >= 2000 && n <= 2100)
    )];
  }

  return [...new Set(
    String(value)
      .split(',')
      .map((item) => Number(item.trim()))
      .filter((n) => Number.isInteger(n) && n >= 2000 && n <= 2100)
  )];
}

function buildYearFilter({ yearMode, years }) {
  if (yearMode === 'all') return null;

  const parsedYears = parseYearsParam(years);
  if (!parsedYears.length) return null;

  const ranges = parsedYears.map((year) => ({
    emissao: {
      [Op.gte]: new Date(`${year}-01-01T00:00:00.000Z`),
      [Op.lte]: new Date(`${year}-12-31T23:59:59.999Z`),
    },
  }));

  return { [Op.or]: ranges };
}
function mapRow(rawRow) {
  const row = {};
  Object.entries(rawRow || {}).forEach(([k, v]) => {
    row[normalizeKey(k)] = v;
  });

  return {
    cte: cleanTextNumber(row.cte),
    tipo: clean(row.tipo),
    emissao: toDate(row.emissao),

    cidadeOrigem: clean(row.cidade_origem ?? row.cidadeorigem),
    ufOrigem: clean(row.uf_origem ?? row.uforigem),
    remetente: clean(row.remetente),

    cidadeDestino: clean(row.cidade_destino ?? row.cidadedestino),
    ufDestino: clean(row.uf_destino ?? row.ufdestino),
    destinatario: clean(row.destinatario),

    notaFiscal: cleanTextNumber(row.nota_fiscal ?? row.notafiscal),
    nfValor: toDecimal(row.nf_valor ?? row.nfvalor),

    pesoReal: toDecimal(row.peso_real ?? row.pesoreal),
    pesoCubado: toDecimal(row.peso_cubado ?? row.pesocubado),
    pesoTaxado: toDecimal(row.peso_taxado ?? row.pesotaxado),

    volume: toDecimal(row.volume),
    frete: toDecimal(row.frete),

    icmsPercent: toDecimal(row.icms_percent ?? row.icmspercent),
    icmsValor: toDecimal(row.icms_valor ?? row.icmsvalor),

    status: clean(row.status),
    previsaoEntrega: toDate(row.previsao_entrega ?? row.previsaoentrega),
    dataEntrega: toDate(row.data_entrega ?? row.dataentrega),

    modal: clean(row.modal),
    statusEntrega: clean(row.status_entrega ?? row.statusentrega),

    operacao: clean(row.operacao),
    operacaoResumo: clean(row.operacao_resumo ?? row.operacaoresumo),

    cteNovo: cleanTextNumber(row.cte_novo ?? row.ctenovo),
    emissaoData: toDate(row.emissao_data ?? row.emissaodata),

    transportadora: clean(row.transportadora),
    encomenda: cleanTextNumber(row.encomenda),
    reentregaDevolucao: clean(row.reentrega_devolucao ?? row.reentregadevolucao),

    ultimaAtualizacao: toDate(row.ultima_atualizacao ?? row.ultimaatualizacao),
    indice: toInteger(row.indice),
    regiao: clean(row.regiao),
  };
}

function buildUpdatePayload(existing, payload) {
  const data = {};
  const changes = [];

  for (const key of IMPORT_COMPARE_FIELDS) {
    const newValue = payload[key];

    if (newValue === undefined || newValue === null || newValue === '') {
      continue;
    }

    const oldValue = existing.get(key);

    const oldComparable = normalizeValueByField(key, oldValue);
    const newComparable = normalizeValueByField(key, newValue);

    if (oldComparable !== newComparable) {
      data[key] = newValue;
      changes.push({
        fieldName: key,
        oldValue: oldComparable,
        newValue: newComparable,
      });
    }
  }

  return { data, changes };
}

async function findExistingRecord(payload, transaction) {
  if (!payload.cte) return null;

  return DeliveryReport.findOne({
    where: { cte: payload.cte },
    transaction,
    paranoid: false,
  });
}

function createImportJob(fileName, user) {
  if (importJobs.size >= MAX_JOBS) {
    const oldestKey = importJobs.keys().next().value;
    if (oldestKey) importJobs.delete(oldestKey);
  }

  const jobId = generateJobId();
  const job = {
    jobId,
    fileName,
    status: 'queued',
    createdAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
    requestedBy: {
      id: user?.id || null,
      name: user?.name || user?.email || 'Sistema',
    },
    totalLinhas: 0,
    processed: 0,
    inserted: 0,
    updated: 0,
    ignored: 0,
    progress: 0,
    currentLine: null,
    errors: [],
    message: 'Importação na fila.',
  };

  importJobs.set(jobId, job);
  return job;
}

function updateImportJob(jobId, patch) {
  const current = importJobs.get(jobId);
  if (!current) return null;

  const next = { ...current, ...patch };

  if (typeof next.totalLinhas === 'number' && next.totalLinhas > 0) {
    next.progress = Math.min(
      100,
      Math.round((Number(next.processed || 0) / next.totalLinhas) * 100)
    );
  } else {
    next.progress = 0;
  }

  importJobs.set(jobId, next);
  return next;
}

function getPublicJob(job) {
  if (!job) return null;

  return {
    jobId: job.jobId,
    fileName: job.fileName,
    status: job.status,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    requestedBy: job.requestedBy,
    totalLinhas: job.totalLinhas,
    processed: job.processed,
    inserted: job.inserted,
    updated: job.updated,
    ignored: job.ignored,
    progress: job.progress,
    currentLine: job.currentLine,
    message: job.message,
    errors: job.errors || [],
  };
}
function chunkArray(arr, size = 100) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function processImportJob({ jobId, buffer, user }) {
  const userMeta = getUserMeta(user);

  try {
    updateImportJob(jobId, {
      status: 'processing',
      startedAt: new Date().toISOString(),
      message: 'Lendo planilha...',
    });

    const workbook = XLSX.read(buffer, {
      type: 'buffer',
      cellDates: true,
      raw: true,
    });

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new Error('Planilha sem abas.');
    }

    const sheet = workbook.Sheets[sheetName];
    const jsonRows = XLSX.utils.sheet_to_json(sheet, {
      defval: null,
      raw: true,
      dateNF: 'yyyy-mm-dd',
      blankrows: false,
    });

    if (!jsonRows.length) {
      throw new Error('Planilha vazia.');
    }

    const mappedRows = jsonRows.map((row, index) => ({
      line: index + 2,
      payload: mapRow(row),
    }));

    updateImportJob(jobId, {
      totalLinhas: mappedRows.length,
      processed: 0,
      inserted: 0,
      updated: 0,
      ignored: 0,
      progress: 0,
      currentLine: null,
      errors: [],
      message: 'Processando planilha em lotes de 100...',
    });

    const chunks = chunkArray(mappedRows, 100);

    let inserted = 0;
    let updated = 0;
    let ignored = 0;
    const errors = [];

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      const ctes = [
        ...new Set(
          chunk
            .map((item) => item.payload?.cte)
            .filter(Boolean)
        ),
      ];

      updateImportJob(jobId, {
        currentLine: chunk[0]?.line || null,
        processed: chunkIndex * 100,
        inserted,
        updated,
        ignored,
        errors,
        message: `Processando lote ${chunkIndex + 1}/${chunks.length}...`,
      });

      const transaction = await sequelize.transaction();

      try {
        const existingRows = ctes.length
          ? await DeliveryReport.findAll({
              where: {
                cte: { [Op.in]: ctes },
              },
              transaction,
              paranoid: false,
            })
          : [];

        const existingMap = new Map(
          existingRows.map((row) => [String(row.cte).trim(), row])
        );

        for (const item of chunk) {
          const { line, payload } = item;

          try {
            if (!payload.cte) {
              ignored++;
              errors.push(`Linha ${line}: sem CTE.`);
              continue;
            }

            const existing = existingMap.get(String(payload.cte).trim());

            if (!existing) {
              const created = await DeliveryReport.create(
                {
                  ...payload,
                  createdById: user?.id || null,
                  updatedById: user?.id || null,
                  deletedAt: null,
                  deletedById: null,
                },
                { transaction }
              );

              await registerHistory({
                transaction,
                deliveryReportId: created.id,
                actionType: 'IMPORTED',
                comments: `Importado via Excel na linha ${line}.`,
                userMeta,
              });

              inserted++;
              continue;
            }

            const { data, changes } = buildUpdatePayload(existing, payload);

            if (!changes.length) {
              ignored++;
              errors.push(`Linha ${line}: ignorada (sem alterações).`);
              continue;
            }

            const updatePayload = {
              ...data,
              updatedById: user?.id || null,
            };

            if (existing.deletedAt) {
              updatePayload.deletedAt = null;
              updatePayload.deletedById = null;
            }

            await existing.update(updatePayload, { transaction });

            for (const change of changes) {
              await registerHistory({
                transaction,
                deliveryReportId: existing.id,
                actionType: 'UPDATED',
                comments: `Atualizado via Excel na linha ${line}.`,
                userMeta,
                fieldName: change.fieldName,
                oldValue: change.oldValue,
                newValue: change.newValue,
              });
            }

            updated++;
          } catch (err) {
            ignored++;
            errors.push(`Linha ${line}: ${err.message}`);
          }
        }

        await transaction.commit();
      } catch (err) {
        try {
          if (!transaction.finished) {
            await transaction.rollback();
          }
        } catch {}

        throw err;
      }

      updateImportJob(jobId, {
        currentLine: chunk[chunk.length - 1]?.line || null,
        processed: Math.min((chunkIndex + 1) * 100, mappedRows.length),
        inserted,
        updated,
        ignored,
        errors,
        message: `Lote ${chunkIndex + 1}/${chunks.length} concluído.`,
      });
    }

    updateImportJob(jobId, {
      status: 'done',
      finishedAt: new Date().toISOString(),
      currentLine: null,
      processed: mappedRows.length,
      inserted,
      updated,
      ignored,
      errors,
      message: 'Importação concluída.',
    });
  } catch (error) {
    console.error('[deliveryReport.processImportJob]', error);

    updateImportJob(jobId, {
      status: 'error',
      finishedAt: new Date().toISOString(),
      currentLine: null,
      message: error?.message || 'Erro ao importar planilha.',
    });
  }
}

exports.importExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Arquivo não enviado.' });
    }

    const job = createImportJob(req.file.originalname, req.user);

    setImmediate(() => {
      processImportJob({
        jobId: job.jobId,
        buffer: req.file.buffer,
        user: req.user,
      });
    });

    return res.status(202).json({
      message: 'Importação iniciada com sucesso.',
      jobId: job.jobId,
      status: job.status,
    });
  } catch (error) {
    console.error('[deliveryReport.importExcel.start]', error);
    return res.status(500).json({
      message: error?.message || 'Erro ao iniciar importação.',
    });
  }
};

exports.getImportStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = importJobs.get(jobId);

    if (!job) {
      return res.status(404).json({ message: 'Job de importação não encontrado.' });
    }

    return res.json(getPublicJob(job));
  } catch (error) {
    console.error('[deliveryReport.getImportStatus]', error);
    return res.status(500).json({
      message: error?.message || 'Erro ao consultar status da importação.',
    });
  }
};