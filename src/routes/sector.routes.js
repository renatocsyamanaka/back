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
 *     security: [{ bearerAuth: [] }]
 */
router.get('/', auth(), ctrl.list);

/**
 * @swagger
 * /api/sectors/{id}:
 *   get:
 *     summary: Detalhar setor
 *     tags: [Sectors]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/:id', auth(), ctrl.getById);

/**
 * @swagger
 * /api/sectors:
 *   post:
 *     summary: Criar setor
 *     tags: [Sectors]
 *     security: [{ bearerAuth: [] }]
 */
router.post('/', auth(), requireLevel(2), ctrl.create);

/**
 * @swagger
 * /api/sectors/{id}:
 *   patch:
 *     summary: Editar setor
 *     tags: [Sectors]
 *     security: [{ bearerAuth: [] }]
 */
router.patch('/:id', auth(), requireLevel(2), ctrl.update);

/**
 * @swagger
 * /api/sectors/{id}:
 *   delete:
 *     summary: Remover setor
 *     tags: [Sectors]
 *     security: [{ bearerAuth: [] }]
 */
router.delete('/:id', auth(), requireLevel(2), ctrl.remove);

module.exports = router;