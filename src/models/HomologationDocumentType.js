const { DataTypes, Model } = require('sequelize');
const sequelize = require('../db');

class HomologationDocumentType extends Model {}

HomologationDocumentType.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

    name: {
      type: DataTypes.STRING(180),
      allowNull: false,
    },

    code: {
      type: DataTypes.STRING(80),
      allowNull: false,
      unique: true,
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    isRequired: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },

    allowMultiple: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },

    templateName: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    templateUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'HomologationDocumentType',
    tableName: 'homologation_document_types',
    timestamps: true,
    indexes: [
      { fields: ['active'] },
      { unique: true, fields: ['code'] },
    ],
  }
);

module.exports = HomologationDocumentType;