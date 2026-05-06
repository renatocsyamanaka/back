const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/geocodeController');

// forward geocoding
/**
 * @swagger
 * /api/geocode:
 *   get:
 *     summary: Consulta registros
 *     tags: [Geocode]
 *     security:
 *       - bearerAuth: []
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
router.get('/', auth(), ctrl.search);

// suggest (autocomplete)
/**
 * @swagger
 * /api/geocode/suggest:
 *   get:
 *     summary: Consulta registros
 *     tags: [Geocode]
 *     security:
 *       - bearerAuth: []
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
router.get('/suggest', auth(), ctrl.suggest);

// reverse geocoding
/**
 * @swagger
 * /api/geocode/suggest:
 *   get:
 *     summary: Consulta registros
 *     tags: [Geocode]
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
router.get('/suggest', ctrl.suggest);

module.exports = router;
