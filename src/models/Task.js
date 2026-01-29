const { DataTypes, Model } = require('sequelize');
const sequelize = require('../db');

class Task extends Model {}

Task.init({
  title:        { type: DataTypes.STRING, allowNull: false },
  description:  { type: DataTypes.TEXT, allowNull: true },
  priority:     { type: DataTypes.ENUM('LOW','MEDIUM','HIGH'), defaultValue: 'MEDIUM' },
  status:       { type: DataTypes.ENUM('NEW','ACK','IN_PROGRESS','DONE','BLOCKED','CANCELLED'), defaultValue: 'NEW' },
  dueDate:      { type: DataTypes.DATE, allowNull: true },

  // confirmação
  ackAt:        { type: DataTypes.DATE, allowNull: true },
  completedAt:  { type: DataTypes.DATE, allowNull: true },
},
  {
    sequelize,
    modelName: 'Task',
    tableName: 'tasks',
    timestamps: false,      // ✅ ESSENCIAL
    freezeTableName: true,
  }
);


module.exports = Task;
