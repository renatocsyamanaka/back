const {
  PartRequest,
  PartRequestItem,
  PartRequestHistory,
  sequelize,
  Client,
  User,
} = require('../models');

const partRequestEmailService = require('../services/partRequestEmailService');

function generateRequestNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const random = Math.floor(100000 + Math.random() * 900000);
  return `PP-${year}-${random}`;
}

function clean(v) {
  return String(v || '').trim();
}

async function recalculateRequestStatus(partRequestId, transaction) {
  const items = await PartRequestItem.findAll({
    where: { partRequestId },
    transaction,
  });

  const request = await PartRequest.findByPk(partRequestId, { transaction });
  if (!request) return null;

  const total = items.length;
  const approved = items.filter((i) => i.itemStatus === 'APPROVED').length;
  const approvedPartial = items.filter((i) => i.itemStatus === 'APPROVED_PARTIAL').length;
  const rejected = items.filter((i) => i.itemStatus === 'REJECTED').length;
  const fulfilled = items.filter((i) => i.itemStatus === 'FULFILLED').length;
  const partiallyFulfilled = items.filter((i) => i.itemStatus === 'PARTIALLY_FULFILLED').length;

  let newStatus = request.status;

  if (total > 0 && fulfilled === total) {
    newStatus = 'FULFILLED';
  } else if (fulfilled > 0 || partiallyFulfilled > 0) {
    newStatus = 'PARTIALLY_FULFILLED';
  } else if (approved === total) {
    newStatus = 'APPROVED';
  } else if (rejected === total) {
    newStatus = 'REJECTED';
  } else if (approved > 0 || approvedPartial > 0 || rejected > 0) {
    newStatus = 'PARTIALLY_APPROVED';
  } else {
    newStatus = 'UNDER_REVIEW';
  }

  if (request.status !== newStatus) {
    const previousStatus = request.status;

    await request.update({ status: newStatus }, { transaction });

    await PartRequestHistory.create(
      {
        partRequestId,
        actionType: 'REQUEST_STATUS_UPDATED',
        previousStatus,
        newStatus,
        comments: `Status do pedido atualizado para ${newStatus}.`,
      },
      { transaction }
    );
  }

  return newStatus;
}

