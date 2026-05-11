const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const AutoInventoryConfig = sequelize.define('AutoInventoryConfig', {
  sendDay: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 20,
  },

  emailCc: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

  enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
});

module.exports = AutoInventoryConfig;