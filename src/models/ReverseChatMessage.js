const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const ReverseChatMessage = sequelize.define('ReverseChatMessage', {
  sender: { type: DataTypes.ENUM('PROVIDER', 'ADMIN'), allowNull: false },
  body: { type: DataTypes.TEXT, allowNull: false },
  sentByName: { type: DataTypes.STRING, allowNull: true },
  sentByEmail: { type: DataTypes.STRING, allowNull: true },
  readAt: { type: DataTypes.DATE, allowNull: true },
});

module.exports = ReverseChatMessage;
