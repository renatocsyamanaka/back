const router = require('express').Router();
const multer = require('multer');
const auth = require('../middleware/auth');
const requireLevel = require('../middleware/rbac');
const controller = require('../controllers/deliveryReportController');
const importController = require('../controllers/deliveryReportImportController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

router.use(auth());

/**
 * @swagger
 * tags:
 *   - name: CTE
 *     description: Gestão de CTEs e relatórios de entrega
 */

/**
 * @swagger
 * /api/delivery-reports:
 *   get:
 *     summary: Lista todos os CTEs
 *     tags: [CTE]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           example: 3275
 *       - in: query
 *         name: cte
 *         schema:
 *           type: string
 *           example: 3275
 *       - in: query
 *         name: notaFiscal
 *         schema:
 *           type: string
 *           example: 123456
 *       - in: query
 *         name: transportadora
 *         schema:
 *           type: string
 *           example: Buslog
 *       - in: query
 *         name: statusEntrega
 *         schema:
 *           type: string
 *           example: PENDENTE
 *       - in: query
 *         name: operacao
 *         schema:
 *           type: string
 *           example: COLETA
 *       - in: query
 *         name: regiao
 *         schema:
 *           type: string
 *           example: SUDESTE
 *       - in: query
 *         name: ufDestino
 *         schema:
 *           type: string
 *           example: SP
 *       - in: query
 *         name: cidadeDestino
 *         schema:
 *           type: string
 *           example: GUARULHOS
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: yearMode
 *         schema:
 *           type: string
 *           enum: [all, selected]
 *           example: all
 *         description: >
 *           Define a visão por ano. Use "all" para trazer todos os anos
 *           ou "selected" para filtrar pelos anos informados em "years".
 *       - in: query
 *         name: years
 *         schema:
 *           type: string
 *           example: 2024,2025,2026
 *         description: >
 *           Lista de anos separados por vírgula. Só é considerada quando
 *           yearMode=selected. Exemplo: 2024,2025,2026
 *       - in: query
 *         name: includeDeleted
 *         schema:
 *           type: string
 *           example: "true"
 *     responses:
 *       200:
 *         description: Lista paginada de CTEs
 */
router.get('/', controller.list);

/**
 * @swagger
 * /api/delivery-reports/import:
 *   post:
 *     summary: Inicia a importação de CTEs por Excel
 *     tags: [CTE]
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
 *       202:
 *         description: Importação iniciada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Importação iniciada com sucesso.
 *                 jobId:
 *                   type: string
 *                   example: 8c6e7b2f-5d5b-4d3f-8db0-78f80836f1a2
 *                 status:
 *                   type: string
 *                   example: queued
 *       400:
 *         description: Arquivo não enviado ou inválido
 */
router.post(
  '/import',
  requireLevel(2),
  upload.single('file'),
  importController.importExcel
);

/**
 * @swagger
 * /api/delivery-reports/import/status/{jobId}:
 *   get:
 *     summary: Consulta o status da importação de Excel
 *     tags: [CTE]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         example: 8c6e7b2f-5d5b-4d3f-8db0-78f80836f1a2
 *     responses:
 *       200:
 *         description: Status atual do job de importação
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 jobId:
 *                   type: string
 *                   example: 8c6e7b2f-5d5b-4d3f-8db0-78f80836f1a2
 *                 fileName:
 *                   type: string
 *                   example: relatorio_ctes.xlsx
 *                 status:
 *                   type: string
 *                   example: processing
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 startedAt:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 *                 finishedAt:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 *                 requestedBy:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       nullable: true
 *                       example: 5
 *                     name:
 *                       type: string
 *                       example: Renato Yamanaka
 *                 totalLinhas:
 *                   type: integer
 *                   example: 250
 *                 processed:
 *                   type: integer
 *                   example: 97
 *                 inserted:
 *                   type: integer
 *                   example: 50
 *                 updated:
 *                   type: integer
 *                   example: 30
 *                 ignored:
 *                   type: integer
 *                   example: 17
 *                 progress:
 *                   type: integer
 *                   example: 39
 *                 currentLine:
 *                   type: integer
 *                   nullable: true
 *                   example: 99
 *                 message:
 *                   type: string
 *                   example: Processando linha 99 de 250...
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example:
 *                     - "Linha 14: sem CTE e sem Nota Fiscal."
 *       404:
 *         description: Job de importação não encontrado
 */
router.get(
  '/import/status/:jobId',
  requireLevel(2),
  importController.getImportStatus
);

/**
 * @swagger
 * /api/delivery-reports/{id}/history:
 *   get:
 *     summary: Histórico do CTE
 *     tags: [CTE]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Histórico do CTE
 */
router.get('/:id/history', controller.history);

/**
 * @swagger
 * /api/delivery-reports/{id}:
 *   get:
 *     summary: Buscar CTE por ID
 *     tags: [CTE]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: CTE encontrado
 *       404:
 *         description: CTE não encontrado
 */
router.get('/:id', controller.getById);

/**
 * @swagger
 * /api/delivery-reports:
 *   post:
 *     summary: Criar novo CTE
 *     tags: [CTE]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cte:
 *                 type: string
 *                 example: "3275"
 *               tipo:
 *                 type: string
 *                 example: "CIF"
 *               emissao:
 *                 type: string
 *                 format: date-time
 *               cidadeOrigem:
 *                 type: string
 *                 example: "SANTOS"
 *               ufOrigem:
 *                 type: string
 *                 example: "SP"
 *               remetente:
 *                 type: string
 *                 example: "IGOR DA CUNHA BATISTA"
 *               cidadeDestino:
 *                 type: string
 *                 example: "SANTA RITA DO SAPUCAI"
 *               ufDestino:
 *                 type: string
 *                 example: "MG"
 *               destinatario:
 *                 type: string
 *                 example: "OMNILINK TECNOLOGIA S.A."
 *               notaFiscal:
 *                 type: string
 *                 example: "123456"
 *               nfValor:
 *                 type: number
 *                 example: 5715
 *               pesoReal:
 *                 type: number
 *                 example: 10.5
 *               pesoCubado:
 *                 type: number
 *                 example: 11.2
 *               pesoTaxado:
 *                 type: number
 *                 example: 11.2
 *               volume:
 *                 type: number
 *                 example: 1
 *               frete:
 *                 type: number
 *                 example: 45
 *               icmsPercent:
 *                 type: number
 *                 example: 0
 *               icmsValor:
 *                 type: number
 *                 example: 541
 *               status:
 *                 type: string
 *                 example: "ABERTO"
 *               previsaoEntrega:
 *                 type: string
 *                 format: date-time
 *               dataEntrega:
 *                 type: string
 *                 format: date-time
 *               modal:
 *                 type: string
 *                 example: "RODOVIARIO"
 *               statusEntrega:
 *                 type: string
 *                 example: "PENDENTE"
 *               operacao:
 *                 type: string
 *                 example: "COLETA"
 *               operacaoResumo:
 *                 type: string
 *                 example: "COLETA AGENDADA"
 *               cteNovo:
 *                 type: string
 *                 example: "3275-A"
 *               emissaoData:
 *                 type: string
 *                 format: date-time
 *               transportadora:
 *                 type: string
 *                 example: "Buslog"
 *               encomenda:
 *                 type: string
 *                 example: "ENCOMENDA XPTO"
 *               reentregaDevolucao:
 *                 type: string
 *                 example: "NÃO"
 *               ultimaAtualizacao:
 *                 type: string
 *                 format: date-time
 *               indice:
 *                 type: integer
 *                 example: 1
 *               regiao:
 *                 type: string
 *                 example: "SUDESTE"
 *               comments:
 *                 type: string
 *                 example: "Cadastro inicial do CTE"
 *             required:
 *               - cte
 *     responses:
 *       201:
 *         description: CTE criado com sucesso
 *       400:
 *         description: Dados inválidos
 */
router.post('/', requireLevel(2), controller.create);

/**
 * @swagger
 * /api/delivery-reports/{id}:
 *   put:
 *     summary: Atualizar CTE
 *     tags: [CTE]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cte:
 *                 type: string
 *                 example: "3275"
 *               tipo:
 *                 type: string
 *                 example: "CIF"
 *               cidadeOrigem:
 *                 type: string
 *                 example: "SANTOS"
 *               ufOrigem:
 *                 type: string
 *                 example: "SP"
 *               remetente:
 *                 type: string
 *                 example: "IGOR DA CUNHA BATISTA"
 *               cidadeDestino:
 *                 type: string
 *                 example: "SANTA RITA DO SAPUCAI"
 *               ufDestino:
 *                 type: string
 *                 example: "MG"
 *               destinatario:
 *                 type: string
 *                 example: "OMNILINK TECNOLOGIA S.A."
 *               notaFiscal:
 *                 type: string
 *                 example: "123456"
 *               nfValor:
 *                 type: number
 *                 example: 5715
 *               frete:
 *                 type: number
 *                 example: 45
 *               modal:
 *                 type: string
 *                 example: "RODOVIARIO"
 *               statusEntrega:
 *                 type: string
 *                 example: "PENDENTE"
 *               operacao:
 *                 type: string
 *                 example: "COLETA"
 *               transportadora:
 *                 type: string
 *                 example: "Buslog"
 *               regiao:
 *                 type: string
 *                 example: "SUDESTE"
 *               comments:
 *                 type: string
 *                 example: "Atualização manual do CTE"
 *     responses:
 *       200:
 *         description: CTE atualizado com sucesso
 *       404:
 *         description: CTE não encontrado
 */
router.put('/:id', requireLevel(2), controller.update);

/**
 * @swagger
 * /api/delivery-reports/{id}:
 *   delete:
 *     summary: Excluir CTE (soft delete)
 *     tags: [CTE]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: CTE excluído com sucesso
 *       404:
 *         description: CTE não encontrado
 */
router.delete('/:id', requireLevel(3), controller.remove);

/**
 * @swagger
 * /api/delivery-reports/{id}/restore:
 *   patch:
 *     summary: Restaurar CTE excluído
 *     tags: [CTE]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               comments:
 *                 type: string
 *                 example: "Restaurado após validação"
 *     responses:
 *       200:
 *         description: CTE restaurado com sucesso
 *       404:
 *         description: CTE não encontrado
 */
router.patch('/:id/restore', requireLevel(3), controller.restore);

module.exports = router;