async function create(req, res) {
  const transaction = await sequelize.transaction();

  try {
    const {
      originType = 'INTERNAL',
      requesterName,
      requesterDocument,
      requesterPhone,
      requesterEmail,
      requestType = 'ATENDIMENTO',
      clientId,
      clientNameSnapshot,
      providerId,
      providerNameSnapshot,
      technicianId,
      technicianNameSnapshot,
      region,
      occurrence,
      naCode,
      osCode,
      conversationKey,
      fulfillmentType,
      invoiceNumber,
      isExpedited,
      city,
      state,
      scheduleSla,
      customerClassification,
      projectName,
      requestNotes,
      managerId,
      items = [],
    } = req.body;

    if (!clean(requesterName)) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Nome do solicitante é obrigatório.' });
    }

    if (!Array.isArray(items) || !items.length) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Informe pelo menos um item.' });
    }

    if (clientId) {
      const clientExists = await Client.findByPk(clientId, { transaction });
      if (!clientExists) {
        await transaction.rollback();
        return res.status(400).json({ message: 'Cliente informado não existe.' });
      }
    }

    if (managerId) {
      const managerExists = await User.findByPk(managerId, { transaction });
      if (!managerExists) {
        await transaction.rollback();
        return res.status(400).json({ message: 'Gestor informado não existe.' });
      }
    }

    const request = await PartRequest.create(
      {
        requestNumber: generateRequestNumber(),
        originType,
        requesterUserId: req.user?.id || null,
        requesterName: clean(requesterName),
        requesterDocument: clean(requesterDocument) || null,
        requesterPhone: clean(requesterPhone) || null,
        requesterEmail: clean(requesterEmail) || null,
        requestType,
        clientId: clientId || null,
        clientNameSnapshot: clean(clientNameSnapshot) || null,
        providerId: providerId || null,
        providerNameSnapshot: clean(providerNameSnapshot) || null,
        technicianId: technicianId || null,
        technicianNameSnapshot: clean(technicianNameSnapshot) || null,
        region: clean(region) || null,
        occurrence: clean(occurrence) || null,
        naCode: clean(naCode) || null,
        osCode: clean(osCode) || null,
        conversationKey: clean(conversationKey) || null,
        fulfillmentType: fulfillmentType || null,
        invoiceNumber: clean(invoiceNumber) || null,
        isExpedited: Boolean(isExpedited),
        city: clean(city) || null,
        state: clean(state) || null,
        scheduleSla: clean(scheduleSla) || null,
        customerClassification: clean(customerClassification) || null,
        projectName: clean(projectName) || null,
        requestNotes: clean(requestNotes) || null,
        managerId: managerId || null,
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
      { transaction }
    );

    const formattedItems = items.map((item) => ({
      partRequestId: request.id,
      partCode: clean(item.partCode) || null,
      partName: clean(item.partName),
      unit: clean(item.unit) || 'UN',
      requestedQty: Number(item.requestedQty || 0),
      approvedQty: 0,
      deliveredQty: 0,
      rejectedQty: 0,
      pendingQty: Number(item.requestedQty || 0),
      itemStatus: 'PENDING_REVIEW',
      itemRequestNote: clean(item.itemRequestNote) || null,
    }));

    const invalidItem = formattedItems.find(
      (item) => !item.partName || Number(item.requestedQty) <= 0
    );

    if (invalidItem) {
      await transaction.rollback();
      return res.status(400).json({
        message: 'Todos os itens precisam ter nome e quantidade maior que zero.',
      });
    }

    await PartRequestItem.bulkCreate(formattedItems, { transaction });

    await PartRequestHistory.create(
      {
        partRequestId: request.id,
        actionType: 'SUBMITTED',
        previousStatus: null,
        newStatus: 'SUBMITTED',
        comments: 'Pedido criado.',
        performedByUserId: req.user?.id || null,
        performedByName: req.user?.name || req.user?.nome || requesterName,
        performedByProfile: req.user?.role?.name || 'SOLICITANTE',
      },
      { transaction }
    );

    await transaction.commit();

    const fullRequest = await PartRequest.findByPk(request.id, {
      include: [
        { association: 'items', required: false },
        { association: 'manager', attributes: ['id', 'name', 'email'], required: false },
        { association: 'requesterUser', attributes: ['id', 'name', 'email'], required: false },
        { association: 'client', attributes: ['id', 'name'], required: false },
      ],
    });

    try {
      await partRequestEmailService.sendRequestCreatedToManagement(fullRequest);
    } catch (mailError) {
      console.error('[partRequest.create.email]', mailError);
    }

    return res.status(201).json({
      message: 'Pedido criado com sucesso.',
      requestId: request.id,
      requestNumber: request.requestNumber,
    });
  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({
      message: 'Erro ao criar pedido.',
      error: error.message,
    });
  }
}

async function list(req, res) {
  try {
    const {
      status,
      requestNumber,
      requesterName,
      clientId,
      managerId,
      mine,
    } = req.query;

    const where = {};
    if (status) where.status = status;
    if (requestNumber) where.requestNumber = requestNumber;
    if (requesterName) where.requesterName = requesterName;
    if (clientId) where.clientId = clientId;
    if (managerId) where.managerId = managerId;

    if (String(mine) === 'true') {
      where.requesterUserId = req.user?.id || 0;
    }

    const rows = await PartRequest.findAll({
      where,
      include: [
        { association: 'items', required: false },
        { association: 'manager', attributes: ['id', 'name', 'email'], required: false },
        { association: 'requesterUser', attributes: ['id', 'name', 'email'], required: false },
        { association: 'client', attributes: ['id', 'name'], required: false },
      ],
      order: [['id', 'DESC']],
    });

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({
      message: 'Erro ao listar pedidos.',
      error: error.message,
    });
  }
}

