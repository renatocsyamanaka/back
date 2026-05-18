const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const ReverseResponseItemSerial = sequelize.define('ReverseResponseItemSerial', {
  serial: { type: DataTypes.STRING, allowNull: false },
});

module.exports = ReverseResponseItemSerial;
