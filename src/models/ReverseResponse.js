const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const ReverseResponse = sequelize.define('ReverseResponse', {
  token: { type: DataTypes.STRING, allowNull: false, unique: true },
  status: {
    type: DataTypes.ENUM('PENDENTE', 'PARCIAL', 'ENVIADO', 'AGUARDANDO_COLETA', 'COLETA_SOLICITADA', 'FINALIZADO'),
    allowNull: false,
    defaultValue: 'PENDENTE',
  },
  openedAt: { type: DataTypes.DATE, allowNull: true },
  submittedAt: { type: DataTypes.DATE, allowNull: true },
  partialSavedAt: { type: DataTypes.DATE, allowNull: true },
  lastUpdateAt: { type: DataTypes.DATE, allowNull: true },
  lastChatMessageAt: { type: DataTypes.DATE, allowNull: true },
  reminderSentAt: { type: DataTypes.DATE, allowNull: true },
  observation: { type: DataTypes.TEXT, allowNull: true },
  providerSnapshot: { type: DataTypes.JSON, allowNull: true },

  // Controles individuais da reversa
  publicLinkEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  chatHidden: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  unreadMessagesProvider: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  unreadMessagesAdmin: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
});

module.exports = ReverseResponse;
