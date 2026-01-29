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
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, example: "RIO" }
 *               area: { type: string, example: "RJ" }
 *               city: { type: string, example: "Rio de Janeiro" }
 *               state: { type: string, example: "Rio de Janeiro" }
 *               uf: { type: string, example: "RJ" }
 *               lat: { type: number, example: -22.9068 }
 *               lng: { type: number, example: -43.1729 }
 *     responses:
 *       201: { description: Criado }
 */
router.post('/', auth(), ctrl.create);

/**
 * @swagger
 * /api/locations:
 *   get:
 *     summary: Lista localizações
 *     tags: [Locations]
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200: { description: OK }
 */
router.get('/', auth(), ctrl.list);

/**
 * @swagger
 * /api/locations/{id}:
 *   patch:
 *     summary: Atualiza dados do local (inclui latitude/longitude)
 *     tags: [Locations]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               area: { type: string }
 *               city: { type: string }
 *               state: { type: string }
 *               uf: { type: string }
 *               lat: { type: number }
 *               lng: { type: number }
 *     responses:
 *       200: { description: OK }
 *       404: { description: Não encontrado }
 */
router.patch('/:id', auth(), ctrl.update);

module.exports = router;
