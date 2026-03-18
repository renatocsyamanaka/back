const Joi = require('joi');
const { Op } = require('sequelize');
const { News, Sector } = require('../models');
const { ok, created, bad, notFound } = require('../utils/responses');
const path = require('path');
const fs = require('fs');

const createSchema = Joi.object({
  title: Joi.string().min(3).max(160).required(),
  content: Joi.string().min(3).required(),
  category: Joi.string().max(60).allow(null, ''),
  isActive: Joi.boolean().default(true),

  // NOVOS
  targetAllSectors: Joi.boolean().default(true),
  sectorIds: Joi.array().items(Joi.number().integer().positive()).default([]),
}).required();

const updateSchema = Joi.object({
  title: Joi.string().min(3).max(160).allow(null, ''),
  content: Joi.string().min(3).allow(null, ''),
  category: Joi.string().max(60).allow(null, ''),
  isActive: Joi.boolean().allow(null),

  // NOVOS
  targetAllSectors: Joi.boolean().allow(null),
  sectorIds: Joi.array().items(Joi.number().integer().positive()).allow(null),
}).required();

function buildImageUrl(req, fileName) {
  const BASE_URL = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  return `${BASE_URL}/uploads/news/${fileName}`;
}

async function validateSectorIds(sectorIds = []) {
  if (!Array.isArray(sectorIds) || sectorIds.length === 0) return [];

  const found = await Sector.findAll({
    where: { id: sectorIds },
    attributes: ['id'],
  });

  const foundIds = found.map(s => s.id);
  const invalidIds = sectorIds.filter(id => !foundIds.includes(id));

  if (invalidIds.length) {
    throw new Error(`Setores inválidos: ${invalidIds.join(', ')}`);
  }

  return foundIds;
}

module.exports = {
  async list(req, res) {
    try {
      const onlyActive = req.query.onlyActive === 'true';
      const sectorId =
        Number(req.query.sectorId) ||
        Number(req.user?.sectorId) ||
        null;

      const where = {};
      if (onlyActive) where.isActive = true;

      const include = [
        {
          model: Sector,
          as: 'sectors',
          attributes: ['id', 'name'],
          through: { attributes: [] },
          required: false,
        },
      ];

      // Se veio setor na query ou usuário possui setor:
      // retorna notícias para todos OU vinculadas ao setor
      if (sectorId) {
        const rows = await News.findAll({
          where,
          include,
          order: [['createdAt', 'DESC']],
        });

        const filtered = rows.filter(row => {
          if (row.targetAllSectors) return true;
          return (row.sectors || []).some(s => Number(s.id) === Number(sectorId));
        });

        return ok(res, filtered);
      }

      const rows = await News.findAll({
        where,
        include,
        order: [['createdAt', 'DESC']],
      });

      return ok(res, rows);
    } catch (e) {
      console.error('[news.list]', e);
      return bad(res, 'Falha ao listar notícias');
    }
  },

  async getById(req, res) {
    try {
      const row = await News.findByPk(req.params.id, {
        include: [
          {
            model: Sector,
            as: 'sectors',
            attributes: ['id', 'name'],
            through: { attributes: [] },
          },
        ],
      });

      if (!row) return notFound(res, 'Notícia não encontrada');
      return ok(res, row);
    } catch (e) {
      console.error('[news.getById]', e);
      return bad(res, 'Falha ao buscar notícia');
    }
  },

  async create(req, res) {
    const { error, value } = createSchema.validate(req.body, { stripUnknown: true });
    if (error) return bad(res, error.message);

    try {
      const targetAllSectors = value.targetAllSectors ?? true;
      const sectorIds = value.sectorIds || [];

      if (!targetAllSectors && sectorIds.length === 0) {
        return bad(res, 'Informe ao menos um setor ou marque a notícia como "todos os setores"');
      }

      const validSectorIds = await validateSectorIds(sectorIds);

      const row = await News.create({
        title: value.title,
        content: value.content,
        category: value.category || null,
        isActive: value.isActive ?? true,
        targetAllSectors,
        createdById: req.user?.id || null,
      });

      if (!targetAllSectors && validSectorIds.length > 0) {
        await row.setSectors(validSectorIds);
      }

      const fresh = await News.findByPk(row.id, {
        include: [
          {
            model: Sector,
            as: 'sectors',
            attributes: ['id', 'name'],
            through: { attributes: [] },
          },
        ],
      });

      return created(res, fresh);
    } catch (e) {
      console.error('[news.create]', e);
      return bad(res, e.message || 'Falha ao criar notícia');
    }
  },

  async update(req, res) {
    const { error, value } = updateSchema.validate(req.body, { stripUnknown: true });
    if (error) return bad(res, error.message);

    try {
      const row = await News.findByPk(req.params.id, {
        include: [
          {
            model: Sector,
            as: 'sectors',
            attributes: ['id', 'name'],
            through: { attributes: [] },
          },
        ],
      });

      if (!row) return notFound(res, 'Notícia não encontrada');

      const nextTargetAllSectors =
        value.targetAllSectors != null ? value.targetAllSectors : row.targetAllSectors;

      if (nextTargetAllSectors === false && Array.isArray(value.sectorIds) && value.sectorIds.length === 0) {
        return bad(res, 'Informe ao menos um setor ou marque a notícia como "todos os setores"');
      }

      await row.update({
        title: value.title != null && value.title !== '' ? value.title : row.title,
        content: value.content != null && value.content !== '' ? value.content : row.content,
        category: value.category != null ? (value.category || null) : row.category,
        isActive: value.isActive != null ? value.isActive : row.isActive,
        targetAllSectors: nextTargetAllSectors,
      });

      if (Array.isArray(value.sectorIds)) {
        const validSectorIds = await validateSectorIds(value.sectorIds);

        if (nextTargetAllSectors) {
          await row.setSectors([]);
        } else {
          await row.setSectors(validSectorIds);
        }
      } else if (nextTargetAllSectors) {
        await row.setSectors([]);
      }

      const fresh = await News.findByPk(row.id, {
        include: [
          {
            model: Sector,
            as: 'sectors',
            attributes: ['id', 'name'],
            through: { attributes: [] },
          },
        ],
      });

      return ok(res, fresh);
    } catch (e) {
      console.error('[news.update]', e);
      return bad(res, e.message || 'Falha ao atualizar notícia');
    }
  },

  async remove(req, res) {
    try {
      const row = await News.findByPk(req.params.id);
      if (!row) return notFound(res, 'Notícia não encontrada');

      if (row.imageUrl) {
        try {
          const u = new URL(row.imageUrl);
          const rel = u.pathname.replace(/^\/+/, '');
          const filePath = path.resolve(process.cwd(), rel);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch {}
      }

      await row.destroy();
      return ok(res, { ok: true });
    } catch (e) {
      console.error('[news.remove]', e);
      return bad(res, 'Falha ao remover notícia');
    }
  },

  async uploadImage(req, res) {
    try {
      const row = await News.findByPk(req.params.id);
      if (!row) return notFound(res, 'Notícia não encontrada');

      if (!req.file) return bad(res, 'Arquivo não enviado (campo "image")');

      const url = buildImageUrl(req, req.file.filename);

      if (row.imageUrl) {
        try {
          const u = new URL(row.imageUrl);
          const rel = u.pathname.replace(/^\/+/, '');
          const filePath = path.resolve(process.cwd(), rel);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch {}
      }

      await row.update({ imageUrl: url });
      return ok(res, row);
    } catch (e) {
      console.error('[news.uploadImage]', e);
      return bad(res, 'Falha ao enviar imagem');
    }
  },
};