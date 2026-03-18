const router = require('express').Router();
const { Op } = require('sequelize');
const auth = require('../middleware/auth');
const upload = require('../middleware/uploadExcel');
const XLSX = require('xlsx');

const { Client } = require('../models');
const clientController = require('../controllers/clientController');
const { ok, bad, created } = require('../utils/responses');

/**
 * GET /api/clients/autocomplete
 * Público para tela de solicitação de peças
 */
router.get('/autocomplete', clientController.searchAutocomplete);

/**
 * POST /api/clients
 * Cadastra cliente com TODOS os campos do Excel
 */
router.post('/', auth(), async (req, res) => {
  try {
    const {
      idCliente,
      name,
      nomeFantasia,
      documento,
      tipoCliente,
      segmentacao,
      estado,
      cidade,
      bairro,
      logradouro,
      complemento,
      cep,
      latitude,
      longitude,
      email1,
      telefone1,
      email2,
      telefone2,
    } = req.body;

    const required = [
      ['idCliente', idCliente],
      ['name', name],
      ['documento', documento],
      ['tipoCliente', tipoCliente],
      ['segmentacao', segmentacao],
      ['estado', estado],
      ['cidade', cidade],
      ['bairro', bairro],
      ['logradouro', logradouro],
      ['cep', cep],
      ['email1', email1],
      ['telefone1', telefone1],
    ];

    const missing = required
      .filter(([, v]) => !String(v || '').trim())
      .map(([k]) => k);

    if (missing.length) {
      return bad(res, `Campos obrigatórios faltando: ${missing.join(', ')}`);
    }

    const exists = await Client.findOne({
      where: { idCliente: String(idCliente).trim() },
    });

    if (exists) {
      return bad(res, 'Já existe um cliente com esse ID_cliente');
    }

    const row = await Client.create({
      idCliente: String(idCliente).trim(),
      name: String(name).trim(),
      nomeFantasia: nomeFantasia ? String(nomeFantasia).trim() : null,
      documento: String(documento).trim(),
      tipoCliente: String(tipoCliente).trim(),
      segmentacao: String(segmentacao).trim(),
      estado: String(estado).trim(),
      cidade: String(cidade).trim(),
      bairro: String(bairro).trim(),
      logradouro: String(logradouro).trim(),
      complemento: complemento ? String(complemento).trim() : null,
      cep: String(cep).trim(),
      latitude: latitude ? String(latitude).trim() : null,
      longitude: longitude ? String(longitude).trim() : null,
      email1: String(email1).trim(),
      telefone1: String(telefone1).trim(),
      email2: email2 ? String(email2).trim() : null,
      telefone2: telefone2 ? String(telefone2).trim() : null,
    });

    return created(res, row);
  } catch (e) {
    return bad(res, e?.parent?.sqlMessage || e?.message || 'Erro ao cadastrar cliente');
  }
});

/**
 * GET /api/clients
 * Lista clientes
 */
router.get('/', auth(), async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();

    const where = q
      ? {
          [Op.or]: [
            { name: { [Op.like]: `%${q}%` } },
            { documento: { [Op.like]: `%${q}%` } },
            { telefone1: { [Op.like]: `%${q}%` } },
            { cidade: { [Op.like]: `%${q}%` } },
            { estado: { [Op.like]: `%${q}%` } },
          ],
        }
      : undefined;

    const list = await Client.findAll({
      where,
      order: [['id', 'DESC']],
      attributes: ['id', 'name', 'telefone1', 'documento', 'estado', 'cidade'],
    });

    return ok(res, list);
  } catch (e) {
    return bad(res, e?.parent?.sqlMessage || e?.message || 'Erro ao listar clientes');
  }
});

/**
 * GET /api/clients/:id
 * Detalhe completo
 */
router.get('/:id', auth(), async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isFinite(id) || id <= 0) {
      return bad(res, 'ID inválido');
    }

    const row = await Client.findByPk(id);

    if (!row) {
      return bad(res, 'Cliente não encontrado');
    }

    return ok(res, row);
  } catch (e) {
    return bad(res, e?.parent?.sqlMessage || e?.message || 'Erro ao carregar cliente');
  }
});

/**
 * POST /api/clients/import/stream
 * Importação via Excel com SSE
 */
router.post('/import/stream', auth(), upload.single('file'), async (req, res) => {
  if (!req.file) return bad(res, 'Arquivo não enviado');

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const send = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    let createdCount = 0;
    let updatedCount = 0;
    let processed = 0;
    const total = rows.length;
    const errors = [];

    send('start', { total });

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      try {
        const idCliente = String(row.ID_cliente || '').trim();
        if (!idCliente) throw new Error('ID_cliente ausente');

        const payload = {
          idCliente,
          name: String(row.cliente || '').trim(),
          nomeFantasia: String(row.nome_fantasia || '').trim() || null,
          documento: String(row['cpf/cnpj'] || '').trim() || null,
          tipoCliente: String(row.tipo_cliente || '').trim() || null,
          segmentacao: String(row.segmentacao || '').trim() || null,
          estado: String(row.estado || '').trim() || null,
          cidade: String(row.cidade || '').trim() || null,
          bairro: String(row.bairro || '').trim() || null,
          logradouro: String(row.logradouro || '').trim() || null,
          complemento: String(row.complemento || '').trim() || null,
          cep: String(row.cep || '').trim() || null,
          latitude: String(row.latitude || '').trim() || null,
          longitude: String(row.longitude || '').trim() || null,
          email1: String(row.email1 || '').trim() || null,
          telefone1: String(row.telefone1 || '').trim() || null,
          email2: String(row.email2 || '').trim() || null,
          telefone2: String(row.telefone2 || '').trim() || null,
        };

        if (!payload.name) throw new Error('cliente (name) ausente');

        const existing = await Client.findOne({ where: { idCliente } });

        if (existing) {
          await existing.update(payload);
          updatedCount++;
        } else {
          await Client.create(payload);
          createdCount++;
        }
      } catch (err) {
        errors.push({
          linha: i + 2,
          erro: err.message,
        });
      }

      processed++;

      if (processed % 10 === 0 || processed === total) {
        send('progress', {
          processed,
          total,
          created: createdCount,
          updated: updatedCount,
        });
      }
    }

    send('done', {
      total,
      processed,
      created: createdCount,
      updated: updatedCount,
      errors,
    });

    res.end();
  } catch (err) {
    send('error', { message: err.message || 'Falha ao importar' });
    res.end();
  }
});

module.exports = router;