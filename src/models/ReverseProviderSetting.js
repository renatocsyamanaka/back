const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const ReverseProviderSetting = sequelize.define('ReverseProviderSetting', {
  providerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
  },
  activeReverse: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  emitsInvoice: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  },
  defaultTransporter: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  observation: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'reverse_provider_settings',
});

module.exports = ReverseProviderSetting;
