const { DataTypes, Model } = require('sequelize');
const sequelize = require('../db');

class PartRequestHistory extends Model {}

PartRequestHistory.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

    partRequestId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    partRequestItemId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    actionType: {
      type: DataTypes.STRING(80),
      allowNull: false,
    },

    previousStatus: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },

    newStatus: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },

    approvedQty: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    deliveredQty: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    comments: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
    },

    performedByUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    performedByName: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },

    performedByProfile: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'PartRequestHistory',
    tableName: 'part_request_histories',
    timestamps: true,
    indexes: [
      { fields: ['partRequestId'] },
      { fields: ['partRequestItemId'] },
      { fields: ['actionType'] },
      { fields: ['performedByUserId'] },
    ],
  }
);

module.exports = PartRequestHistory;