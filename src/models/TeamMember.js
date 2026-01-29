// models/TeamMember.js
const { DataTypes, Model } = require('sequelize');
const sequelize = require('../db');

class TeamMember extends Model {}

TeamMember.init({
  role: {
    type: DataTypes.ENUM('COORD', 'SUP', 'TEC', 'PSO'),
    allowNull: false,
  },

  // nome livre (ou derive de User)
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: true },
  region: { type: DataTypes.STRING, allowNull: true },

  // geolocalização para aparecer no mapa
  lat: { type: DataTypes.FLOAT, allowNull: true },
  lng: { type: DataTypes.FLOAT, allowNull: true },

  active: { type: DataTypes.BOOLEAN, defaultValue: true },

  // FKs
  userId: { type: DataTypes.INTEGER, allowNull: true },
  locationId: { type: DataTypes.INTEGER, allowNull: true }, // sede/área base
  coordinatorId: { type: DataTypes.INTEGER, allowNull: true }, // aponta para outro TeamMember (COORD)
  supervisorId: { type: DataTypes.INTEGER, allowNull: true },  // aponta para outro TeamMember (SUP)
}, {
  sequelize,
  modelName: 'TeamMember',
  tableName: 'team_members',
});

module.exports = TeamMember;
