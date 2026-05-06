const router = require('express').Router();
const auth = require('../middleware/auth');
const requireLevel = require('../middleware/rbac');
const ctrl = require('../controllers/needController');
const needInternalDocumentController = require('../controllers/needInternalDocumentController');
const auditAction = require('../middleware/auditAction');

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Need, NeedAttachment } = require('../models');

function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

const storage = multer.diskStorage({
  destination: (req, _file, cb) => { const dir = path.join(process.cwd(), 'uploads', 'needs', String(req.params.id)); ensureDir(dir); cb(null, dir); },
  filename: (_req, file, cb) => { const ext = path.extname(file.originalname || ''); cb(null, `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`); },
});

const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } });

const internalStorage = multer.diskStorage({
  destination: (_req, _file, cb) => { const dir = path.join(process.cwd(), 'uploads', 'needs', 'internal-documents'); ensureDir(dir); cb(null, dir); },
  filename: (_req, file, cb) => { const ext = path.extname(file.originalname || ''); cb(null, `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`); },
});

const uploadInternal = multer({ storage: internalStorage, limits: { fileSize: 15 * 1024 * 1024 } });

/**
 * @swagger
 * /api/needs:
 *   post:
 *     summary: Cria ou executa ação
 *     tags: [Needs]
 *     security:
 *       - bearerAuth: []
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
 *       201:
 *         description: Registro criado com sucesso
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
router.post('/', auth(), requireLevel(2), auditAction({ module: 'NEEDS', action: 'NEED_CRIADA', description: 'Criou uma need', entity: 'Need' }), ctrl.create);
/**
 * @swagger
 * /api/needs:
 *   get:
 *     summary: Consulta registros
 *     tags: [Needs]
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
router.get('/', auth(), ctrl.list);
/**
 * @swagger
 * /api/needs/requesters:
 *   get:
 *     summary: Consulta registros
 *     tags: [Needs]
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
router.get('/requesters', auth(), ctrl.requesters);

/**
 * @swagger
 * /api/needs/{id}/status:
 *   patch:
 *     summary: Atualiza parcialmente registro
 *     tags: [Needs]
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
router.patch('/:id/status', auth(), requireLevel(2), auditAction({ module: 'NEEDS', action: 'STATUS_ALTERADO', description: 'Alterou status da need', entity: 'Need' }), ctrl.updateStatus);
/**
 * @swagger
 * /api/needs/{id}/provider:
 *   patch:
 *     summary: Atualiza parcialmente registro
 *     tags: [Needs]
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
router.patch('/:id/provider', auth(), requireLevel(2), auditAction({ module: 'NEEDS', action: 'PRESTADOR_ALTERADO', description: 'Alterou prestador', entity: 'Need' }), ctrl.updateProvider);
/**
 * @swagger
 * /api/needs/{id}/address:
 *   patch:
 *     summary: Atualiza parcialmente registro
 *     tags: [Needs]
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
router.patch('/:id/address', auth(), requireLevel(2), auditAction({ module: 'NEEDS', action: 'ENDERECO_ALTERADO', description: 'Alterou endereço', entity: 'Need' }), ctrl.updateAddress);

/**
 * @swagger
 * /api/needs/internal-documents:
 *   get:
 *     summary: Consulta registros
 *     tags: [Needs]
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
router.get('/internal-documents', auth(), needInternalDocumentController.list);

/**
 * @swagger
 * /api/needs/internal-documents:
 *   post:
 *     summary: Cria ou executa ação
 *     tags: [Needs]
 *     security:
 *       - bearerAuth: []
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
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão
 *       404:
 *         description: Registro não encontrado
 *       500:
 *         description: Erro interno
 */
router.post('/internal-documents', auth(), requireLevel(2), uploadInternal.single('file'), auditAction({ module: 'NEEDS', action: 'DOC_INTERNO_CRIADO', description: 'Criou doc interno', entity: 'NeedInternalDocument' }), needInternalDocumentController.create);

/**
 * @swagger
 * /api/needs/internal-documents/{id}:
 *   delete:
 *     summary: Remove registro
 *     tags: [Needs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador id
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
router.delete('/internal-documents/:id', auth(), requireLevel(2), auditAction({ module: 'NEEDS', action: 'DOC_INTERNO_EXCLUIDO', description: 'Excluiu doc interno', entity: 'NeedInternalDocument' }), needInternalDocumentController.remove);

const NEED_ATTACHMENT_KINDS = ['CONTRATO','DOCUMENTO','FOTO','HOMOLOGACAO','OUTRO'];

function normalizeAttachment(row){ return { id:row.id, needId:row.needId, kind:row.kind, title:row.title||row.originalName, description:row.description||null, originalName:row.originalName, fileName:row.fileName, mimeType:row.mimeType, size:row.size, url:row.url, uploadedById:row.uploadedById, createdAt:row.createdAt, updatedAt:row.updatedAt }; }

function getUploadedFiles(req){ if(Array.isArray(req.files)&&req.files.length)return req.files; if(req.files&&typeof req.files==='object'){ const g=[]; Object.values(req.files).forEach(a=>{if(Array.isArray(a))g.push(...a)}); if(g.length)return g;} if(req.file)return [req.file]; return []; }

const uploadAttachments = upload.fields([{ name:'file',maxCount:1 },{ name:'files',maxCount:20 }]);

/**
 * @swagger
 * /api/needs/{id}/attachments:
 *   get:
 *     summary: Consulta registros
 *     tags: [Needs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador id
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
router.get('/:id/attachments', auth(), async (req,res)=>{ try{ const where={ needId:Number(req.params.id) }; if(req.query.kind){ const k=String(req.query.kind).toUpperCase(); if(!NEED_ATTACHMENT_KINDS.includes(k))return res.status(400).json({error:'kind inválido'}); where.kind=k;} const rows=await NeedAttachment.findAll({ where, order:[['createdAt','DESC']]}); return res.json(rows.map(normalizeAttachment)); }catch(e){ return res.status(500).json({error:'Falha ao listar'}); }});

/**
 * @swagger
 * /api/needs/{id}/attachments:
 *   post:
 *     summary: Cria ou executa ação
 *     tags: [Needs]
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
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão
 *       404:
 *         description: Registro não encontrado
 *       500:
 *         description: Erro interno
 */
