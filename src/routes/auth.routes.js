const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/authController');

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Autenticação e dados do usuário logado
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     AuthLoginInput:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: antonio.marcos@omnilink.com.br
 *         password:
 *           type: string
 *           format: password
 *           example: "123"
 *
 *     AuthLoginResponse:
 *       type: object
 *       properties:
 *         ok:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             token:
 *               type: string
 *               example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *
 *     AuthMeResponse:
 *       type: object
 *       properties:
 *         ok:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             id:
 *               type: integer
 *               example: 1
 *             name:
 *               type: string
 *               example: Renato Yamanaka
 *             email:
 *               type: string
 *               example: renato.yamanaka@omnilink.com.br
 *             role:
 *               type: object
 *               nullable: true
 *               properties:
 *                 id:
 *                   type: integer
 *                   example: 1
 *                 name:
 *                   type: string
 *                   example: Admin
 *                 level:
 *                   type: integer
 *                   example: 5
 *             manager:
 *               type: object
 *               nullable: true
 *               properties:
 *                 id:
 *                   type: integer
 *                   example: 2
 *                 name:
 *                   type: string
 *                   example: Gestor Responsável
 *             location:
 *               type: object
 *               nullable: true
 *               properties:
 *                 id:
 *                   type: integer
 *                   example: 1
 *                 name:
 *                   type: string
 *                   example: São Paulo
 *                 city:
 *                   type: string
 *                   example: São Paulo
 *                 state:
 *                   type: string
 *                   example: São Paulo
 *                 uf:
 *                   type: string
 *                   example: SP
 *
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         ok:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: Credenciais inválidas
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login do usuário
 *     description: Realiza login com e-mail e senha e retorna o token JWT para uso nas rotas protegidas.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AuthLoginInput'
 *           examples:
 *             login:
 *               summary: Exemplo de login
 *               value:
 *                 email: antonio.marcos@omnilink.com.br
 *                 password: "123"
 *     responses:
 *       200:
 *         description: Login realizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthLoginResponse'
 *       400:
 *         description: E-mail/senha ausentes ou credenciais inválidas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Erro interno
 */
router.post('/login', ctrl.login);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Dados do usuário logado
 *     description: Retorna os dados do usuário autenticado pelo token JWT.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dados do usuário retornados com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthMeResponse'
 *       401:
 *         description: Token ausente ou inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Erro interno
 */
router.get('/me', auth(), ctrl.me);

module.exports = router;