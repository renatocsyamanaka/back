const router = require('express').Router();
const auth = require('../middleware/auth');
const requireLevel = require('../middleware/rbac');
const ctrl = require('../controllers/sectorController');

/**
 * @swagger
 * tags:
 *   name: Sectors
 *   description: Setores do sistema
 */

/**
 * @swagger
 * /api/sectors:
 *   get:
 *     summary: Listar setores
 *     tags: [Sectors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Busca por nome ou descrição
 *         example: "Operações"
 *     responses:
 *       200:
 *         description: Lista de setores retornada com sucesso
 */
router.get('/', auth(), ctrl.list);

/**
 * @swagger
 * /api/sectors/{id}:
 *   get:
 *     summary: Detalhar setor
 *     tags: [Sectors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do setor
 *         example: 1
 *     responses:
 *       200:
 *         description: Setor encontrado
 *       404:
 *         description: Setor não encontrado
 */
router.get('/:id', auth(), ctrl.getById);

/**
 * @swagger
 * /api/sectors:
 *   post:
 *     summary: Criar setor
 *     tags: [Sectors]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Operações"
 *               description:
 *                 type: string
 *                 example: "Setor responsável pelas operações"
 *     responses:
 *       201:
 *         description: Setor criado com sucesso
 *       400:
 *         description: Dados inválidos
 */
router.post('/', auth(), requireLevel(2), ctrl.create);

/**
 * @swagger
 * /api/sectors/{id}:
 *   patch:
 *     summary: Editar setor
 *     tags: [Sectors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do setor
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Operações"
 *               description:
 *                 type: string
 *                 example: "Descrição atualizada"
 *     responses:
 *       200:
 *         description: Setor atualizado com sucesso
 *       404:
 *         description: Setor não encontrado
 */
router.patch('/:id', auth(), requireLevel(2), ctrl.update);

/**
 * @swagger
 * /api/sectors/{id}:
 *   delete:
 *     summary: Remover setor
 *     tags: [Sectors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do setor
 *         example: 1
 *     responses:
 *       200:
 *         description: Setor removido com sucesso
 *       404:
 *         description: Setor não encontrado
 */
router.delete('/:id', auth(), requireLevel(2), ctrl.remove);

module.exports = router;