router.post('/:id/attachments', auth(), requireLevel(2), uploadAttachments, auditAction({ module:'NEEDS', action:'ANEXO_ENVIADO', description:'Upload de anexo', entity:'NeedAttachment'}), async (req,res)=>{ try{ const need=await Need.findByPk(Number(req.params.id)); if(!need)return res.status(404).json({error:'Need não encontrada'}); const files=getUploadedFiles(req); if(!files.length)return res.status(400).json({error:'Sem arquivo'}); const created=await Promise.all(files.map(f=>NeedAttachment.create({ needId:need.id, kind:'DOCUMENTO', originalName:f.originalname, fileName:f.filename, mimeType:f.mimetype, size:f.size, url:`/uploads/needs/${need.id}/${f.filename}`, uploadedById:req.user?.id||null }))); return res.json({ok:true, items:created.map(normalizeAttachment)}); }catch(e){ return res.status(500).json({error:'Erro upload'}); }});

/**
 * @swagger
 * /api/needs/{id}/attachments/{attachmentId}:
 *   delete:
 *     summary: Remove registro
 *     tags: [Needs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador id
 *       - in: path
 *         name: attachmentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador attachmentId
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
router.delete('/:id/attachments/:attachmentId', auth(), requireLevel(2), auditAction({ module:'NEEDS', action:'ANEXO_EXCLUIDO', description:'Removeu anexo', entity:'NeedAttachment'}), async (req,res)=>{ try{ const row=await NeedAttachment.findOne({ where:{ id:Number(req.params.attachmentId), needId:Number(req.params.id)}}); if(!row)return res.status(404).json({error:'Não encontrado'}); await row.destroy(); return res.json({ok:true}); }catch(e){ return res.status(500).json({error:'Erro delete'}); }});

/**
 * @swagger
 * /api/needs/{id}/homologation-documents:
 *   get:
 *     summary: Consulta registros
 *     tags: [Needs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador id
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
router.get('/:id/homologation-documents', auth(), async (req,res)=>{ const rows=await NeedAttachment.findAll({ where:{ needId:Number(req.params.id), kind:'HOMOLOGACAO' }}); return res.json(rows.map(normalizeAttachment)); });

/**
 * @swagger
 * /api/needs/{id}/homologation-documents:
 *   post:
 *     summary: Cria ou executa ação
 *     tags: [Needs]
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
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão
 *       404:
 *         description: Registro não encontrado
 *       500:
 *         description: Erro interno
 */
router.post('/:id/homologation-documents', auth(), requireLevel(2), uploadAttachments, auditAction({ module:'NEEDS', action:'HOMOLOGACAO_ENVIADA', description:'Upload homologação', entity:'NeedAttachment'}), async (req,res)=>{ try{ const files=getUploadedFiles(req); const created=await Promise.all(files.map(f=>NeedAttachment.create({ needId:Number(req.params.id), kind:'HOMOLOGACAO', originalName:f.originalname, fileName:f.filename, mimeType:f.mimetype, size:f.size, url:`/uploads/needs/${req.params.id}/${f.filename}`, uploadedById:req.user?.id||null }))); return res.json({ok:true,items:created.map(normalizeAttachment)});}catch(e){return res.status(500).json({error:'Erro'});} });

/**
 * @swagger
 * /api/needs/{id}/homologation-documents/{attachmentId}:
 *   delete:
 *     summary: Remove registro
 *     tags: [Needs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador id
 *       - in: path
 *         name: attachmentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador attachmentId
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
router.delete('/:id/homologation-documents/:attachmentId', auth(), requireLevel(2), auditAction({ module:'NEEDS', action:'HOMOLOGACAO_EXCLUIDA', description:'Removeu homologação', entity:'NeedAttachment'}), async (req,res)=>{ try{ const row=await NeedAttachment.findOne({ where:{ id:Number(req.params.attachmentId), needId:Number(req.params.id), kind:'HOMOLOGACAO'}}); if(!row)return res.status(404).json({error:'Não encontrado'}); await row.destroy(); return res.json({ok:true}); }catch(e){return res.status(500).json({error:'Erro'});} });

module.exports = router;