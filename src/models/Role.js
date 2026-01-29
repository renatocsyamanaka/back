const { DataTypes, Model } = require('sequelize');
const sequelize = require('../db');

class Role extends Model {}
Role.init({
  name: { type: DataTypes.STRING, allowNull: false, unique: true }, // 'Tecnico', 'Supervisor', ...
  level: { type: DataTypes.INTEGER, allowNull: false } // hierarquia: 1 Tecnico, 2 Supervisor, 3 Coordenador, 4 Gerente, 5 Diretor
}, { sequelize, modelName: 'Role', tableName: 'roles' });

module.exports = Role;