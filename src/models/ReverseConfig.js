const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const ReverseConfig = sequelize.define('ReverseConfig', {
  sendDay: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 20 },
  enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  emailCc: { type: DataTypes.TEXT, allowNull: true },
  collectionEmails: { type: DataTypes.TEXT, allowNull: true },
  publicBaseUrl: { type: DataTypes.STRING, allowNull: true },
  defaultTransportadora: { type: DataTypes.STRING, allowNull: true },
  collectionSubject: { type: DataTypes.STRING, allowNull: true },
  collectionBody: { type: DataTypes.TEXT, allowNull: true },
  reminderDays: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 3 },
  autoCreateCycle: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  autoSendEmails: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
});

module.exports = ReverseConfig;
