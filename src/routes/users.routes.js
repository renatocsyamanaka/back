/* src/routes/users.routes.js */
const router = require('express').Router();
const auth = require('../middleware/auth');
const requireLevel = require('../middleware/rbac');
const ctrl = require('../controllers/userController');
const { uploadAvatar } = require('../config/upload');

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: "Gestão de colaboradores"
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     UserRole:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         name:
 *           type: string
 *         level:
 *           type: integer
 *
 *     UserManager:
 *       type: object
 *       nullable: true
 *       properties:
 *         id:
 *           type: integer
 *         name:
 *           type: string
 *         avatarUrl:
 *           type: string
 *           nullable: true
 *
 *     UserLocation:
 *       type: object
 *       nullable: true
 *       additionalProperties: true
 *
 *     UserResponse:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         name:
 *           type: string
 *         email:
 *           type: string
 *           nullable: true
 *         sex:
 *           type: string
 *           nullable: true
 *           enum: [M, F, O]
 *         loginEnabled:
 *           type: boolean
 *         isActive:
 *           type: boolean
 *         avatarUrl:
 *           type: string
 *           nullable: true
 *         roleId:
 *           type: integer
 *           nullable: true
 *         managerId:
 *           type: integer
 *           nullable: true
 *         locationId:
 *           type: integer
 *           nullable: true
 *         sectors:
 *           type: array
 *           description: "Setores do usuário"
 *           items:
 *             type: string
 *             enum: [OPERACOES, LOGISTICA, SISTEMAS, ATENDIMENTO]
 *           example: [OPERACOES, LOGISTICA]
 *         estoqueAvancado:
 *           type: boolean
 *         phone:
 *           type: string
 *           nullable: true
 *         vendorCode:
 *           type: string
 *           nullable: true
 *         serviceAreaCode:
 *           type: string
 *           nullable: true
 *         serviceAreaName:
 *           type: string
 *           nullable: true
 *         tipoAtendimento:
 *           type: string
 *           nullable: true
 *           enum: [FX, VL, FV]
 *         tipoAtendimentoDescricao:
 *           type: string
 *           nullable: true
 *         addressStreet:
 *           type: string
 *           nullable: true
 *         addressNumber:
 *           type: string
 *           nullable: true
 *         addressComplement:
 *           type: string
 *           nullable: true
 *         addressDistrict:
 *           type: string
 *           nullable: true
 *         addressCity:
 *           type: string
 *           nullable: true
 *         addressState:
 *           type: string
 *           nullable: true
 *         addressZip:
 *           type: string
 *           nullable: true
 *         addressCountry:
 *           type: string
 *           nullable: true
 *         lat:
 *           type: number
 *           nullable: true
 *         lng:
 *           type: number
 *           nullable: true
 *         role:
 *           $ref: '#/components/schemas/UserRole'
 *         manager:
 *           $ref: '#/components/schemas/UserManager'
 *         location:
 *           $ref: '#/components/schemas/UserLocation'
 */

/**
 * @swagger
 * /api/users/public/signup-options:
 *   get:
 *     summary: "Retorna opções públicas para o pré-cadastro"
 *     description: "Usado na tela pública de cadastro para listar cargos, gestores ativos e setores disponíveis"
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: "Opções carregadas com sucesso"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     roles:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id: { type: integer }
 *                           name: { type: string }
 *                           level: { type: integer }
 *                     managers:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id: { type: integer }
 *                           name: { type: string }
 *                           sectors:
 *                             type: array
 *                             items:
 *                               type: string
 *                               enum: [OPERACOES, LOGISTICA, SISTEMAS, ATENDIMENTO]
 *                           role:
 *                             $ref: '#/components/schemas/UserRole'
 *                     availableSectors:
 *                       type: array
 *                       items:
 *                         type: string
 *                         enum: [OPERACOES, LOGISTICA, SISTEMAS, ATENDIMENTO]
 */
router.get('/public/signup-options', ctrl.listPublicSignupOptions);

/**
 * @swagger
 * /api/users/cep:
 *   get:
 *     summary: "Busca endereço por CEP"
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: cep
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200: { description: "CEP encontrado" }
 *       404: { description: "CEP não encontrado" }
 */
router.get('/cep', ctrl.cepLookup);

/**
 * @swagger
 * /api/users/providers:
 *   get:
 *     summary: "Lista prestadores"
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: "Filtro por nome"
 *     responses:
 *       200:
 *         description: "OK"
 */
