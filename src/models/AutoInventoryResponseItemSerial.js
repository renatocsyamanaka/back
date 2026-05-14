const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const AutoInventoryResponseItemSerial = sequelize.define('AutoInventoryResponseItemSerial', {
  serialNumber: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

module.exports = AutoInventoryResponseItemSerial;
