const sequelize = require('../db');

const Role = require('./Role');
const User = require('./User');
const Location = require('./Location');
const Client = require('./Client');
const TechType = require('./TechType');
const Need = require('./Need');
const NeedAttachment = require('./NeedAttachment');
const Assignment = require('./Assignment');
const OvertimeEntry = require('./OvertimeEntry');
const TimeOff = require('./TimeOff');
const Task = require('./Task');
const TeamMember = require('./TeamMember');
const PartCatalog = require('./PartCatalog');
const InstallationProject = require('./InstallationProject');
const InstallationProjectItem = require('./InstallationProjectItem');
const InstallationProjectProgress = require('./InstallationProjectProgress');
const InstallationProjectProgressVehicle = require('./InstallationProjectProgressVehicle');
const UserRegistrationRequest = require('./UserRegistrationRequest');

const News = require('./News');
const NewsRead = require('./NewsRead');

// NOVOS
const Sector = require('./Sector');
const NewsSector = require('./NewsSector');

// Solicitação Peças
const PartRequest = require('./PartRequest');
const PartRequestItem = require('./PartRequestItem');
const PartRequestHistory = require('./PartRequestHistory');

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

// ----------------- Usuário / Setor -----------------
Sector.hasMany(User, {
  as: 'users',
  foreignKey: 'sectorId',
});
User.belongsTo(Sector, {
  as: 'sector',
  foreignKey: 'sectorId',
});

// ----------------- Assignments -----------------
User.hasMany(Assignment, { as: 'assignments', foreignKey: 'userId' });
Assignment.belongsTo(User, { as: 'user', foreignKey: 'userId' });

Client.hasMany(Assignment, { as: 'assignments', foreignKey: 'clientId' });
Assignment.belongsTo(Client, { as: 'client', foreignKey: 'clientId' });

Location.hasMany(Assignment, { as: 'assignments', foreignKey: 'locationId' });
Assignment.belongsTo(Location, { as: 'location', foreignKey: 'locationId' });

// ----------------- Need -> User (solicitante) -----------------
Need.belongsTo(User, { as: 'requestedBy', foreignKey: 'requestedByUserId' });
User.hasMany(Need, { as: 'needsRequested', foreignKey: 'requestedByUserId' });

// ----------------- Solicitação de cadastro -----------------
UserRegistrationRequest.belongsTo(Role, { as: 'role', foreignKey: 'roleId' });
UserRegistrationRequest.belongsTo(User, { as: 'manager', foreignKey: 'managerId' });
UserRegistrationRequest.belongsTo(User, { as: 'approvedBy', foreignKey: 'approvedById' });
UserRegistrationRequest.belongsTo(User, { as: 'rejectedBy', foreignKey: 'rejectedById' });

// ----------------- Need -> TechType -----------------
Need.belongsTo(TechType, { as: 'techType', foreignKey: 'techTypeId' });
TechType.hasMany(Need, { as: 'needs', foreignKey: 'techTypeId' });

// ----------------- Need -> Attachments -----------------
Need.hasMany(NeedAttachment, {
  as: 'attachments',
  foreignKey: 'needId',
  onDelete: 'CASCADE',
});
NeedAttachment.belongsTo(Need, { as: 'need', foreignKey: 'needId' });

// opcional: quem anexou
NeedAttachment.belongsTo(User, { as: 'uploadedBy', foreignKey: 'uploadedById' });
User.hasMany(NeedAttachment, { as: 'needAttachments', foreignKey: 'uploadedById' });

// ----------------- Part Requests -----------------
PartRequest.hasMany(PartRequestItem, {
  as: 'items',
  foreignKey: 'partRequestId',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});
PartRequestItem.belongsTo(PartRequest, {
  as: 'request',
  foreignKey: 'partRequestId',
});

PartRequest.hasMany(PartRequestHistory, {
  as: 'history',
  foreignKey: 'partRequestId',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});
PartRequestHistory.belongsTo(PartRequest, {
  as: 'request',
  foreignKey: 'partRequestId',
});

PartRequestItem.hasMany(PartRequestHistory, {
  as: 'history',
  foreignKey: 'partRequestItemId',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE',
});
PartRequestHistory.belongsTo(PartRequestItem, {
  as: 'item',
  foreignKey: 'partRequestItemId',
});

PartRequest.belongsTo(User, {
  as: 'requesterUser',
  foreignKey: 'requesterUserId',
});
User.hasMany(PartRequest, {
  as: 'partRequestsRequested',
  foreignKey: 'requesterUserId',
});

PartRequest.belongsTo(User, {
  as: 'manager',
  foreignKey: 'managerId',
});
User.hasMany(PartRequest, {
  as: 'partRequestsManaged',
  foreignKey: 'managerId',
});

PartRequestHistory.belongsTo(User, {
  as: 'performedByUser',
  foreignKey: 'performedByUserId',
});
User.hasMany(PartRequestHistory, {
  as: 'partRequestHistories',
  foreignKey: 'performedByUserId',
});

PartRequest.belongsTo(Client, {
  as: 'client',
  foreignKey: 'clientId',
});
Client.hasMany(PartRequest, {
  as: 'partRequests',
  foreignKey: 'clientId',
});

