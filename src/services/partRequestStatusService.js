const { PartRequest, PartRequestItem } = require('../models');

async function recalculatePartRequestStatus(partRequestId) {
  const items = await PartRequestItem.findAll({
    where: { partRequestId },
  });

  if (!items.length) {
    await PartRequest.update(
      { status: 'DRAFT' },
      { where: { id: partRequestId } }
    );
    return 'DRAFT';
  }

  const statuses = items.map((item) => item.itemStatus);

  let newStatus = 'SUBMITTED';

  if (statuses.every((s) => s === 'REJECTED')) {
    newStatus = 'REJECTED';
  } else if (statuses.every((s) => s === 'FULFILLED')) {
    newStatus = 'FULFILLED';
  } else if (statuses.every((s) => ['APPROVED', 'FULFILLED'].includes(s))) {
    newStatus = 'APPROVED';
  } else if (statuses.some((s) => ['PARTIALLY_FULFILLED', 'FULFILLED'].includes(s))) {
    newStatus = 'PARTIALLY_FULFILLED';
  } else if (statuses.some((s) => ['APPROVED', 'APPROVED_PARTIAL'].includes(s))) {
    newStatus = 'PARTIALLY_APPROVED';
  } else if (statuses.some((s) => s === 'PENDING_REVIEW')) {
    newStatus = 'UNDER_REVIEW';
  }

  const payload = { status: newStatus };

  if (newStatus === 'APPROVED' || newStatus === 'PARTIALLY_APPROVED') {
    payload.approvedAt = new Date();
  }

  if (newStatus === 'FULFILLED' || newStatus === 'REJECTED' || newStatus === 'CANCELLED') {
    payload.closedAt = new Date();
  }

  await PartRequest.update(payload, { where: { id: partRequestId } });

  return newStatus;
}

module.exports = {
  recalculatePartRequestStatus,
};