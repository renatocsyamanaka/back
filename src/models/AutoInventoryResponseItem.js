const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const AutoInventoryResponseItem = sequelize.define('AutoInventoryResponseItem', {
  quantidade: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
});

module.exports = AutoInventoryResponseItem;