async function show(req, res) {
  try {
    const { id } = req.params;

    const row = await PartRequest.findByPk(id, {
      include: [
        {
          association: 'items',
          separate: true,
          order: [['id', 'ASC']],
          include: [
            {
              association: 'history',
              separate: true,
              order: [['id', 'DESC']],
              required: false,
            },
          ],
        },
        {
          association: 'history',
          separate: true,
          order: [['id', 'DESC']],
          required: false,
        },
        {
          association: 'manager',
          attributes: ['id', 'name', 'email'],
          required: false,
        },
        {
          association: 'requesterUser',
          attributes: ['id', 'name', 'email'],
          required: false,
        },
        {
          association: 'client',
          attributes: ['id', 'name'],
          required: false,
        },
      ],
    });

    if (!row) {
      return res.status(404).json({ message: 'Pedido não encontrado.' });
    }

    return res.json(row);
  } catch (error) {
    console.error('[partRequest.show]', error);
    return res.status(500).json({
      message: 'Erro ao buscar pedido.',
      error: error.message,
    });
  }
}

async function update(req, res) {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    const row = await PartRequest.findByPk(id, { transaction });
    if (!row) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Pedido não encontrado.' });
    }

    const previousStatus = row.status;
    const previousFulfillmentType = row.fulfillmentType;
    const previousInvoiceNumber = row.invoiceNumber;
    const previousIsExpedited = Boolean(row.isExpedited);
    const previousRequestNotes = row.requestNotes;
    const previousScheduleSla = row.scheduleSla;
    const previousCustomerClassification = row.customerClassification;
    const previousProjectName = row.projectName;
    const previousOccurrence = row.occurrence;
    const previousNaCode = row.naCode;
    const previousOsCode = row.osCode;

    const {
      fulfillmentType,
      invoiceNumber,
      isExpedited,
      requestNotes,
      scheduleSla,
      customerClassification,
      projectName,
      occurrence,
      naCode,
      osCode,
    } = req.body;

    const nextValues = {
      fulfillmentType:
        typeof fulfillmentType !== 'undefined' ? fulfillmentType || null : row.fulfillmentType,
      invoiceNumber:
        typeof invoiceNumber !== 'undefined' ? clean(invoiceNumber) || null : row.invoiceNumber,
      isExpedited:
        typeof isExpedited !== 'undefined' ? Boolean(isExpedited) : Boolean(row.isExpedited),
      requestNotes:
        typeof requestNotes !== 'undefined' ? clean(requestNotes) || null : row.requestNotes,
      scheduleSla:
        typeof scheduleSla !== 'undefined' ? clean(scheduleSla) || null : row.scheduleSla,
      customerClassification:
        typeof customerClassification !== 'undefined'
          ? clean(customerClassification) || null
          : row.customerClassification,
      projectName:
        typeof projectName !== 'undefined' ? clean(projectName) || null : row.projectName,
      occurrence:
        typeof occurrence !== 'undefined' ? clean(occurrence) || null : row.occurrence,
      naCode:
        typeof naCode !== 'undefined' ? clean(naCode) || null : row.naCode,
      osCode:
        typeof osCode !== 'undefined' ? clean(osCode) || null : row.osCode,
    };

    await row.update(nextValues, { transaction });

    const changes = [];

    if ((previousFulfillmentType || null) !== (row.fulfillmentType || null)) {
      changes.push(
        `Atendimento: ${previousFulfillmentType || '-'} → ${row.fulfillmentType || '-'}`
      );
    }

    if ((previousInvoiceNumber || null) !== (row.invoiceNumber || null)) {
      changes.push(`NF: ${previousInvoiceNumber || '-'} → ${row.invoiceNumber || '-'}`);
    }

    if (previousIsExpedited !== Boolean(row.isExpedited)) {
      changes.push(
        `Expedido: ${previousIsExpedited ? 'Sim' : 'Não'} → ${row.isExpedited ? 'Sim' : 'Não'}`
      );
    }

    if ((previousRequestNotes || null) !== (row.requestNotes || null)) {
      changes.push('Observações do pedido atualizadas');
    }

    if ((previousScheduleSla || null) !== (row.scheduleSla || null)) {
      changes.push(`Prazo/SLA: ${previousScheduleSla || '-'} → ${row.scheduleSla || '-'}`);
    }

    if ((previousCustomerClassification || null) !== (row.customerClassification || null)) {
      changes.push(
        `Classificação: ${previousCustomerClassification || '-'} → ${row.customerClassification || '-'}`
      );
    }

    if ((previousProjectName || null) !== (row.projectName || null)) {
      changes.push(`Projeto: ${previousProjectName || '-'} → ${row.projectName || '-'}`);
    }

    if ((previousOccurrence || null) !== (row.occurrence || null)) {
      changes.push(`Ocorrência: ${previousOccurrence || '-'} → ${row.occurrence || '-'}`);
    }

    if ((previousNaCode || null) !== (row.naCode || null)) {
      changes.push(`NA: ${previousNaCode || '-'} → ${row.naCode || '-'}`);
    }

    if ((previousOsCode || null) !== (row.osCode || null)) {
      changes.push(`OS: ${previousOsCode || '-'} → ${row.osCode || '-'}`);
    }

    await PartRequestHistory.create(
      {
        partRequestId: row.id,
        actionType: 'REQUEST_UPDATED',
        previousStatus,
        newStatus: row.status,
        comments: changes.length ? changes.join(' | ') : 'Pedido atualizado sem alteração relevante.',
        performedByUserId: req.user?.id || null,
        performedByName: req.user?.name || req.user?.nome || 'Usuário',
        performedByProfile: req.user?.role?.name || 'USUÁRIO',
      },
      { transaction }
    );

    await transaction.commit();

    const fullRequest = await PartRequest.findByPk(row.id, {
      include: [
        { association: 'requesterUser', attributes: ['id', 'name', 'email'], required: false },
        { association: 'manager', attributes: ['id', 'name', 'email'], required: false },
        { association: 'client', attributes: ['id', 'name'], required: false },
      ],
    });

    const requesterEmail =
      fullRequest?.requesterEmail || fullRequest?.requesterUser?.email || null;

    console.log('[partRequest.update] requestId=', row.id);
    console.log('[partRequest.update] changes=', changes);
    console.log('[partRequest.update] requesterEmail=', requesterEmail);

    let emailSent = false;
    let emailError = null;

    if (changes.length && requesterEmail) {
      try {
        await partRequestEmailService.sendRequestUpdatedToRequester({
          request: fullRequest,
          changes: changes.join(' | '),
        });
        emailSent = true;
      } catch (mailError) {
        emailError = mailError?.message || 'Falha ao enviar e-mail';
        console.error('[partRequest.update.email]', mailError);
      }
    } else {
      console.warn('[partRequest.update.email] envio ignorado', {
        hasChanges: changes.length > 0,
        requesterEmail,
      });
    }

    return res.json({
      message: 'Pedido atualizado com sucesso.',
      request: row,
      emailSent,
      emailError,
      changes,
    });
  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({
      message: 'Erro ao atualizar pedido.',
      error: error.message,
    });
  }
}

