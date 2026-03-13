const {
  PartRequest,
  PartRequestItem,
  PartRequestHistory,
  sequelize,
} = require('../models');

const partRequestEmailService = require('../services/partRequestEmailService');

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

async function approve(req, res) {
  const transaction = await sequelize.transaction();

  try {
    const { itemId } = req.params;
    const { approvedQty, managerNote, reasonCode, reasonDetails } = req.body;

    const item = await PartRequestItem.findByPk(itemId, { transaction });

    if (!item) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Item não encontrado.' });
    }

    const requestedQty = Number(item.requestedQty || 0);
    const qtyApproved = Number(approvedQty || 0);

    if (!Number.isFinite(qtyApproved) || qtyApproved < 0) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Quantidade aprovada inválida.' });
    }

    if (qtyApproved > requestedQty) {
      await transaction.rollback();
      return res.status(400).json({
        message: 'Quantidade aprovada não pode ser maior que a solicitada.',
      });
    }

    let newItemStatus = item.itemStatus;
    let rejectedQty = 0;
    let pendingQty = 0;
    let actionType = 'ITEM_APPROVED';

    if (qtyApproved === 0) {
      newItemStatus = 'REJECTED';
      rejectedQty = requestedQty;
      pendingQty = 0;
      actionType = 'ITEM_REJECTED';
    } else if (qtyApproved < requestedQty) {
      newItemStatus = 'APPROVED_PARTIAL';
      rejectedQty = requestedQty - qtyApproved;
      pendingQty = 0;
      actionType = 'ITEM_PARTIALLY_APPROVED';
    } else {
      newItemStatus = 'APPROVED';
      rejectedQty = 0;
      pendingQty = 0;
      actionType = 'ITEM_APPROVED';
    }

    const previousStatus = item.itemStatus;

    await item.update(
      {
        approvedQty: qtyApproved,
        rejectedQty,
        pendingQty,
        itemStatus: newItemStatus,
        managerNote: clean(managerNote) || null,
        reasonCode: clean(reasonCode) || null,
        reasonDetails: clean(reasonDetails) || null,
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
        approvedQty: qtyApproved,
        comments:
          clean(managerNote) ||
          (newItemStatus === 'APPROVED'
            ? 'Item aprovado.'
            : newItemStatus === 'APPROVED_PARTIAL'
            ? 'Item aprovado parcialmente.'
            : 'Item rejeitado.'),
        performedByUserId: req.user?.id || null,
        performedByName: req.user?.name || req.user?.nome || 'Usuário',
        performedByProfile: req.user?.role?.name || 'GESTOR',
      },
      { transaction }
    );

    await recalculateRequestStatus(item.partRequestId, transaction);

    await transaction.commit();

    const fullRequest = await PartRequest.findByPk(item.partRequestId, {
      include: [
        { association: 'requesterUser', attributes: ['id', 'name', 'email'], required: false },
        { association: 'manager', attributes: ['id', 'name', 'email'], required: false },
        { association: 'client', attributes: ['id', 'name'], required: false },
      ],
    });

    const updatedItem = await PartRequestItem.findByPk(item.id);

    try {
      const actionLabel =
        updatedItem.itemStatus === 'APPROVED'
          ? 'ITEM_APPROVED'
          : updatedItem.itemStatus === 'APPROVED_PARTIAL'
          ? 'ITEM_PARTIALLY_APPROVED'
          : 'ITEM_REJECTED';

      await partRequestEmailService.sendItemDecisionToRequester({
        request: fullRequest,
        item: updatedItem,
        actionLabel,
      });
    } catch (mailError) {
      console.error('[partRequestItem.approve.email]', mailError);
    }

    return res.json({
      message:
        updatedItem.itemStatus === 'APPROVED'
          ? 'Item aprovado com sucesso.'
          : updatedItem.itemStatus === 'APPROVED_PARTIAL'
          ? 'Item aprovado parcialmente com sucesso.'
          : 'Item rejeitado com sucesso.',
      item: updatedItem,
    });
  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({
      message: 'Erro ao aprovar item.',
      error: error.message,
    });
  }
}

async function reject(req, res) {
  const transaction = await sequelize.transaction();

  try {
    const { itemId } = req.params;
    const { managerNote, reasonCode, reasonDetails } = req.body;

    const item = await PartRequestItem.findByPk(itemId, { transaction });

    if (!item) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Item não encontrado.' });
    }

    const previousStatus = item.itemStatus;
    const requestedQty = Number(item.requestedQty || 0);

    await item.update(
      {
        approvedQty: 0,
        rejectedQty: requestedQty,
        pendingQty: 0,
        itemStatus: 'REJECTED',
        managerNote: clean(managerNote) || null,
        reasonCode: clean(reasonCode) || 'REPROVADO_GERENTE',
        reasonDetails: clean(reasonDetails) || null,
      },
      { transaction }
    );

    await PartRequestHistory.create(
      {
        partRequestId: item.partRequestId,
        partRequestItemId: item.id,
        actionType: 'ITEM_REJECTED',
        previousStatus,
        newStatus: 'REJECTED',
        approvedQty: 0,
        comments: clean(managerNote) || 'Item rejeitado.',
        performedByUserId: req.user?.id || null,
        performedByName: req.user?.name || req.user?.nome || 'Usuário',
        performedByProfile: req.user?.role?.name || 'GESTOR',
      },
      { transaction }
    );

    await recalculateRequestStatus(item.partRequestId, transaction);

    await transaction.commit();

    const fullRequest = await PartRequest.findByPk(item.partRequestId, {
      include: [
        { association: 'requesterUser', attributes: ['id', 'name', 'email'], required: false },
        { association: 'manager', attributes: ['id', 'name', 'email'], required: false },
        { association: 'client', attributes: ['id', 'name'], required: false },
      ],
    });

    const updatedItem = await PartRequestItem.findByPk(item.id);

    try {
      await partRequestEmailService.sendItemDecisionToRequester({
        request: fullRequest,
        item: updatedItem,
        actionLabel: 'ITEM_REJECTED',
      });
    } catch (mailError) {
      console.error('[partRequestItem.reject.email]', mailError);
    }

    return res.json({
      message: 'Item rejeitado com sucesso.',
      item: updatedItem,
    });
  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({
      message: 'Erro ao rejeitar item.',
      error: error.message,
    });
  }
}

module.exports = {
  approve,
  reject,
};