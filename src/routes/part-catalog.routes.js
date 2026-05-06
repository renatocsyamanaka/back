const router = require('express').Router();
const auth = require('../middleware/auth');
const requireLevel = require('../middleware/rbac');
const ctrl = require('../controllers/partCatalogController');

/**
 * @swagger
 * tags:
 *   name: PartCatalog
 *   description: Catálogo de itens/peças
 */

/**
 * @swagger
 * /api/parts:
 *   post:
 *     summary: Cadastra um item no catálogo
 *     tags: [PartCatalog]
 *     security: [{ bearerAuth: [] }]
 *   get:
 *     summary: Lista itens do catálogo
 *     tags: [PartCatalog]
 *     security: [{ bearerAuth: [] }]
 */
router.post('/', auth(), requireLevel(2), ctrl.create);
/**
 * @swagger
 * /api/parts:
 *   get:
 *     summary: Consulta registros
 *     tags: [Catálogo de Peças]
 *     responses:
 *       200:
 *         description: Operação realizada com sucesso
 *       400:
 *         description: Requisição inválida
 *       404:
 *         description: Registro não encontrado
 *       500:
 *         description: Erro interno
 */
router.get('/',  ctrl.list);

/**
 * @swagger
 * /api/parts/{id}:
 *   get:
 *     summary: Busca detalhe de um item
 *     tags: [PartCatalog]
 *     security: [{ bearerAuth: [] }]
 *   patch:
 *     summary: Atualiza um item
 *     tags: [PartCatalog]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/:id', auth(), ctrl.show);
/**
 * @swagger
 * /api/parts/{id}:
 *   patch:
 *     summary: Atualiza parcialmente registro
 *     tags: [Catálogo de Peças]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador id
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *     responses:
 *       200:
 *         description: Operação realizada com sucesso
 *       400:
 *         description: Requisição inválida
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão
 *       404:
 *         description: Registro não encontrado
 *       500:
 *         description: Erro interno
 */
router.patch('/:id', auth(), requireLevel(2), ctrl.update);

/**
 * @swagger
 * /api/parts/{id}/toggle-active:
 *   patch:
 *     summary: Ativa ou desativa um item
 *     tags: [PartCatalog]
 *     security: [{ bearerAuth: [] }]
 */
router.patch('/:id/toggle-active', auth(), requireLevel(2), ctrl.toggleActive);

module.exports = router;