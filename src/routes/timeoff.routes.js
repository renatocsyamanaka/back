const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/timeoffController');

/**
 * @swagger
 * tags:
 *   name: TimeOff
 *   description: Folgas e ausências de colaboradores
 */

/**
 * @swagger
 * /api/timeoff:
 *   post:
 *     summary: Solicita folga/ausência
 *     tags: [TimeOff]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, startDate, endDate, reason]
 *             properties:
 *               userId:
 *                 type: integer
 *                 example: 5
 *               startDate:
 *                 type: string
 *                 format: date
 *                 example: "2025-08-15"
 *               endDate:
 *                 type: string
 *                 format: date
 *                 example: "2025-08-20"
 *               reason:
 *                 type: string
 *                 example: "Férias"
 *               type:
 *                 type: string
 *                 enum: [Férias, Doença, Pessoal, Outro]
 *                 example: "Pessoal"
 *     responses:
 *       201:
 *         description: Solicitação registrada com sucesso
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Não autenticado
 */
router.post('/', auth(), ctrl.request);

module.exports = router;
