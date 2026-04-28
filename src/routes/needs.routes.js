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

router.post('/', auth(), requireLevel(2), auditAction({ module: 'NEEDS', action: 'NEED_CRIADA', description: 'Criou uma need', entity: 'Need' }), ctrl.create);
router.get('/', auth(), ctrl.list);
router.get('/requesters', auth(), ctrl.requesters);

router.patch('/:id/status', auth(), requireLevel(2), auditAction({ module: 'NEEDS', action: 'STATUS_ALTERADO', description: 'Alterou status da need', entity: 'Need' }), ctrl.updateStatus);
router.patch('/:id/provider', auth(), requireLevel(2), auditAction({ module: 'NEEDS', action: 'PRESTADOR_ALTERADO', description: 'Alterou prestador', entity: 'Need' }), ctrl.updateProvider);
router.patch('/:id/address', auth(), requireLevel(2), auditAction({ module: 'NEEDS', action: 'ENDERECO_ALTERADO', description: 'Alterou endereço', entity: 'Need' }), ctrl.updateAddress);

router.get('/internal-documents', auth(), needInternalDocumentController.list);

router.post('/internal-documents', auth(), requireLevel(2), uploadInternal.single('file'), auditAction({ module: 'NEEDS', action: 'DOC_INTERNO_CRIADO', description: 'Criou doc interno', entity: 'NeedInternalDocument' }), needInternalDocumentController.create);

router.delete('/internal-documents/:id', auth(), requireLevel(2), auditAction({ module: 'NEEDS', action: 'DOC_INTERNO_EXCLUIDO', description: 'Excluiu doc interno', entity: 'NeedInternalDocument' }), needInternalDocumentController.remove);

const NEED_ATTACHMENT_KINDS = ['CONTRATO','DOCUMENTO','FOTO','HOMOLOGACAO','OUTRO'];

function normalizeAttachment(row){ return { id:row.id, needId:row.needId, kind:row.kind, title:row.title||row.originalName, description:row.description||null, originalName:row.originalName, fileName:row.fileName, mimeType:row.mimeType, size:row.size, url:row.url, uploadedById:row.uploadedById, createdAt:row.createdAt, updatedAt:row.updatedAt }; }

function getUploadedFiles(req){ if(Array.isArray(req.files)&&req.files.length)return req.files; if(req.files&&typeof req.files==='object'){ const g=[]; Object.values(req.files).forEach(a=>{if(Array.isArray(a))g.push(...a)}); if(g.length)return g;} if(req.file)return [req.file]; return []; }

const uploadAttachments = upload.fields([{ name:'file',maxCount:1 },{ name:'files',maxCount:20 }]);

router.get('/:id/attachments', auth(), async (req,res)=>{ try{ const where={ needId:Number(req.params.id) }; if(req.query.kind){ const k=String(req.query.kind).toUpperCase(); if(!NEED_ATTACHMENT_KINDS.includes(k))return res.status(400).json({error:'kind inválido'}); where.kind=k;} const rows=await NeedAttachment.findAll({ where, order:[['createdAt','DESC']]}); return res.json(rows.map(normalizeAttachment)); }catch(e){ return res.status(500).json({error:'Falha ao listar'}); }});

router.post('/:id/attachments', auth(), requireLevel(2), uploadAttachments, auditAction({ module:'NEEDS', action:'ANEXO_ENVIADO', description:'Upload de anexo', entity:'NeedAttachment'}), async (req,res)=>{ try{ const need=await Need.findByPk(Number(req.params.id)); if(!need)return res.status(404).json({error:'Need não encontrada'}); const files=getUploadedFiles(req); if(!files.length)return res.status(400).json({error:'Sem arquivo'}); const created=await Promise.all(files.map(f=>NeedAttachment.create({ needId:need.id, kind:'DOCUMENTO', originalName:f.originalname, fileName:f.filename, mimeType:f.mimetype, size:f.size, url:`/uploads/needs/${need.id}/${f.filename}`, uploadedById:req.user?.id||null }))); return res.json({ok:true, items:created.map(normalizeAttachment)}); }catch(e){ return res.status(500).json({error:'Erro upload'}); }});

router.delete('/:id/attachments/:attachmentId', auth(), requireLevel(2), auditAction({ module:'NEEDS', action:'ANEXO_EXCLUIDO', description:'Removeu anexo', entity:'NeedAttachment'}), async (req,res)=>{ try{ const row=await NeedAttachment.findOne({ where:{ id:Number(req.params.attachmentId), needId:Number(req.params.id)}}); if(!row)return res.status(404).json({error:'Não encontrado'}); await row.destroy(); return res.json({ok:true}); }catch(e){ return res.status(500).json({error:'Erro delete'}); }});

router.get('/:id/homologation-documents', auth(), async (req,res)=>{ const rows=await NeedAttachment.findAll({ where:{ needId:Number(req.params.id), kind:'HOMOLOGACAO' }}); return res.json(rows.map(normalizeAttachment)); });

router.post('/:id/homologation-documents', auth(), requireLevel(2), uploadAttachments, auditAction({ module:'NEEDS', action:'HOMOLOGACAO_ENVIADA', description:'Upload homologação', entity:'NeedAttachment'}), async (req,res)=>{ try{ const files=getUploadedFiles(req); const created=await Promise.all(files.map(f=>NeedAttachment.create({ needId:Number(req.params.id), kind:'HOMOLOGACAO', originalName:f.originalname, fileName:f.filename, mimeType:f.mimetype, size:f.size, url:`/uploads/needs/${req.params.id}/${f.filename}`, uploadedById:req.user?.id||null }))); return res.json({ok:true,items:created.map(normalizeAttachment)});}catch(e){return res.status(500).json({error:'Erro'});} });

router.delete('/:id/homologation-documents/:attachmentId', auth(), requireLevel(2), auditAction({ module:'NEEDS', action:'HOMOLOGACAO_EXCLUIDA', description:'Removeu homologação', entity:'NeedAttachment'}), async (req,res)=>{ try{ const row=await NeedAttachment.findOne({ where:{ id:Number(req.params.attachmentId), needId:Number(req.params.id), kind:'HOMOLOGACAO'}}); if(!row)return res.status(404).json({error:'Não encontrado'}); await row.destroy(); return res.json({ok:true}); }catch(e){return res.status(500).json({error:'Erro'});} });

module.exports = router;