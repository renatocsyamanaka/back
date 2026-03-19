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