router.get('/providers', ctrl.listProviders);

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: "Cria um novo colaborador"
 *     description: "Cria usuário com login. Para setores, prefira enviar `sectors` como array. Compatível também com `sector` legado."
 *     tags: [Users]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, roleId]
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 *               sex:
 *                 type: string
 *                 enum: [M, F, O]
 *               roleId:
 *                 type: integer
 *               managerId:
 *                 type: integer
 *                 nullable: true
 *               locationId:
 *                 type: integer
 *                 nullable: true
 *               sectors:
 *                 type: array
 *                 description: "Lista de setores do usuário"
 *                 items:
 *                   type: string
 *                   enum: [OPERACOES, LOGISTICA, SISTEMAS, ATENDIMENTO]
 *                 example: [OPERACOES, LOGISTICA]
 *               sector:
 *                 type: string
 *                 nullable: true
 *                 description: "Compatibilidade legada. Use preferencialmente `sectors`."
 *                 enum: [OPERACOES, LOGISTICA, SISTEMAS, ATENDIMENTO]
 *               phone:
 *                 type: string
 *                 nullable: true
 *               vendorCode:
 *                 type: string
 *                 nullable: true
 *               serviceAreaCode:
 *                 type: string
 *                 nullable: true
 *               serviceAreaName:
 *                 type: string
 *                 nullable: true
 *               tipoAtendimento:
 *                 type: string
 *                 nullable: true
 *                 enum: [FX, VL, FV]
 *                 description: "FX = Fixo, VL = Volante, FV = Fixo e Volante"
 *     responses:
 *       201:
 *         description: "Colaborador criado"
 *       400:
 *         description: "Erro de validação / e-mail duplicado / setor inválido"
 *       401:
 *         description: "Não autenticado"
 *       403:
 *         description: "Permissão insuficiente"
 */
router.post('/', auth(), requireLevel(3), ctrl.create);

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: "Lista colaboradores com cargo, gestor e localização"
 *     tags: [Users]
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200:
 *         description: "Lista de usuários"
 */
router.get('/', auth(), ctrl.list);

/**
 * @swagger
 * /api/users/workers:
 *   post:
 *     summary: "Cadastra Técnico, PSO, ATA, PRP ou SPOT (sem login/senha)"
 *     description: "Para setores, prefira enviar `sectors` como array. Compatível também com `sector` legado."
 *     tags: [Users]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, roleId, addressStreet, addressCity, addressState, lat, lng]
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *                 nullable: true
 *               roleId:
 *                 type: integer
 *                 description: "ID do cargo (Técnico/PSO/ATA/PRP/SPOT)"
 *               managerId:
 *                 type: integer
 *                 nullable: true
 *               sectors:
 *                 type: array
 *                 description: "Lista de setores do colaborador"
 *                 items:
 *                   type: string
 *                   enum: [OPERACOES, LOGISTICA, SISTEMAS, ATENDIMENTO]
 *                 example: [OPERACOES]
 *               sector:
 *                 type: string
 *                 nullable: true
 *                 description: "Compatibilidade legada. Use preferencialmente `sectors`."
 *                 enum: [OPERACOES, LOGISTICA, SISTEMAS, ATENDIMENTO]
 *               estoqueAvancado:
 *                 type: boolean
 *                 description: "Se pertence ao Estoque Avançado"
 *                 default: false
 *               vendorCode:
 *                 type: string
 *                 nullable: true
 *               serviceAreaCode:
 *                 type: string
 *                 nullable: true
 *               serviceAreaName:
 *                 type: string
 *                 nullable: true
 *               tipoAtendimento:
 *                 type: string
 *                 nullable: true
 *                 enum: [FX, VL, FV]
 *                 description: "FX = Fixo, VL = Volante, FV = Fixo e Volante"
 *               addressStreet:
 *                 type: string
 *               addressNumber:
 *                 type: string
 *               addressComplement:
 *                 type: string
 *               addressDistrict:
 *                 type: string
 *               addressCity:
 *                 type: string
 *               addressState:
 *                 type: string
 *               addressZip:
 *                 type: string
 *               addressCountry:
 *                 type: string
 *               lat:
 *                 type: number
 *               lng:
 *                 type: number
 *     responses:
 *       201:
 *         description: "Worker cadastrado"
 *       400:
 *         description: "Erro de validação / setor inválido"
 */
router.post('/workers', auth(), requireLevel(2), ctrl.createWorker);

/**
 * @swagger
 * /api/users/adjustable:
 *   get:
 *     summary: "Lista quem o logado pode ajustar no banco de horas"
 *     description: "Gerente (level ≥ 4) vê todos; Supervisor/Coordenador (level ≥ 2) vê seus subordinados diretos e indiretos e, opcionalmente, a si."
 *     tags: [Users]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: query
 *         name: includeSelf
 *         schema: { type: boolean }
 *         description: "Incluir o próprio usuário na lista (padrão: true)"
 *     responses:
 *       200:
 *         description: "OK"
 */
