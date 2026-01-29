const { DataTypes, Model } = require('sequelize');
const sequelize = require('../db');

class NeedAttachment extends Model {}

NeedAttachment.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

    needId: { type: DataTypes.INTEGER, allowNull: false },

    kind: {
      type: DataTypes.ENUM('CONTRATO', 'DOCUMENTO', 'FOTO', 'OUTRO'),
      allowNull: false,
      defaultValue: 'DOCUMENTO',
    },

    originalName: { type: DataTypes.STRING, allowNull: false },
    fileName: { type: DataTypes.STRING, allowNull: false },
    mimeType: { type: DataTypes.STRING, allowNull: false },
    size: { type: DataTypes.INTEGER, allowNull: false },
    url: { type: DataTypes.STRING, allowNull: false },

    uploadedById: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    sequelize,
    modelName: 'NeedAttachment',
    tableName: 'need_attachments',
    timestamps: true,
    indexes: [{ fields: ['needId'] }, { fields: ['uploadedById'] }],
  }
);

module.exports = NeedAttachment;
