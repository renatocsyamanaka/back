const { DataTypes, Model } = require('sequelize');
const sequelize = require('../db');

class PartRequest extends Model {}

PartRequest.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

    requestNumber: {
      type: DataTypes.STRING(30),
      allowNull: false,
      unique: true,
    },

    originType: {
      type: DataTypes.ENUM('INTERNAL', 'EXTERNAL_IDENTIFIED'),
      allowNull: false,
      defaultValue: 'INTERNAL',
    },

    requesterUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    requesterName: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },

    requesterDocument: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },

    requesterPhone: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },

    requesterEmail: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },

    requestType: {
      type: DataTypes.ENUM('ATENDIMENTO', 'TECNICO', 'OUTRO'),
      allowNull: false,
      defaultValue: 'ATENDIMENTO',
    },

    clientId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    clientNameSnapshot: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },

    providerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    providerNameSnapshot: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },

    technicianId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    technicianNameSnapshot: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },

    region: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },

    occurrence: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },

    naCode: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    osCode: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    conversationKey: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },

    fulfillmentType: {
      type: DataTypes.ENUM('RETIRADA', 'ENTREGA'),
      allowNull: true,
    },

    city: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },

    state: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },

    scheduleSla: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },

    customerClassification: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },

    projectName: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },

    requestNotes: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
    },

    status: {
      type: DataTypes.ENUM(
        'DRAFT',
        'SUBMITTED',
        'UNDER_REVIEW',
        'PARTIALLY_APPROVED',
        'APPROVED',
        'PARTIALLY_FULFILLED',
        'FULFILLED',
        'REJECTED',
        'CANCELLED',
        'REOPENED'
      ),
      allowNull: false,
      defaultValue: 'SUBMITTED',
    },

    managerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    managerNote: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
    },

    reopenReason: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
    },

    submittedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    invoiceNumber: {
    type: DataTypes.STRING(100),
    allowNull: true,
    },
    expeditedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    isExpedited: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    approvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    closedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    reopenedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'PartRequest',
    tableName: 'part_requests',
    timestamps: true,
    indexes: [
      { fields: ['requestNumber'], unique: true },
      { fields: ['status'] },
      { fields: ['requesterUserId'] },
      { fields: ['clientId'] },
      { fields: ['providerId'] },
      { fields: ['technicianId'] },
      { fields: ['managerId'] },
      { fields: ['naCode'] },
      { fields: ['osCode'] },
    ],
  }
);

module.exports = PartRequest;