router.get('/adjustable', auth(), ctrl.listAdjustable);

/**
 * @swagger
 * /api/users/map/techs:
 *   get:
 *     summary: "Mapa de técnicos e prestadores"
 *     tags: [Users]
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200:
 *         description: "OK"
 */
router.get('/map/techs', auth(), ctrl.mapTechs);

/**
 * @swagger
 * /api/users/team:
 *   get:
 *     summary: "Lista de subordinados (diretos e indiretos) do usuário logado"
 *     tags: [Users]
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200:
 *         description: "OK"
 */
router.get('/team', auth(), ctrl.listMyTeam);

/**
 * @swagger
 * /api/users/technicians:
 *   get:
 *     summary: "Lista Técnicos/Prestadores cadastrados (role level = 1)"
 *     tags: [Users]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: query
 *         name: activeOnly
 *         schema: { type: boolean }
 *         description: "Se true, retorna somente ativos (padrão: true)"
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: "Filtro por nome (contains)"
 *     responses:
 *       200:
 *         description: "OK"
 */
router.get('/technicians', auth(), ctrl.listTechnicians);

/**
 * @swagger
 * /api/users/me/change-password:
 *   put:
 *     summary: "Alterar a senha do usuário logado"
 *     tags: [Users]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *               - confirmNewPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 example: "senhaAtual123"
 *               newPassword:
 *                 type: string
 *                 example: "novaSenha123"
 *               confirmNewPassword:
 *                 type: string
 *                 example: "novaSenha123"
 *     responses:
 *       200:
 *         description: "Senha alterada com sucesso"
 *         content:
 *           application/json:
 *             example:
 *               ok: true
 *               data:
 *                 message: "Senha alterada com sucesso"
 *       400:
 *         description: "Erro de validação ou senha incorreta"
 *         content:
 *           application/json:
 *             example:
 *               ok: false
 *               error: "Senha atual incorreta"
 *       401:
 *         description: "Não autorizado"
 */
router.put('/me/change-password', auth(), ctrl.changeMyPassword);
/**
 * @swagger
 * /api/users/me/profile:
 *   get:
 *     summary: Retorna os dados do usuário logado
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil carregado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 12
 *                     name:
 *                       type: string
 *                       example: Renato Yamanaka
 *                     email:
 *                       type: string
 *                       example: renato@email.com
 *                     phone:
 *                       type: string
 *                       nullable: true
 *                       example: "11999998888"
 *                     avatarUrl:
 *                       type: string
 *                       nullable: true
 *                       example: https://seudominio.com/uploads/avatars/foto.png
 *                     role:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 2
 *                         name:
 *                           type: string
 *                           example: Analista
 *                         level:
 *                           type: integer
 *                           example: 2
 *       401:
 *         description: Não autenticado
 */
router.get('/me/profile', auth(), ctrl.getMyProfile);

/**
 * @swagger
 * /api/users/me/profile:
 *   patch:
 *     summary: Atualiza os dados do usuário logado
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phone:
 *                 type: string
 *                 nullable: true
 *                 example: "11999998888"
 *     responses:
 *       200:
 *         description: Perfil atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 12
 *                     name:
 *                       type: string
 *                       example: Renato Yamanaka
 *                     email:
 *                       type: string
 *                       example: renato@email.com
 *                     phone:
 *                       type: string
 *                       nullable: true
 *                       example: "11999998888"
 *                     avatarUrl:
 *                       type: string
 *                       nullable: true
 *                       example: https://seudominio.com/uploads/avatars/foto.png
 *       400:
 *         description: Erro de validação
 *       401:
 *         description: Não autenticado
 */
router.patch('/me/profile', auth(), ctrl.updateMyProfile);

/**
 * @swagger
 * /api/users/me/avatar:
 *   post:
 *     summary: Atualiza a foto do usuário logado
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Avatar atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 12
 *                     name:
 *                       type: string
 *                       example: Renato Yamanaka
 *                     email:
 *                       type: string
 *                       example: renato@email.com
 *                     phone:
 *                       type: string
 *                       nullable: true
 *                       example: "11999998888"
 *                     avatarUrl:
 *                       type: string
 *                       nullable: true
 *                       example: https://seudominio.com/uploads/avatars/foto.png
 *       400:
 *         description: Arquivo não enviado ou inválido
 *       401:
 *         description: Não autenticado
 */
router.post('/me/avatar', auth(), uploadAvatar.single('file'), ctrl.uploadMyAvatar);