// ----------------- News -----------------
News.belongsTo(User, {
  as: 'creator',
  foreignKey: 'createdById',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE',
});
User.hasMany(News, {
  as: 'createdNews',
  foreignKey: 'createdById',
});

NewsRead.belongsTo(News, {
  as: 'news',
  foreignKey: 'newsId',
});
News.hasMany(NewsRead, {
  as: 'reads',
  foreignKey: 'newsId',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

NewsRead.belongsTo(User, {
  as: 'user',
  foreignKey: 'userId',
});
User.hasMany(NewsRead, {
  as: 'newsReads',
  foreignKey: 'userId',
});

// ----------------- News <-> Sector -----------------
News.belongsToMany(Sector, {
  through: NewsSector,
  foreignKey: 'newsId',
  otherKey: 'sectorId',
  as: 'sectors',
});

Sector.belongsToMany(News, {
  through: NewsSector,
  foreignKey: 'sectorId',
  otherKey: 'newsId',
  as: 'news',
});

News.hasMany(NewsSector, {
  as: 'newsSectors',
  foreignKey: 'newsId',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});
NewsSector.belongsTo(News, {
  as: 'news',
  foreignKey: 'newsId',
});

Sector.hasMany(NewsSector, {
  as: 'newsSectors',
  foreignKey: 'sectorId',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});
NewsSector.belongsTo(Sector, {
  as: 'sector',
  foreignKey: 'sectorId',
});

// ----------------- Vinculo Parte item -----------------
PartCatalog.belongsTo(User, {
  as: 'createdBy',
  foreignKey: 'createdById',
});
User.hasMany(PartCatalog, {
  as: 'createdPartCatalogItems',
  foreignKey: 'createdById',
});

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
User.hasMany(OvertimeEntry, { as: 'approvedOvertimes', foreignKey: 'approvedById' });

OvertimeEntry.belongsTo(User, { as: 'createdBy', foreignKey: 'createdById' });
User.hasMany(OvertimeEntry, { as: 'createdOvertimes', foreignKey: 'createdById' });

OvertimeEntry.belongsTo(User, { as: 'user', foreignKey: 'userId' });
User.hasMany(OvertimeEntry, { as: 'overtimeEntries', foreignKey: 'userId' });

// ----------------- TimeOff -----------------
User.hasMany(TimeOff, { as: 'timeoffs', foreignKey: 'userId' });
TimeOff.belongsTo(User, { as: 'user', foreignKey: 'userId' });

// ----------------- Install -----------------
InstallationProject.belongsTo(User, { as: 'supervisor', foreignKey: 'supervisorId' });
User.hasMany(InstallationProject, { as: 'supervisedInstallationProjects', foreignKey: 'supervisorId' });

InstallationProject.belongsTo(User, { as: 'coordinator', foreignKey: 'coordinatorId' });
User.hasMany(InstallationProject, { as: 'coordinatedInstallationProjects', foreignKey: 'coordinatorId' });

InstallationProject.belongsTo(User, { as: 'technician', foreignKey: 'technicianId' });
User.hasMany(InstallationProject, { as: 'technicianInstallationProjects', foreignKey: 'technicianId' });

InstallationProject.belongsTo(User, { as: 'creator', foreignKey: 'createdById' });
User.hasMany(InstallationProject, { as: 'createdInstallationProjects', foreignKey: 'createdById' });

InstallationProject.belongsTo(User, { as: 'updater', foreignKey: 'updatedById' });
User.hasMany(InstallationProject, { as: 'updatedInstallationProjects', foreignKey: 'updatedById' });

InstallationProject.belongsTo(Client, { as: 'client', foreignKey: 'clientId' });
Client.hasMany(InstallationProject, { as: 'installationProjects', foreignKey: 'clientId' });

InstallationProject.hasMany(InstallationProjectItem, { as: 'items', foreignKey: 'projectId' });
InstallationProjectItem.belongsTo(InstallationProject, { as: 'project', foreignKey: 'projectId' });

InstallationProject.hasMany(InstallationProjectProgress, { as: 'progress', foreignKey: 'projectId' });
InstallationProjectProgress.belongsTo(InstallationProject, { as: 'project', foreignKey: 'projectId' });

InstallationProjectProgress.belongsTo(User, { as: 'author', foreignKey: 'createdById' });
User.hasMany(InstallationProjectProgress, { as: 'installationProgressAuthored', foreignKey: 'createdById' });

// IMPORTANTE:
// A associação InstallationProjectProgress -> InstallationProjectProgressVehicle
// com alias "vehicles" já existe no seu sistema/model.
// Por isso NÃO repetimos aqui, para evitar:
// "You have used the alias vehicles in two separate associations."

// ----------------- Exports -----------------
module.exports = {
  sequelize,
  Role,
  User,
  Location,
  Client,
  TechType,
  Need,
  NeedAttachment,
  Assignment,
  OvertimeEntry,
  TimeOff,
  Task,
  TeamMember,
  News,
  NewsRead,
  Sector,
  NewsSector,
  InstallationProject,
  InstallationProjectItem,
  InstallationProjectProgress,
  InstallationProjectProgressVehicle,
  PartRequest,
  PartRequestItem,
  PartRequestHistory,
  PartCatalog,
  UserRegistrationRequest,
};