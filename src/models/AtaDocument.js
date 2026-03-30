const { DataTypes, Model } = require('sequelize');
const sequelize = require('../db');

class AtaDocument extends Model {}

AtaDocument.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

    ataRegistrationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    status: {
      type: DataTypes.ENUM('SENT', 'APPROVED', 'REJECTED'),
      allowNull: false,
      defaultValue: 'SENT',
    },

    originalName: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    fileName: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    mimeType: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    size: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    url: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    reviewedById: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'AtaDocument',
    tableName: 'ata_documents',
    timestamps: true,
  }
);

module.exports = AtaDocument;