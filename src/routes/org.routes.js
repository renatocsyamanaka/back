const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/orgController');

/**
 * @swagger
 * tags:
 *   name: Org
 *   description: Operações relacionadas ao organograma da empresa
 */

/**
 * @swagger
 * /api/org/tree:
 *   get:
 *     summary: Retorna a árvore do organograma
 *     tags: [Org]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Árvore do organograma retornada com sucesso
 *       401:
 *         description: Não autenticado
 */
router.get('/tree', auth(), ctrl.tree);

module.exports = router;