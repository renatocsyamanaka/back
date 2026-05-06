const router = require('express').Router();
const controller = require('../controllers/installationProjectGeolocationController');

// GET → auditar geolocalização dos projetos
/**
 * @swagger
 * /api/installation-projects/geolocation/audit:
 *   get:
 *     summary: Consulta registros
 *     tags: [Geolocalização de Projetos]
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
router.get('/audit', controller.audit);

module.exports = router;