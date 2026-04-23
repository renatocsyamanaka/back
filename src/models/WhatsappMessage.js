const { DataTypes, Model } = require('sequelize');
const sequelize = require('../db');

class WhatsappMessage extends Model {}

WhatsappMessage.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    conversationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    direction: {
      type: DataTypes.ENUM('IN', 'OUT'),
      allowNull: false,
    },
    senderType: {
      type: DataTypes.ENUM('USER', 'BOT', 'AGENT', 'SYSTEM'),
      allowNull: false,
      defaultValue: 'SYSTEM',
    },
    messageType: {
      type: DataTypes.ENUM('TEXT', 'BUTTON', 'LIST', 'IMAGE', 'AUDIO', 'DOCUMENT', 'SYSTEM'),
      allowNull: false,
      defaultValue: 'TEXT',
    },
    providerMessageId: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    text: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    rawPayload: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    buttons: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    readAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    sentAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    createdById: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'WhatsappMessage',
    tableName: 'whatsapp_messages',
    timestamps: true,
    indexes: [
      { fields: ['conversationId'] },
      { fields: ['direction'] },
      { fields: ['senderType'] },
      { fields: ['providerMessageId'] },
      { fields: ['createdAt'] },
    ],
  }
);

module.exports = WhatsappMessage;
