const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/dashboardHomeController');

router.use(auth());

/**
 * @swagger
 * /api/dashboard-home:
 *   get:
 *     summary: Consulta registros
 *     tags: [Dashboard Home]
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
router.get('/', ctrl.getHome);

module.exports = router;