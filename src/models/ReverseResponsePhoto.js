const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const ReverseResponsePhoto = sequelize.define('ReverseResponsePhoto', {
  fileName: { type: DataTypes.STRING, allowNull: false },
  originalName: { type: DataTypes.STRING, allowNull: true },
  mimeType: { type: DataTypes.STRING, allowNull: true },
  size: { type: DataTypes.INTEGER, allowNull: true },
  path: { type: DataTypes.STRING, allowNull: false },
  url: { type: DataTypes.STRING, allowNull: false },
});

module.exports = ReverseResponsePhoto;
