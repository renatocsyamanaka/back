const router = require('express').Router();
const ctrl = require('../controllers/installationProjectDashboardController');

/**
 * @swagger
 * /api/installation-projects/dashboard/overview:
 *   get:
 *     summary: Consulta registros
 *     tags: [Dashboard Projetos de Instalação]
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
router.get('/overview', (req, res, next) => {
  next();
}, ctrl.overview);

/**
 * @swagger
 * /api/installation-projects/dashboard/summary:
 *   get:
 *     summary: Consulta registros
 *     tags: [Dashboard Projetos de Instalação]
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
router.get('/summary', ctrl.summary);
/**
 * @swagger
 * /api/installation-projects/dashboard/productivity:
 *   get:
 *     summary: Consulta registros
 *     tags: [Dashboard Projetos de Instalação]
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
router.get('/productivity', ctrl.productivity);
/**
 * @swagger
 * /api/installation-projects/dashboard/productivity/day-details:
 *   get:
 *     summary: Consulta registros
 *     tags: [Dashboard Projetos de Instalação]
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
router.get('/productivity/day-details', ctrl.productivityDayDetails);
/**
 * @swagger
 * /api/installation-projects/dashboard/productivity/week-details:
 *   get:
 *     summary: Consulta registros
 *     tags: [Dashboard Projetos de Instalação]
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
router.get('/productivity/week-details', ctrl.productivityWeekDetails);
/**
 * @swagger
 * /api/installation-projects/dashboard/by-client:
 *   get:
 *     summary: Consulta registros
 *     tags: [Dashboard Projetos de Instalação]
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
router.get('/by-client', ctrl.byClient);
/**
 * @swagger
 * /api/installation-projects/dashboard/by-status:
 *   get:
 *     summary: Consulta registros
 *     tags: [Dashboard Projetos de Instalação]
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
router.get('/by-status', ctrl.byStatus);
/**
 * @swagger
 * /api/installation-projects/dashboard/success-rate:
 *   get:
 *     summary: Consulta registros
 *     tags: [Dashboard Projetos de Instalação]
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
router.get('/success-rate', ctrl.successRate);
/**
 * @swagger
 * /api/installation-projects/dashboard/by-coordinator:
 *   get:
 *     summary: Consulta registros
 *     tags: [Dashboard Projetos de Instalação]
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
router.get('/by-coordinator', ctrl.byCoordinator);
/**
 * @swagger
 * /api/installation-projects/dashboard/by-technician:
 *   get:
 *     summary: Consulta registros
 *     tags: [Dashboard Projetos de Instalação]
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
router.get('/by-technician', ctrl.byTechnician);
/**
 * @swagger
 * /api/installation-projects/dashboard/by-region:
 *   get:
 *     summary: Consulta registros
 *     tags: [Dashboard Projetos de Instalação]
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
router.get('/by-region', ctrl.byRegion);
/**
 * @swagger
 * /api/installation-projects/dashboard/ending-soon:
 *   get:
 *     summary: Consulta registros
 *     tags: [Dashboard Projetos de Instalação]
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
router.get('/ending-soon', ctrl.endingSoon);
/**
 * @swagger
 * /api/installation-projects/dashboard/by-product:
 *   get:
 *     summary: Consulta registros
 *     tags: [Dashboard Projetos de Instalação]
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
router.get('/by-product', ctrl.byProduct);
/**
 * @swagger
 * /api/installation-projects/dashboard/map:
 *   get:
 *     summary: Consulta registros
 *     tags: [Dashboard Projetos de Instalação]
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
router.get('/map', ctrl.map);
/**
 * @swagger
 * /api/installation-projects/dashboard/delayed-projects:
 *   get:
 *     summary: Consulta registros
 *     tags: [Dashboard Projetos de Instalação]
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
router.get('/delayed-projects', ctrl.delayedProjects);

module.exports = router;