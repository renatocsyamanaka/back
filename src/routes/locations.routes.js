const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/locationController');

/**
 * @swagger
 * tags:
 *   name: Locations
 *   description: Locais/Regiões
 */

/**
 * @swagger
 * /api/locations:
 *   post:
 *     summary: Cria uma localização
 *     tags: [Locations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: "RIO"
 *               area:
 *                 type: string
 *                 example: "RJ"
 *               city:
 *                 type: string
 *                 example: "Rio de Janeiro"
 *               state:
 *                 type: string
 *                 example: "Rio de Janeiro"
 *               uf:
 *                 type: string
 *                 example: "RJ"
 *               lat:
 *                 type: number
 *                 example: -22.9068
 *               lng:
 *                 type: number
 *                 example: -43.1729
 *     responses:
 *       201:
 *         description: Localização criada com sucesso
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Não autorizado
 */
router.post('/', auth(), ctrl.create);

/**
 * @swagger
 * /api/locations:
 *   get:
 *     summary: Lista localizações
 *     tags: [Locations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Busca por nome, cidade, estado ou UF
 *         example: "Rio"
 *       - in: query
 *         name: uf
 *         schema:
 *           type: string
 *         description: Filtra pela UF
 *         example: "RJ"
 *     responses:
 *       200:
 *         description: Lista retornada com sucesso
 *       401:
 *         description: Não autorizado
 */
router.get('/', auth(), ctrl.list);

/**
 * @swagger
 * /api/locations/{id}:
 *   patch:
 *     summary: Atualiza dados do local
 *     tags: [Locations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID da localização
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "RIO"
 *               area:
 *                 type: string
 *                 example: "RJ"
 *               city:
 *                 type: string
 *                 example: "Rio de Janeiro"
 *               state:
 *                 type: string
 *                 example: "Rio de Janeiro"
 *               uf:
 *                 type: string
 *                 example: "RJ"
 *               lat:
 *                 type: number
 *                 example: -22.9068
 *               lng:
 *                 type: number
 *                 example: -43.1729
 *     responses:
 *       200:
 *         description: Localização atualizada com sucesso
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Não encontrado
 */
router.patch('/:id', auth(), ctrl.update);

module.exports = router;