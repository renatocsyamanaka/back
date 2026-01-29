const sequelize = require('../db');

const Role = require('./Role');
const User = require('./User');
const Location = require('./Location');
const Client = require('./Client');
const TechType = require('./TechType');
const Need = require('./Need');
const NeedAttachment = require('./NeedAttachment'); // ✅ ADD
const Assignment = require('./Assignment');
const OvertimeEntry = require('./OvertimeEntry');
const TimeOff = require('./TimeOff');
const Task = require('./Task');
const TeamMember = require('./TeamMember');

const InstallationProject = require('./InstallationProject');
const InstallationProjectItem = require('./InstallationProjectItem');
const InstallationProjectProgress = require('./InstallationProjectProgress');
const InstallationProjectProgressVehicle = require('./InstallationProjectProgressVehicle');

const News = require('./News');
const NewsRead = require('./NewsRead');

// ----------------- Relações TeamMember -----------------
TeamMember.belongsTo(User, { as: 'user', foreignKey: 'userId' });
TeamMember.belongsTo(Location, { as: 'location', foreignKey: 'locationId' });
TeamMember.belongsTo(TeamMember, { as: 'coordinator', foreignKey: 'coordinatorId' });
TeamMember.belongsTo(TeamMember, { as: 'supervisor', foreignKey: 'supervisorId' });

// ----------------- Usuário / Papel / Local -----------------
Role.hasMany(User, { as: 'users', foreignKey: 'roleId' });
User.belongsTo(Role, { as: 'role', foreignKey: 'roleId' });

User.hasMany(User, { as: 'subordinates', foreignKey: 'managerId' });
User.belongsTo(User, { as: 'manager', foreignKey: 'managerId' });

Location.hasMany(User, { as: 'users', foreignKey: 'locationId' });
User.belongsTo(Location, { as: 'location', foreignKey: 'locationId' });

// ----------------- Assignments -----------------
User.hasMany(Assignment, { as: 'assignments', foreignKey: 'userId' });
Assignment.belongsTo(User, { as: 'user', foreignKey: 'userId' });

Client.hasMany(Assignment, { as: 'assignments', foreignKey: 'clientId' });
Assignment.belongsTo(Client, { as: 'client', foreignKey: 'clientId' });

Location.hasMany(Assignment, { as: 'assignments', foreignKey: 'locationId' });
Assignment.belongsTo(Location, { as: 'location', foreignKey: 'locationId' });

// Need -> User (solicitante)
Need.belongsTo(User, { as: 'requestedBy', foreignKey: 'requestedByUserId' });
User.hasMany(Need, { as: 'needsRequested', foreignKey: 'requestedByUserId' });

// Need -> TechType
Need.belongsTo(TechType, { as: 'techType', foreignKey: 'techTypeId' });
TechType.hasMany(Need, { as: 'needs', foreignKey: 'techTypeId' });

// ✅ Need -> Attachments
Need.hasMany(NeedAttachment, { as: 'attachments', foreignKey: 'needId', onDelete: 'CASCADE' });
NeedAttachment.belongsTo(Need, { as: 'need', foreignKey: 'needId' });

// ✅ opcional: quem anexou
NeedAttachment.belongsTo(User, { as: 'uploadedBy', foreignKey: 'uploadedById' });
User.hasMany(NeedAttachment, { as: 'needAttachments', foreignKey: 'uploadedById' });

// ----------------- News -----------------
News.belongsTo(User, {
  as: 'creator',
  foreignKey: 'createdById',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE',
});

NewsRead.belongsTo(News, { foreignKey: 'newsId' });
NewsRead.belongsTo(User, { foreignKey: 'userId' });

// ----------------- Tasks -----------------
User.hasMany(Task, { as: 'assignedTasks', foreignKey: 'assignedToId' });
Task.belongsTo(User, { as: 'assignee', foreignKey: 'assignedToId' });

User.hasMany(Task, { as: 'createdTasks', foreignKey: 'createdById' });
Task.belongsTo(User, { as: 'creator', foreignKey: 'createdById' });

Location.hasMany(Task, { as: 'tasks', foreignKey: 'locationId' });
Task.belongsTo(Location, { as: 'location', foreignKey: 'locationId' });

Client.hasMany(Task, { as: 'tasks', foreignKey: 'clientId' });
Task.belongsTo(Client, { as: 'client', foreignKey: 'clientId' });

// ----------------- Overtime -----------------
OvertimeEntry.belongsTo(User, { as: 'approvedBy', foreignKey: 'approvedById' });
OvertimeEntry.belongsTo(User, { as: 'createdBy', foreignKey: 'createdById' });
OvertimeEntry.belongsTo(User, { as: 'user', foreignKey: 'userId' });

// ----------------- TimeOff -----------------
User.hasMany(TimeOff, { as: 'timeoffs', foreignKey: 'userId' });
TimeOff.belongsTo(User, { as: 'user', foreignKey: 'userId' });

// ----------------- Install -----------------
InstallationProject.belongsTo(User, { as: 'supervisor', foreignKey: 'supervisorId' });
InstallationProject.belongsTo(User, { as: 'coordinator', foreignKey: 'coordinatorId' });
InstallationProject.belongsTo(User, { as: 'technician', foreignKey: 'technicianId' });

InstallationProject.belongsTo(User, { as: 'creator', foreignKey: 'createdById' });
InstallationProject.belongsTo(User, { as: 'updater', foreignKey: 'updatedById' });

InstallationProject.belongsTo(Client, { as: 'client', foreignKey: 'clientId' });

InstallationProject.hasMany(InstallationProjectItem, { as: 'items', foreignKey: 'projectId' });
InstallationProjectItem.belongsTo(InstallationProject, { as: 'project', foreignKey: 'projectId' });

InstallationProject.hasMany(InstallationProjectProgress, { as: 'progress', foreignKey: 'projectId' });
InstallationProjectProgress.belongsTo(InstallationProject, { as: 'project', foreignKey: 'projectId' });
InstallationProjectProgress.belongsTo(User, { as: 'author', foreignKey: 'createdById' });

// ----------------- Exports -----------------
module.exports = {
  sequelize,
  Role,
  User,
  Location,
  Client,
  TechType,
  Need,
  NeedAttachment, // ✅ ADD
  Assignment,
  OvertimeEntry,
  TimeOff,
  Task,
  TeamMember,
  News,
  NewsRead,
  InstallationProject,
  InstallationProjectItem,
  InstallationProjectProgress,
  InstallationProjectProgressVehicle,
};