async function batchApprove(req, res) {
  const transaction = await sequelize.transaction();

  try {
    const { id: partRequestId } = req.params;
    const { items = [], managerNote, reasonCode, reasonDetails } = req.body;

    if (!Array.isArray(items) || !items.length) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Informe os itens para aprovação em lote.' });
    }

    const request = await PartRequest.findByPk(partRequestId, { transaction });
    if (!request) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Pedido não encontrado.' });
    }

    const previousRequestStatus = request.status;
    const updatedItems = [];

    for (const row of items) {
      const itemId = Number(row.itemId);
      const approvedQty = Number(row.approvedQty || 0);

      const item = await PartRequestItem.findOne({
        where: { id: itemId, partRequestId },
        transaction,
      });

      if (!item) continue;

      const requestedQty = Number(item.requestedQty || 0);

      if (!Number.isFinite(approvedQty) || approvedQty < 0 || approvedQty > requestedQty) {
        await transaction.rollback();
        return res.status(400).json({
          message: `Quantidade aprovada inválida para o item ${item.partName}.`,
        });
      }

      let newItemStatus = 'APPROVED';
      let rejectedQty = 0;
      let actionType = 'ITEM_APPROVED';

      if (approvedQty === 0) {
        newItemStatus = 'REJECTED';
        rejectedQty = requestedQty;
        actionType = 'ITEM_REJECTED';
      } else if (approvedQty < requestedQty) {
        newItemStatus = 'APPROVED_PARTIAL';
        rejectedQty = requestedQty - approvedQty;
        actionType = 'ITEM_PARTIALLY_APPROVED';
      }

      const previousStatus = item.itemStatus;

      await item.update(
        {
          approvedQty,
          rejectedQty,
          pendingQty: 0,
          itemStatus: newItemStatus,
          managerNote: clean(row.managerNote) || clean(managerNote) || null,
          reasonCode: clean(row.reasonCode) || clean(reasonCode) || null,
          reasonDetails: clean(row.reasonDetails) || clean(reasonDetails) || null,
        },
        { transaction }
      );

      await PartRequestHistory.create(
        {
          partRequestId: item.partRequestId,
          partRequestItemId: item.id,
          actionType,
          previousStatus,
          newStatus: newItemStatus,
          approvedQty,
          comments:
            clean(row.managerNote) ||
            clean(managerNote) ||
            (newItemStatus === 'APPROVED'
              ? 'Item aprovado em lote.'
              : newItemStatus === 'APPROVED_PARTIAL'
              ? 'Item aprovado parcialmente em lote.'
              : 'Item rejeitado em lote.'),
          performedByUserId: req.user?.id || null,
          performedByName: req.user?.name || req.user?.nome || 'Usuário',
          performedByProfile: req.user?.role?.name || 'GESTOR',
        },
        { transaction }
      );

      updatedItems.push({
        id: item.id,
        partCode: item.partCode,
        partName: item.partName,
        requestedQty,
        approvedQty,
        rejectedQty,
        itemStatus: newItemStatus,
        managerNote: clean(row.managerNote) || clean(managerNote) || null,
        reasonCode: clean(row.reasonCode) || clean(reasonCode) || null,
        reasonDetails: clean(row.reasonDetails) || clean(reasonDetails) || null,
      });
    }

    const newRequestStatus = await recalculateRequestStatus(partRequestId, transaction);

    await PartRequestHistory.create(
      {
        partRequestId,
        actionType: 'BATCH_APPROVAL',
        previousStatus: previousRequestStatus,
        newStatus: newRequestStatus || previousRequestStatus,
        comments: `Aprovação em lote realizada para ${updatedItems.length} item(ns).`,
        performedByUserId: req.user?.id || null,
        performedByName: req.user?.name || req.user?.nome || 'Usuário',
        performedByProfile: req.user?.role?.name || 'GESTOR',
      },
      { transaction }
    );

    await transaction.commit();

    const fullRequest = await PartRequest.findByPk(partRequestId, {
      include: [
        { association: 'requesterUser', attributes: ['id', 'name', 'email'], required: false },
        { association: 'manager', attributes: ['id', 'name', 'email'], required: false },
        { association: 'client', attributes: ['id', 'name'], required: false },
      ],
    });

    try {
      await partRequestEmailService.sendBatchDecisionToRequester({
        request: fullRequest,
        items: updatedItems,
      });
    } catch (mailError) {
      console.error('[partRequest.batchApprove.email]', mailError);
    }

    return res.json({
      message: 'Aprovação em lote realizada com sucesso.',
      items: updatedItems,
    });
  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({
      message: 'Erro ao aprovar itens em lote.',
      error: error.message,
    });
  }
}

module.exports = {
  create,
  list,
  show,
  update,
  batchApprove,
};