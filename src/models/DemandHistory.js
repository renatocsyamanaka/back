const { DataTypes, Model } = require('sequelize');
const sequelize = require('../db');

class DemandHistory extends Model {}

DemandHistory.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    demandId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    actionType: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },

    fieldName: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    oldValue: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    newValue: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    comments: {
      type: DataTypes.TEXT,
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
      type: DataTypes.STRING(100),
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'DemandHistory',
    tableName: 'demand_histories',
    timestamps: true,
    indexes: [
      { fields: ['demandId'] },
      { fields: ['actionType'] },
      { fields: ['performedByUserId'] },
      { fields: ['createdAt'] },
    ],
  }
);

module.exports = DemandHistory;