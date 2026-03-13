const { DataTypes, Model } = require('sequelize');
const sequelize = require('../db');

class PartRequestItem extends Model {}

PartRequestItem.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

    partRequestId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    partCode: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },

    partName: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },

    unit: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'UN',
    },

    requestedQty: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    approvedQty: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    deliveredQty: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    rejectedQty: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    pendingQty: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    itemStatus: {
      type: DataTypes.ENUM(
        'PENDING_REVIEW',
        'APPROVED_PARTIAL',
        'APPROVED',
        'REJECTED',
        'PARTIALLY_FULFILLED',
        'FULFILLED',
        'CANCELLED',
        'REOPENED'
      ),
      allowNull: false,
      defaultValue: 'PENDING_REVIEW',
    },

    itemRequestNote: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
    },

    reasonCode: {
      type: DataTypes.ENUM(
        'SEM_ESTOQUE',
        'REPROVADO_GERENTE',
        'DADOS_INSUFICIENTES',
        'ITEM_INCORRETO',
        'ATENDIMENTO_PARCIAL',
        'AGUARDANDO_VALIDACAO',
        'FORA_DO_ESCOPO',
        'OUTROS'
      ),
      allowNull: true,
    },

    reasonDetails: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
    },

    managerNote: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
    },

    stockNote: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'PartRequestItem',
    tableName: 'part_request_items',
    timestamps: true,
    indexes: [
      { fields: ['partRequestId'] },
      { fields: ['partCode'] },
      { fields: ['itemStatus'] },
      { fields: ['reasonCode'] },
    ],
  }
);

module.exports = PartRequestItem;