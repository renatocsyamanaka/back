// routes/teamRoutes.js
const router = require('express').Router();
const auth = require('../middleware/auth');
const requireLevel = require('../middleware/rbac');
const ctrl = require('../controllers/teamController');

/**
 * @swagger
 * tags:
 *   name: Team
 *   description: Equipe hierárquica (Coordenador → Supervisor → Técnicos/PSO)
 */

/**
 * @swagger
 * /api/team:
 *   post:
 *     summary: Cria membro da equipe
 *     description: Cria um registro de membro em qualquer papel (COORD, SUP, TEC, PSO).
 *     tags:
 *       - Team
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *               - name
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [COORD, SUP, TEC, PSO]
 *               name:
 *                 type: string
 *                 example: Ana Costa
 *               email:
 *                 type: string
 *                 format: email
 *                 example: ana@empresa.com
 *               region:
 *                 type: string
 *                 example: Sudeste
 *               lat:
 *                 type: number
 *                 example: -23.55
 *               lng:
 *                 type: number
 *                 example: -46.63
 *               active:
 *                 type: boolean
 *                 example: true
 *               userId:
 *                 type: integer
 *                 nullable: true
 *               locationId:
 *                 type: integer
 *                 nullable: true
 *               coordinatorId:
 *                 type: integer
 *                 nullable: true
 *               supervisorId:
 *                 type: integer
 *                 nullable: true
 *     responses:
 *       '201':
 *         description: Criado
 *       '400':
 *         description: Erro de validação
 *       '401':
 *         description: Não autenticado
 *       '403':
 *         description: Permissão insuficiente
 */
router.post('/', auth(), requireLevel(2), ctrl.create);

/**
 * @swagger
 * /api/team:
 *   get:
 *     summary: Lista membros
 *     tags:
 *       - Team
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [COORD, SUP, TEC, PSO]
 *       - in: query
 *         name: active
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: coordinatorId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: supervisorId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: locationId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: OK
 */
router.get('/', auth(), ctrl.list);

/**
 * @swagger
 * /api/team/{id}:
 *   get:
 *     summary: Detalhe do membro
 *     tags:
 *       - Team
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: OK
 *       '404':
 *         description: Não encontrado
 */
router.get('/:id', auth(), ctrl.getById);

/**
 * @swagger
 * /api/team/{id}:
 *   patch:
 *     summary: Atualiza membro
 *     tags:
 *       - Team
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [COORD, SUP, TEC, PSO]
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               region:
 *                 type: string
 *               lat:
 *                 type: number
 *               lng:
 *                 type: number
 *               active:
 *                 type: boolean
 *               userId:
 *                 type: integer
 *                 nullable: true
 *               locationId:
 *                 type: integer
 *                 nullable: true
 *               coordinatorId:
 *                 type: integer
 *                 nullable: true
 *               supervisorId:
 *                 type: integer
 *                 nullable: true
 *     responses:
 *       '200':
 *         description: OK
 *       '404':
 *         description: Não encontrado
 */
router.patch('/:id', auth(), requireLevel(2), ctrl.update);

/**
 * @swagger
 * /api/team/{id}:
 *   delete:
 *     summary: Remove membro
 *     tags:
 *       - Team
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: OK
 *       '404':
 *         description: Não encontrado
 */
router.delete('/:id', auth(), requireLevel(3), ctrl.remove);

/**
 * @swagger
 * /api/team/map:
 *   get:
 *     summary: Dados “flat” para o mapa
 *     description: Retorna lat/lng e hierarquia (coordinatorId/supervisorId) no formato consumido pelo front.
 *     tags:
 *       - Team
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: coordinatorId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: supervisorId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: onlyActive
 *         schema:
 *           type: boolean
 *     responses:
 *       '200':
 *         description: OK
 */
router.get('/map', auth(), ctrl.map);

module.exports = router;
