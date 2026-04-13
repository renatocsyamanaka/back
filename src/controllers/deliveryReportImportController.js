const XLSX = require('xlsx');
const crypto = require('crypto');
const { Op } = require('sequelize');
const {
  DeliveryReport,
  DeliveryReportHistory,
  sequelize,
} = require('../models');

const IMPORT_CONTROLLER_VERSION = 'delivery-report-import-hash-v5-rounded';

const importJobs = new Map();

const JOB_TTL_MS = 1000 * 60 * 30;
const JOB_CLEANUP_INTERVAL = 1000 * 60 * 5;
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

setInterval(cleanupOldJobs, JOB_CLEANUP_INTERVAL);

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

function excelSerialToDate(value) {
  try {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;

    return new Date(
      Date.UTC(
        parsed.y,
        parsed.m - 1,
        parsed.d,
        parsed.H || 0,
        parsed.M || 0,
        parsed.S || 0
      )
    );
  } catch {
    return null;
  }
}

function toDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    return excelSerialToDate(value);
  }

  const str = String(value).trim();
  if (!str) return null;

  const brMatch = str.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (brMatch) {
    const [, dd, mm, yyyy, hh = '00', mi = '00', ss = '00'] = brMatch;
    const d = new Date(
      Date.UTC(
        Number(yyyy),
        Number(mm) - 1,
        Number(dd),
        Number(hh),
        Number(mi),
        Number(ss)
      )
    );
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const isoMatch = str.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?(?:\.\d+)?(?:Z)?$/
  );
  if (isoMatch) {
    const [, yyyy, mm, dd, hh = '00', mi = '00', ss = '00'] = isoMatch;
    const d = new Date(
      Date.UTC(
        Number(yyyy),
        Number(mm) - 1,
        Number(dd),
        Number(hh),
        Number(mi),
        Number(ss)
      )
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

function normalizeDateUTC(value) {
  if (!value) return null;

  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;

  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate()
  ).padStart(2, '0')}`;
}

function normalizeText(value) {
  if (value === undefined || value === null || value === '') return null;

  const str = String(value).trim();
  if (!str) return null;

  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function normalizeNumber(value) {
  if (value === undefined || value === null || value === '') return null;

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

function roundNumber(value, scale = 2) {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;

  const factor = 10 ** scale;
  return Math.round((num + Number.EPSILON) * factor) / factor;
}

function normalizeNumberByField(field, value) {
  const num = normalizeNumber(value);
  if (num === null) return null;

  if (field === 'icmsValor') return roundNumber(num, 2);
  if (field === 'frete') return roundNumber(num, 2);
  if (field === 'nfValor') return roundNumber(num, 2);
  if (field === 'icmsPercent') return roundNumber(num, 2);

  if (field === 'pesoReal') return roundNumber(num, 3);
  if (field === 'pesoCubado') return roundNumber(num, 3);
  if (field === 'pesoTaxado') return roundNumber(num, 3);
  if (field === 'volume') return roundNumber(num, 3);

  if (field === 'indice') return Number.isFinite(num) ? parseInt(num, 10) : null;

  return num;
}

function normalizeValueByField(field, value) {
  if (value === undefined || value === null || value === '') return null;

  if (DATE_FIELDS.has(field)) return normalizeDateUTC(value);
  if (NUMBER_FIELDS.has(field)) return normalizeNumberByField(field, value);
  if (TEXT_FIELDS.has(field)) return normalizeText(value);

  return normalizeText(value);
}

function normalizePayloadForPersistence(payload) {
  return {
    ...payload,
    nfValor: normalizeNumberByField('nfValor', payload.nfValor),
    frete: normalizeNumberByField('frete', payload.frete),
    icmsPercent: normalizeNumberByField('icmsPercent', payload.icmsPercent),
    icmsValor: normalizeNumberByField('icmsValor', payload.icmsValor),
    pesoReal: normalizeNumberByField('pesoReal', payload.pesoReal),
    pesoCubado: normalizeNumberByField('pesoCubado', payload.pesoCubado),
    pesoTaxado: normalizeNumberByField('pesoTaxado', payload.pesoTaxado),
    volume: normalizeNumberByField('volume', payload.volume),
    indice: normalizeNumberByField('indice', payload.indice),
  };
}

function stableStringify(obj) {
  const ordered = {};
  Object.keys(obj)
    .sort()
    .forEach((key) => {
      ordered[key] = obj[key];
    });

  return JSON.stringify(ordered);
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function buildComparableSubsetFromPayload(payload) {
  const comparable = {};

  for (const field of IMPORT_COMPARE_FIELDS) {
    const rawValue = payload[field];

    if (rawValue === undefined || rawValue === null || rawValue === '') continue;

    comparable[field] = normalizeValueByField(field, rawValue);
  }

  return comparable;
}

function buildComparableSubsetFromExisting(existing, payload) {
  const comparable = {};

  for (const field of IMPORT_COMPARE_FIELDS) {
    const incomingRaw = payload[field];

    if (incomingRaw === undefined || incomingRaw === null || incomingRaw === '') continue;

    const oldValue =
      typeof existing.get === 'function' ? existing.get(field) : existing[field];

    comparable[field] = normalizeValueByField(field, oldValue);
  }

  return comparable;
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
    operacaoResumo: clean(
      row.operacao_resumo ??
      row.operacaoresumo ??
      row.resumo_operacao ??
      row.resumooperacao
    ),

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

    if (newValue === undefined || newValue === null || newValue === '') continue;

    const oldValue =
      typeof existing.get === 'function' ? existing.get(key) : existing[key];

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

function normalizeCte(cte) {
  const cleaned = cleanTextNumber(cte);
  return cleaned ? String(cleaned).trim() : null;
}

function dedupeChunkByCte(chunk, warnings) {
  const lastByCte = new Map();
  const itemsWithoutCte = [];

  for (const item of chunk) {
    const cte = normalizeCte(item?.payload?.cte);

    if (!cte) {
      itemsWithoutCte.push(item);
      continue;
    }

    if (lastByCte.has(cte)) {
      const previous = lastByCte.get(cte);
      warnings.push(
        `Linha ${previous.line}: CTE ${cte} repetido no mesmo lote. Será considerada a última ocorrência (linha ${item.line}).`
      );
    }

    item.payload.cte = cte;
    lastByCte.set(cte, item);
  }

  return [...itemsWithoutCte, ...lastByCte.values()].sort((a, b) => a.line - b.line);
}

function createImportJob(fileName, user) {
  if (importJobs.size >= MAX_JOBS) {
    const oldestKey = importJobs.keys().next().value;
    if (oldestKey) importJobs.delete(oldestKey);
  }

  const jobId = generateJobId();
  const job = {
    jobId,
    version: IMPORT_CONTROLLER_VERSION,
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
    warnings: [],
    message: `Importação na fila. (${IMPORT_CONTROLLER_VERSION})`,
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
    version: job.version,
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
    warnings: job.warnings || [],
  };
}

function chunkArray(arr, size = 100) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function isFatalConnectionError(err) {
  const message = String(err?.message || err?.parent?.message || err?.original?.message || '').toLowerCase();

  return (
    message.includes('closed state') ||
    message.includes('connection is closed') ||
    message.includes('cannot enqueue') ||
    message.includes('connection lost') ||
    message.includes('server has gone away') ||
    err?.parent?.fatal === true ||
    err?.original?.fatal === true
  );
}

async function rollbackQuietly(transaction) {
  try {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
  } catch {}
}

async function processImportJob({ jobId, buffer, user }) {
  const userMeta = getUserMeta(user);

  try {
    updateImportJob(jobId, {
      status: 'processing',
      startedAt: new Date().toISOString(),
      message: `Lendo planilha... (${IMPORT_CONTROLLER_VERSION})`,
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
      payload: normalizePayloadForPersistence(mapRow(row)),
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
      warnings: [],
      message: `Processando planilha em lotes de 100... (${IMPORT_CONTROLLER_VERSION})`,
    });

    const chunks = chunkArray(mappedRows, 100);

    let inserted = 0;
    let updated = 0;
    let ignored = 0;
    const errors = [];
    const warnings = [];

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const originalChunk = chunks[chunkIndex];
      const chunk = dedupeChunkByCte(originalChunk, warnings);

      const ctes = [
        ...new Set(
          chunk
            .map((item) => normalizeCte(item.payload?.cte))
            .filter(Boolean)
        ),
      ];

      updateImportJob(jobId, {
        currentLine: chunk[0]?.line || null,
        processed: Math.min(chunkIndex * 100, mappedRows.length),
        inserted,
        updated,
        ignored,
        errors,
        warnings,
        message: `Processando lote ${chunkIndex + 1}/${chunks.length}... (${IMPORT_CONTROLLER_VERSION})`,
      });

      let transaction;

      try {
        transaction = await sequelize.transaction();

        const existingRows = ctes.length
          ? await DeliveryReport.findAll({
              where: { cte: { [Op.in]: ctes } },
              transaction,
              paranoid: false,
              order: [['id', 'ASC']],
            })
          : [];

        const existingMap = new Map();

        for (const row of existingRows) {
          const cteKey = normalizeCte(row.cte);
          if (!cteKey) continue;

          if (!existingMap.has(cteKey)) {
            existingMap.set(cteKey, row);
          } else {
            warnings.push(
              `Banco já possui mais de um registro para o CTE ${cteKey}. Será usado o primeiro encontrado (ID ${existingMap.get(cteKey).id}).`
            );
          }
        }

        for (const item of chunk) {
          const { line, payload } = item;
          const cteKey = normalizeCte(payload?.cte);

          try {
            if (!cteKey) {
              ignored++;
              warnings.push(`Linha ${line}: ignorada porque está sem CTE.`);
              continue;
            }

            payload.cte = cteKey;

            let existing = existingMap.get(cteKey);

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

              existingMap.set(cteKey, created);
              inserted++;
              continue;
            }

            const incomingComparable = buildComparableSubsetFromPayload(payload);
            const existingComparable = buildComparableSubsetFromExisting(existing, payload);

            const incomingHash = sha256(stableStringify(incomingComparable));
            const existingHash = sha256(stableStringify(existingComparable));
            const shouldRestoreDeleted = Boolean(existing.deletedAt);

            if (incomingHash === existingHash && !shouldRestoreDeleted) {
              ignored++;
              warnings.push(`Linha ${line}: ignorada (sem alterações).`);
              continue;
            }

            const { data, changes } = buildUpdatePayload(existing, payload);

            if (!changes.length && !shouldRestoreDeleted) {
              ignored++;
              warnings.push(`Linha ${line}: ignorada (hash diferente sem mudança real).`);
              continue;
            }

            console.log('[deliveryReport.import.diff]', {
              line,
              cte: cteKey,
              incomingHash,
              existingHash,
              incomingComparable,
              existingComparable,
              changes,
            });

            const updatePayload = {
              ...data,
              updatedById: user?.id || null,
            };

            if (shouldRestoreDeleted) {
              updatePayload.deletedAt = null;
              updatePayload.deletedById = null;
            }

            await existing.update(updatePayload, { transaction });

            if (changes.length) {
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
            }

            if (shouldRestoreDeleted) {
              await registerHistory({
                transaction,
                deliveryReportId: existing.id,
                actionType: 'RESTORED',
                comments: `Registro restaurado via Excel na linha ${line}.`,
                userMeta,
              });
            }

            existing = await DeliveryReport.findByPk(existing.id, {
              transaction,
              paranoid: false,
            });

            existingMap.set(cteKey, existing);
            updated++;
          } catch (err) {
            console.error('[deliveryReport.import.line_error]', {
              line,
              cte: cteKey || null,
              error: err.message,
            });

            if (isFatalConnectionError(err)) {
              throw err;
            }

            errors.push(`Linha ${line}: ${err.message}`);
          }
        }

        await transaction.commit();
      } catch (err) {
        await rollbackQuietly(transaction);

        if (isFatalConnectionError(err)) {
          console.error('[deliveryReport.processImportJob.chunk_fatal]', err);

          updateImportJob(jobId, {
            status: 'error',
            finishedAt: new Date().toISOString(),
            currentLine: null,
            inserted,
            updated,
            ignored,
            errors: [...errors, `Falha fatal de conexão com o banco no lote ${chunkIndex + 1}.`],
            warnings,
            message: `Falha fatal de conexão com o banco. (${IMPORT_CONTROLLER_VERSION})`,
          });

          return;
        }

        throw err;
      }

      updateImportJob(jobId, {
        currentLine: chunk[chunk.length - 1]?.line || null,
        processed: Math.min((chunkIndex + 1) * 100, mappedRows.length),
        inserted,
        updated,
        ignored,
        errors,
        warnings,
        message: `Lote ${chunkIndex + 1}/${chunks.length} concluído. (${IMPORT_CONTROLLER_VERSION})`,
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
      warnings,
      message: `Importação concluída. (${IMPORT_CONTROLLER_VERSION})`,
    });
  } catch (error) {
    console.error('[deliveryReport.processImportJob]', error);

    updateImportJob(jobId, {
      status: 'error',
      finishedAt: new Date().toISOString(),
      currentLine: null,
      message: error?.message || `Erro ao importar planilha. (${IMPORT_CONTROLLER_VERSION})`,
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
      message: `Importação iniciada com sucesso. (${IMPORT_CONTROLLER_VERSION})`,
      jobId: job.jobId,
      status: job.status,
      version: IMPORT_CONTROLLER_VERSION,
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