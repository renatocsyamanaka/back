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
 * /api/users:
 *   post:
 *     summary: "Cria um novo colaborador"
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
 *               name:            { type: string }
 *               email:           { type: string, format: email }
 *               password:        { type: string, minLength: 6 }
 *               sex:             { type: string, enum: [M, F, O] }
 *               roleId:          { type: integer }
 *               managerId:       { type: integer, nullable: true }
 *               locationId:      { type: integer, nullable: true }
 *               phone:           { type: string, nullable: true }
 *               vendorCode:      { type: string, nullable: true }
 *               serviceAreaCode: { type: string, nullable: true }
 *               serviceAreaName: { type: string, nullable: true }
 *     responses:
 *       201: { description: "Colaborador criado" }
 *       400: { description: "Erro de validação / e-mail duplicado" }
 *       401: { description: "Não autenticado" }
 *       403: { description: "Permissão insuficiente" }
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
 *       200: { description: "Lista de usuários" }
 */
router.get('/', auth(), ctrl.list);



router.get('/cep', auth(), ctrl.cepLookup);
/**
 * @swagger
 * /api/users/workers:
 *   post:
 *     summary: "Cadastra Técnico ou PSO (sem login/senha)"
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
 *               name: { type: string }
 *               phone: { type: string, nullable: true }
 *               roleId: { type: integer, description: "ID do cargo Técnico ou PSO" }
 *               vendorCode: { type: string, nullable: true }
 *               serviceAreaCode: { type: string, nullable: true }
 *               serviceAreaName: { type: string, nullable: true }
 *               addressStreet: { type: string }
 *               addressNumber: { type: string }
 *               addressComplement: { type: string }
 *               addressDistrict: { type: string }
 *               addressCity: { type: string }
 *               addressState: { type: string }
 *               addressZip: { type: string }
 *               addressCountry: { type: string }
 *               lat: { type: number }
 *               lng: { type: number }
 *     responses:
 *       201: { description: "Worker cadastrado" }
 *       400: { description: "Erro de validação" }
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
 *       200: { description: "OK" }
 */
router.get('/adjustable', auth(), ctrl.listAdjustable);


router.get('/map/techs', auth(), ctrl.mapTechs);
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
 *               managerId: { type: integer, nullable: true }
 *     responses:
 *       200: { description: "Gestor atualizado" }
 *       404: { description: "Usuário/Gestor não encontrado" }
 */
router.patch('/:id/manager', auth(), requireLevel(2), ctrl.setManager);

/**
 * @swagger
 * /api/users/{id}:
 *   patch:
 *     summary: "Atualiza dados do colaborador"
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
 *               name:            { type: string }
 *               email:           { type: string, format: email }
 *               password:        { type: string, minLength: 6 }
 *               sex:             { type: string, enum: [M, F, O] }
 *               roleId:          { type: integer }
 *               managerId:       { type: integer, nullable: true }
 *               locationId:      { type: integer, nullable: true }
 *               isActive:        { type: boolean }
 *               phone:           { type: string, nullable: true }
 *               vendorCode:      { type: string, nullable: true }
 *               serviceAreaCode: { type: string, nullable: true }
 *               serviceAreaName: { type: string, nullable: true }
 *     responses:
 *       200: { description: "Usuário atualizado" }
 *       404: { description: "Usuário não encontrado" }
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
 *       200: { description: "Endereço atualizado" }
 *       404: { description: "Usuário não encontrado" }
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
 *               file: { type: string, format: binary }
 *     responses:
 *       200: { description: "Foto atualizada" }
 *       404: { description: "Usuário não encontrado" }
 */
router.post('/:id/avatar', auth(), uploadAvatar.single('file'), ctrl.uploadAvatar);

/**
 * @swagger
 * /api/users/team:
 *   get:
 *     summary: "Lista de subordinados (diretos e indiretos) do usuário logado"
 *     tags: [Users]
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200: { description: "OK" }
 */
router.get('/team', auth(), ctrl.listMyTeam);

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
 *       200: { description: "OK" }
 *       404: { description: "Usuário não encontrado" }
 */
router.get('/:id/structure', auth(), ctrl.getStructure);

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
 *       200: { description: "OK" }
 */
router.get('/technicians', auth(), ctrl.listTechnicians);

module.exports = router;
