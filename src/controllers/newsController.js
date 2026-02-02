const Joi = require('joi');
const { Op, UniqueConstraintError } = require('sequelize'); // ⬅️ importa o erro único
const { News, NewsRead, User } = require('../models');
const { ok, created, bad, notFound, forbidden } = require('../utils/responses');

const BASE_URL = process.env.BASE_URL || 'https://api.projetos-rc.online';

const createSchema = Joi.object({
  title: Joi.string().required(),
  summary: Joi.string().allow(null, ''),
  body: Joi.string().required(),
  audience: Joi.string().valid('ALL', 'ROLE', 'USER').default('ALL'),
  targetRoleLevel: Joi.number().integer().allow(null),
  targetUserId: Joi.number().integer().allow(null),
  pinned: Joi.boolean().default(false),
  publishedAt: Joi.date().optional(),
  expiresAt: Joi.date().allow(null),
  coverUrl: Joi.string().allow(null, ''),
  tags: Joi.any().optional(), // JSON
});

const listSchema = Joi.object({
  includeExpired: Joi.boolean().truthy('1', 'true').falsy('0', 'false').default(false),
});

module.exports = {
  async create(req, res) {
    const { error, value } = createSchema.validate(req.body);
    if (error) return bad(res, error.message);

    if (value.audience === 'ROLE' && !value.targetRoleLevel) {
      return bad(res, 'Informe targetRoleLevel quando audience=ROLE');
    }
    if (value.audience === 'USER' && !value.targetUserId) {
      return bad(res, 'Informe targetUserId quando audience=USER');
    }

    if (!(req.user?.role?.level >= 2)) return forbidden(res, 'Sem permissão');

    // imagem opcional (campo "image" no multipart)
    let imageUrl = null;
    if (req.file) imageUrl = `${BASE_URL}/uploads/news/${req.file.filename}`;

    const row = await News.create({
      title: value.title,
      summary: value.summary ?? null,
      body: value.body,
      audience: value.audience,
      targetRoleLevel: value.targetRoleLevel ?? null,
      targetUserId: value.targetUserId ?? null,
      pinned: !!value.pinned,
      imageUrl,
      coverUrl: value.coverUrl ?? null,
      tags: value.tags ?? null,
      publishedAt: value.publishedAt || new Date(),
      expiresAt: value.expiresAt ?? null,
      createdById: req.user.id,
    });

    const news = await News.findByPk(row.id, {
      include: [{ model: User, as: 'creator', attributes: ['id', 'name'] }],
    });

    return created(res, news);
  },

  async list(req, res) {
    const { error, value } = listSchema.validate(req.query);
    if (error) return bad(res, error.message);

    const now = new Date();
    const where = {};
    if (!value.includeExpired) {
      where[Op.or] = [{ expiresAt: null }, { expiresAt: { [Op.gt]: now } }];
    }

    const rows = await News.findAll({
      where,
      include: [{ model: User, as: 'creator', attributes: ['id', 'name'] }],
      order: [['pinned', 'DESC'], ['publishedAt', 'DESC'], ['createdAt', 'DESC']],
    });

    const myLevel = req.user?.role?.level ?? 0;
    const myId = req.user?.id;

    const visible = rows.filter((n) => {
      if (n.audience === 'ALL') return true;
      if (n.audience === 'ROLE') return myLevel >= (n.targetRoleLevel || 0);
      if (n.audience === 'USER') return n.targetUserId === myId;
      return false;
    });

    const read = await NewsRead.findAll({
      where: { userId: myId, newsId: { [Op.in]: visible.map((v) => v.id) } },
      attributes: ['newsId'],
    });
    const readSet = new Set(read.map((r) => r.newsId));

    return ok(
      res,
      visible.map((n) => ({ ...n.toJSON(), read: readSet.has(n.id) }))
    );
  },

  // ⬇️ Agora "markRead" está dentro do objeto exportado, com tratamento robusto
  async markRead(req, res) {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const news = await News.findByPk(id);
    if (!news) return notFound(res, 'Notícia não encontrada');

    try {
      await NewsRead.create({
        newsId: id,
        userId: req.user.id,
        readAt: new Date(),
      });
    } catch (err) {
      if (err instanceof UniqueConstraintError) {
        await NewsRead.update(
          { readAt: new Date() },
          { where: { newsId: id, userId: req.user.id } }
        );
      } else {
        console.error('markRead error:', err);
        return res.status(500).json({ error: 'Falha ao marcar leitura' });
      }
    }

    return ok(res, { ok: true });
  },

  async remove(req, res) {
    if (!(req.user?.role?.level >= 4)) return forbidden(res, 'Apenas gerente+');
    const { id } = req.params;
    const n = await News.findByPk(id);
    if (!n) return notFound(res, 'Notícia não encontrada');
    await NewsRead.destroy({ where: { newsId: id } });
    await n.destroy();
    return ok(res, { ok: true });
  },
};
