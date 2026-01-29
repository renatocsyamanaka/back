const router = require('express').Router();
const auth = require('../middleware/auth');
const { ok, created, bad } = require('../utils/responses');
const { TechType } = require('../models');

/**
 * @swagger
 * tags:
 *   name: TechTypes
 *   description: Tipos de Técnico
 */

/**
 * @swagger
 * /api/tech-types:
 *   post:
 *     summary: Cadastra um novo tipo de técnico
 *     tags: [TechTypes]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Instalador"
 *               description:
 *                 type: string
 *                 example: "Responsável por instalar equipamentos"
 *     responses:
 *       201:
 *         description: Tipo de técnico criado com sucesso
 *       400:
 *         description: Nome é obrigatório
 *       401:
 *         description: Não autenticado
 */
router.post('/', auth(), async (req, res) => {
  const { name, description } = req.body;
  if (!name) return bad(res, 'Nome é obrigatório');
  const row = await TechType.create({ name, description });
  return created(res, row);
});

/**
 * @swagger
 * /api/tech-types:
 *   get:
 *     summary: Lista todos os tipos de técnico
 *     tags: [TechTypes]
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200:
 *         description: Lista de tipos de técnico
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     example: 1
 *                   name:
 *                     type: string
 *                     example: "Instalador"
 *                   description:
 *                     type: string
 *                     example: "Responsável por instalar equipamentos"
 *       401:
 *         description: Não autenticado
 */
router.get('/', auth(), async (_req, res) => {
  const list = await TechType.findAll();
  return ok(res, list);
});

module.exports = router;
