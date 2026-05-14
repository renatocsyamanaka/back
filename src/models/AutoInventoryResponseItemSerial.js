const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const AutoInventoryResponseItemSerial = sequelize.define(
  'AutoInventoryResponseItemSerial',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    responseItemId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    serialNumber: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
  },
  {
    tableName: 'AutoInventoryResponseItemSerials',
    timestamps: true,
  }
);

module.exports = AutoInventoryResponseItemSerial;