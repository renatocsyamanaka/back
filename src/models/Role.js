const { DataTypes, Model } = require('sequelize');
const sequelize = require('../db');

class Role extends Model {}
Role.init({
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  level: { type: DataTypes.INTEGER, allowNull: false } 
}, { sequelize, modelName: 'Role', tableName: 'roles' });

module.exports = Role;