const express = require('express');
const router = express.Router();

const ctrl = require('../controllers/userRegistrationRequestController');
const auth = require('../middleware/auth');
const requireLevel = require('../middleware/rbac');
const { uploadAvatar } = require('../config/upload');

// público: solicitar cadastro
/**
 * @swagger
 * /api/user-registration-requests:
 *   post:
 *     summary: Cria ou executa ação
 *     tags: [Solicitações de Cadastro]
 *     requestBody:
 *       required: false
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Operação realizada com sucesso
 *       201:
 *         description: Registro criado com sucesso
 *       400:
 *         description: Requisição inválida
 *       404:
 *         description: Registro não encontrado
 *       500:
 *         description: Erro interno
 */
router.post(
  '/',
  uploadAvatar.single('avatar'),
  ctrl.createRequest
);

// privado: gestor para cima
/**
 * @swagger
 * /api/user-registration-requests:
 *   get:
 *     summary: Consulta registros
 *     tags: [Solicitações de Cadastro]
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
router.get(
  '/',
  auth(),
  requireLevel(3),
  ctrl.listRequests
);

/**
 * @swagger
 * /api/user-registration-requests/{id}/approve:
 *   put:
 *     summary: Atualiza registro
 *     tags: [Solicitações de Cadastro]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador id
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
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
router.put(
  '/:id/approve',
  auth(),
  requireLevel(3),
  ctrl.approveRequest
);

/**
 * @swagger
 * /api/user-registration-requests/{id}/reject:
 *   put:
 *     summary: Atualiza registro
 *     tags: [Solicitações de Cadastro]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador id
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
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
router.put(
  '/:id/reject',
  auth(),
  requireLevel(3),
  ctrl.rejectRequest
);

module.exports = router;