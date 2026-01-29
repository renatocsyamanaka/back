const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/assignmentController');

/**
 * @swagger
 * tags:
 *   - name: Assignments
 *     description: Agenda dos colaboradores
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     AssignmentCreate:
 *       type: object
 *       required: [userId, start, end]
 *       properties:
 *         userId:
 *           type: integer
 *           example: 2
 *         clientId:
 *           type: integer
 *           nullable: true
 *           example: 1
 *         locationId:
 *           type: integer
 *           nullable: true
 *           example: 3
 *         start:
 *           type: string
 *           format: date-time
 *           example: "2025-08-11T09:00:00Z"
 *         end:
 *           type: string
 *           format: date-time
 *           example: "2025-08-11T18:00:00Z"
 *         description:
 *           type: string
 *           example: "Visita ao cliente RJ"
 *         type:
 *           type: string
 *           enum: [CLIENT, INTERNAL, TRAVEL]
 *           example: CLIENT
 *     Assignment:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 10
 *         userId:
 *           type: integer
 *           example: 2
 *         clientId:
 *           type: integer
 *           nullable: true
 *         locationId:
 *           type: integer
 *           nullable: true
 *         start:
 *           type: string
 *           format: date-time
 *         end:
 *           type: string
 *           format: date-time
 *         description:
 *           type: string
 *         type:
 *           type: string
 *           enum: [CLIENT, INTERNAL, TRAVEL]
 */

/**
 * @swagger
 * /api/assignments:
 *   post:
 *     summary: Cria um compromisso/atividade na agenda
 *     tags: [Assignments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AssignmentCreate'
 *           examples:
 *             exemplo:
 *               value:
 *                 userId: 2
 *                 clientId: 1
 *                 locationId: 1
 *                 start: "2025-08-11T09:00:00Z"
 *                 end: "2025-08-11T18:00:00Z"
 *                 description: "Visita ao cliente RJ"
 *                 type: "CLIENT"
 *     responses:
 *       201:
 *         description: Compromisso criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Assignment'
 *       400:
 *         description: Dados inválidos (ex. campos obrigatórios ausentes)
 *       401:
 *         description: Não autenticado (Bearer token ausente ou inválido)
 */
router.post('/', auth(), ctrl.create);

/**
 * @swagger
 * /api/assignments/week/{userId}:
 *   get:
 *     summary: Agenda semanal de um colaborador
 *     description: Retorna todos os compromissos dentro da semana da data informada (ou da semana atual se não enviada).
 *     tags: [Assignments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do colaborador
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: "Qualquer data dentro da semana desejada (YYYY-MM-DD). Opcional."
 *     responses:
 *       200:
 *         description: Lista de atividades da semana
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Assignment'
 *       401:
 *         description: Não autenticado (Bearer token ausente ou inválido)
 */
router.get('/week/:userId', auth(), ctrl.week);

/**
 * @swagger
 * /api/assignments/range:
 *   get:
 *     summary: Lista compromissos por intervalo (ex. mês)
 *     tags: [Assignments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Data inicial (YYYY-MM-DD)
 *       - in: query
 *         name: to
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Data final (YYYY-MM-DD)
 *       - in: query
 *         name: userIds
 *         schema:
 *           type: string
 *         description: "IDs de usuários separados por vírgula (ex. 2,3,7). Se ausente, traz todos."
 *     responses:
 *       200:
 *         description: Compromissos no intervalo solicitado
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Assignment'
 *       400:
 *         description: Parâmetros inválidos
 */
router.get('/range', auth(), ctrl.range);

module.exports = router;
