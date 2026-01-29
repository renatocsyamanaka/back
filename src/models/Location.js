// src/models/Location.js
const { DataTypes, Model } = require('sequelize');
const sequelize = require('../db');

class Location extends Model {}
Location.init({
  name:        { type: DataTypes.STRING, allowNull: false },
  area:        { type: DataTypes.STRING, allowNull: true },
  city:        { type: DataTypes.STRING, allowNull: true },
  state:       { type: DataTypes.STRING, allowNull: true }, // se você usa "UF", mantenha coerente
  uf:          { type: DataTypes.STRING(2), allowNull: true },
  lat:         { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  lng:         { type: DataTypes.DECIMAL(10, 7), allowNull: true },
}, { sequelize, tableName: 'locations', modelName: 'Location' });

module.exports = Location;