/**
 * @swagger
 * /api/users/{id}/manager:
 *   patch:
 *     summary: "Define (ou remove) o gestor do colaborador"
 *     tags: [Users]
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
 *               managerId:
 *                 type: integer
 *                 nullable: true
 *     responses:
 *       200:
 *         description: "Gestor atualizado"
 *       404:
 *         description: "Usuário/Gestor não encontrado"
 */
router.patch('/:id/manager', auth(), requireLevel(2), ctrl.setManager);

/**
 * @swagger
 * /api/users/{id}:
 *   patch:
 *     summary: "Atualiza dados do colaborador"
 *     description: "Para setores, prefira enviar `sectors` como array. Compatível também com `sector` legado."
 *     tags: [Users]
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
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *                 nullable: true
 *               password:
 *                 type: string
 *                 minLength: 6
 *               sex:
 *                 type: string
 *                 enum: [M, F, O]
 *               roleId:
 *                 type: integer
 *               managerId:
 *                 type: integer
 *                 nullable: true
 *               locationId:
 *                 type: integer
 *                 nullable: true
 *               isActive:
 *                 type: boolean
 *               sectors:
 *                 type: array
 *                 description: "Lista de setores do usuário"
 *                 items:
 *                   type: string
 *                   enum: [OPERACOES, LOGISTICA, SISTEMAS, ATENDIMENTO]
 *                 example: [SISTEMAS, OPERACOES]
 *               sector:
 *                 type: string
 *                 nullable: true
 *                 description: "Compatibilidade legada. Use preferencialmente `sectors`."
 *                 enum: [OPERACOES, LOGISTICA, SISTEMAS, ATENDIMENTO]
 *               phone:
 *                 type: string
 *                 nullable: true
 *               vendorCode:
 *                 type: string
 *                 nullable: true
 *               serviceAreaCode:
 *                 type: string
 *                 nullable: true
 *               serviceAreaName:
 *                 type: string
 *                 nullable: true
 *               tipoAtendimento:
 *                 type: string
 *                 nullable: true
 *                 enum: [FX, VL, FV]
 *                 description: "FX = Fixo, VL = Volante, FV = Fixo e Volante"
 *               addressStreet:
 *                 type: string
 *                 nullable: true
 *               addressNumber:
 *                 type: string
 *                 nullable: true
 *               addressComplement:
 *                 type: string
 *                 nullable: true
 *               addressDistrict:
 *                 type: string
 *                 nullable: true
 *               addressCity:
 *                 type: string
 *                 nullable: true
 *               addressState:
 *                 type: string
 *                 nullable: true
 *               addressZip:
 *                 type: string
 *                 nullable: true
 *               addressCountry:
 *                 type: string
 *                 nullable: true
 *               lat:
 *                 type: number
 *                 nullable: true
 *               lng:
 *                 type: number
 *                 nullable: true
 *     responses:
 *       200:
 *         description: "Usuário atualizado"
 *       404:
 *         description: "Usuário não encontrado"
 */
router.patch('/:id', auth(), requireLevel(2), ctrl.update);

/**
 * @swagger
 * /api/users/{id}/address:
 *   patch:
 *     summary: "Atualiza endereço do colaborador e (opcional) geocodifica para lat/lng"
 *     tags: [Users]
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
 *               addressStreet:     { type: string }
 *               addressNumber:     { type: string }
 *               addressComplement: { type: string }
 *               addressDistrict:   { type: string }
 *               addressCity:       { type: string }
 *               addressState:      { type: string }
 *               addressZip:        { type: string }
 *               addressCountry:    { type: string }
 *               autoGeocode:       { type: boolean }
 *     responses:
 *       200:
 *         description: "Endereço atualizado"
 *       404:
 *         description: "Usuário não encontrado"
 */
router.patch('/:id/address', auth(), requireLevel(2), ctrl.updateAddress);

/**
 * @swagger
 * /api/users/{id}/avatar:
 *   post:
 *     summary: "Envia/atualiza foto do colaborador"
 *     tags: [Users]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
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
 *         description: "Foto atualizada"
 *       404:
 *         description: "Usuário não encontrado"
 */
router.post('/:id/avatar', auth(), uploadAvatar.single('file'), ctrl.uploadAvatar);

/**
 * @swagger
 * /api/users/{id}/structure:
 *   get:
 *     summary: "Estrutura hierárquica de um colaborador (acima/atual/abaixo)"
 *     tags: [Users]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: deep
 *         schema: { type: boolean }
 *         description: "Se true, retorna toda a árvore abaixo (não só diretos)"
 *     responses:
 *       200:
 *         description: "OK"
 *       404:
 *         description: "Usuário não encontrado"
 */
router.get('/:id/structure', auth(), ctrl.getStructure);


module.exports = router;