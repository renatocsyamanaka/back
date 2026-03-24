const { DataTypes, Model } = require('sequelize');
const sequelize = require('../db');

class DeliveryReportHistory extends Model {}

DeliveryReportHistory.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    deliveryReportId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    actionType: {
      type: DataTypes.STRING(80),
      allowNull: false,
    },

    fieldName: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },

    oldValue: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
    },

    newValue: {
      type: DataTypes.TEXT('long'),
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
    modelName: 'DeliveryReportHistory',
    tableName: 'delivery_report_histories',
    timestamps: true,
    indexes: [
      { fields: ['deliveryReportId'] },
      { fields: ['actionType'] },
      { fields: ['performedByUserId'] },
      { fields: ['fieldName'] },
      { fields: ['createdAt'] },
    ],
  }
);

module.exports = DeliveryReportHistory;