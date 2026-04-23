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
const DeliveryReport = require('./DeliveryReport');
const DeliveryReportHistory = require('./DeliveryReportHistory');
const Demand = require('./Demand');
const DemandHistory = require('./DemandHistory');
const News = require('./News');
const NewsRead = require('./NewsRead');
const DashboardActivity = require('./DashboardActivity');
const HomologationDocumentType = require('./HomologationDocumentType');
const NeedRegistrationInvite = require('./NeedRegistrationInvite');
const NeedRegistration = require('./NeedRegistration');
const NeedRegistrationDocument = require('./NeedRegistrationDocument');
const NeedInternalDocument = require('./NeedInternalDocument');
const Sector = require('./Sector');
const NewsSector = require('./NewsSector');
const AtaRegistration = require('./AtaRegistration');
const AtaDocument = require('./AtaDocument');
const DashboardBanner = require('./DashboardBanner');
const SystemUpdate = require('./SystemUpdate');
// Solicitação Peças
const PartRequest = require('./PartRequest');
const PartRequestItem = require('./PartRequestItem');
const PartRequestHistory = require('./PartRequestHistory');
//Whatsapp
const WhatsappConversation = require('./WhatsappConversation');
const WhatsappMessage = require('./WhatsappMessage');
const WhatsappFlow = require('./WhatsappFlow');
const WhatsappFlowStep = require('./WhatsappFlowStep');



// ----------------- Whatsapp  -----------------
WhatsappConversation.hasMany(WhatsappMessage, {  as: 'messages',  foreignKey: 'conversationId',  onDelete: 'CASCADE',});
WhatsappMessage.belongsTo(WhatsappConversation, {  as: 'conversation',  foreignKey: 'conversationId',});

WhatsappFlow.hasMany(WhatsappFlowStep, {  as: 'steps',  foreignKey: 'flowId',  onDelete: 'CASCADE',});
WhatsappFlowStep.belongsTo(WhatsappFlow, {  as: 'flow',  foreignKey: 'flowId',});

User.hasMany(WhatsappConversation, {  as: 'whatsappConversationsCreated',  foreignKey: 'createdById',});
WhatsappConversation.belongsTo(User, {  as: 'createdBy',  foreignKey: 'createdById',});

User.hasMany(WhatsappConversation, {  as: 'whatsappConversationsUpdated',  foreignKey: 'updatedById',});
WhatsappConversation.belongsTo(User, {  as: 'updatedBy',  foreignKey: 'updatedById',});

// ----------------- Dashboard Banners -----------------
DashboardBanner.belongsTo(User, {  as: 'createdBy',  foreignKey: 'createdById',  onDelete: 'SET NULL',  onUpdate: 'CASCADE',});
User.hasMany(DashboardBanner, {  as: 'dashboardBannersCreated',  foreignKey: 'createdById',});

DashboardBanner.belongsTo(User, {  as: 'updatedBy',  foreignKey: 'updatedById',  onDelete: 'SET NULL',  onUpdate: 'CASCADE',});
User.hasMany(DashboardBanner, {  as: 'dashboardBannersUpdated',  foreignKey: 'updatedById',});

DashboardBanner.belongsTo(User, {  as: 'deletedBy',  foreignKey: 'deletedById',  onDelete: 'SET NULL',  onUpdate: 'CASCADE',});
User.hasMany(DashboardBanner, {  as: 'dashboardBannersDeleted',  foreignKey: 'deletedById',});

// ----------------- System Updates -----------------
SystemUpdate.belongsTo(User, {  as: 'createdBy',  foreignKey: 'createdById',});
User.hasMany(SystemUpdate, {  as: 'systemUpdatesCreated',  foreignKey: 'createdById',});

SystemUpdate.belongsTo(User, {  as: 'updatedBy',  foreignKey: 'updatedById',});
User.hasMany(SystemUpdate, {  as: 'systemUpdatesUpdated',  foreignKey: 'updatedById',});

SystemUpdate.belongsTo(User, {  as: 'deletedBy',  foreignKey: 'deletedById',});
User.hasMany(SystemUpdate, {  as: 'systemUpdatesDeleted',  foreignKey: 'deletedById',});

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

// ----------------- Need -> homologação -----------------
Need.hasMany(NeedRegistrationInvite, {
  as: 'registrationInvites',
  foreignKey: 'needId',
  onDelete: 'CASCADE',
});
NeedRegistrationInvite.belongsTo(Need, {
  as: 'need',
  foreignKey: 'needId',
});

User.hasMany(NeedRegistrationInvite, {
  as: 'needRegistrationInvitesCreated',
  foreignKey: 'createdById',
});
NeedRegistrationInvite.belongsTo(User, {
  as: 'createdBy',
  foreignKey: 'createdById',
});
Need.hasOne(AtaRegistration, {
  foreignKey: 'needId',
  as: 'ataRegistration',
});
AtaRegistration.belongsTo(Need, {
  foreignKey: 'needId',
  as: 'need',
});

AtaRegistration.hasMany(AtaDocument, {
  foreignKey: 'ataRegistrationId',
  as: 'documents',
});
AtaDocument.belongsTo(AtaRegistration, {
  foreignKey: 'ataRegistrationId',
  as: 'registration',
});

User.hasMany(AtaRegistration, {
  foreignKey: 'reviewedById',
  as: 'reviewedAtaRegistrations',
});
AtaRegistration.belongsTo(User, {
  foreignKey: 'reviewedById',
  as: 'reviewedBy',
});

User.hasMany(AtaDocument, {
  foreignKey: 'reviewedById',
  as: 'reviewedAtaDocuments',
});
AtaDocument.belongsTo(User, {
  foreignKey: 'reviewedById',
  as: 'reviewedBy',
});
Need.hasOne(NeedRegistration, {
  as: 'registration',
  foreignKey: 'needId',
  onDelete: 'CASCADE',
});
NeedRegistration.belongsTo(Need, {
  as: 'need',
  foreignKey: 'needId',
});

NeedRegistrationInvite.hasOne(NeedRegistration, {
  as: 'registration',
  foreignKey: 'inviteId',
  onDelete: 'CASCADE',
});
NeedRegistration.belongsTo(NeedRegistrationInvite, {
  as: 'invite',
  foreignKey: 'inviteId',
});

User.hasMany(NeedRegistration, {
  as: 'needRegistrationsReviewed',
  foreignKey: 'reviewedById',
});
NeedRegistration.belongsTo(User, {
  as: 'reviewedBy',
  foreignKey: 'reviewedById',
});

NeedRegistration.hasMany(NeedRegistrationDocument, {
  as: 'documents',
  foreignKey: 'registrationId',
  onDelete: 'CASCADE',
});
NeedRegistrationDocument.belongsTo(NeedRegistration, {
  as: 'registration',
  foreignKey: 'registrationId',
});

HomologationDocumentType.hasMany(NeedRegistrationDocument, {
  as: 'registrationDocuments',
  foreignKey: 'documentTypeId',
});
NeedRegistrationDocument.belongsTo(HomologationDocumentType, {
  as: 'documentType',
  foreignKey: 'documentTypeId',
});

User.hasMany(NeedRegistrationDocument, {
  as: 'needRegistrationDocumentsReviewed',
  foreignKey: 'reviewedById',
});
NeedRegistrationDocument.belongsTo(User, {
  as: 'reviewedBy',
  foreignKey: 'reviewedById',
});

User.hasMany(Need, {
  as: 'needsHomologationReviewed',
  foreignKey: 'homologationReviewedById',
});
Need.belongsTo(User, {
  as: 'homologationReviewedBy',
  foreignKey: 'homologationReviewedById',
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

NeedAttachment.belongsTo(User, { as: 'uploadedBy', foreignKey: 'uploadedById' });
User.hasMany(NeedAttachment, { as: 'needAttachments', foreignKey: 'uploadedById' });


NeedInternalDocument.belongsTo(User, {  as: 'uploadedBy',  foreignKey: 'uploadedById',});
User.hasMany(NeedInternalDocument, {  as: 'needInternalDocuments',  foreignKey: 'uploadedById',});

// ----------------- Atividades --------------------
DashboardActivity.belongsTo(User, {
  as: 'responsavel',
  foreignKey: 'responsavelId',
});
User.hasMany(DashboardActivity, {
  as: 'dashboardActivitiesResponsible',
  foreignKey: 'responsavelId',
});

DashboardActivity.belongsTo(User, {
  as: 'createdBy',
  foreignKey: 'createdById',
});
User.hasMany(DashboardActivity, {
  as: 'dashboardActivitiesCreated',
  foreignKey: 'createdById',
});

DashboardActivity.belongsTo(User, {
  as: 'updatedBy',
  foreignKey: 'updatedById',
});
User.hasMany(DashboardActivity, {
  as: 'dashboardActivitiesUpdated',
  foreignKey: 'updatedById',
});

DashboardActivity.belongsTo(User, {
  as: 'deletedBy',
  foreignKey: 'deletedById',
});
User.hasMany(DashboardActivity, {
  as: 'dashboardActivitiesDeleted',
  foreignKey: 'deletedById',
});

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

// ----------------- Demandas ---------------
Demand.hasMany(DemandHistory, {
  as: 'history',
  foreignKey: 'demandId',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

DemandHistory.belongsTo(Demand, {
  as: 'demand',
  foreignKey: 'demandId',
});

Demand.belongsTo(User, {
  as: 'responsavel',
  foreignKey: 'responsavelId',
});
User.hasMany(Demand, {
  as: 'demandsResponsible',
  foreignKey: 'responsavelId',
});

Demand.belongsTo(User, {
  as: 'createdBy',
  foreignKey: 'createdById',
});
User.hasMany(Demand, {
  as: 'demandsCreated',
  foreignKey: 'createdById',
});

Demand.belongsTo(User, {
  as: 'updatedBy',
  foreignKey: 'updatedById',
});
User.hasMany(Demand, {
  as: 'demandsUpdated',
  foreignKey: 'updatedById',
});

Demand.belongsTo(User, {
  as: 'deletedBy',
  foreignKey: 'deletedById',
});
User.hasMany(Demand, {
  as: 'demandsDeleted',
  foreignKey: 'deletedById',
});

DemandHistory.belongsTo(User, {
  as: 'performedByUser',
  foreignKey: 'performedByUserId',
});
User.hasMany(DemandHistory, {
  as: 'demandHistories',
  foreignKey: 'performedByUserId',
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

// ----------------- Delivery Reports -----------------
DeliveryReport.hasMany(DeliveryReportHistory, {
  as: 'history',
  foreignKey: 'deliveryReportId',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

DeliveryReportHistory.belongsTo(DeliveryReport, {
  as: 'deliveryReport',
  foreignKey: 'deliveryReportId',
});

DeliveryReport.belongsTo(User, {
  as: 'createdBy',
  foreignKey: 'createdById',
});
User.hasMany(DeliveryReport, {
  as: 'deliveryReportsCreated',
  foreignKey: 'createdById',
});

DeliveryReport.belongsTo(User, {
  as: 'updatedBy',
  foreignKey: 'updatedById',
});
User.hasMany(DeliveryReport, {
  as: 'deliveryReportsUpdated',
  foreignKey: 'updatedById',
});

DeliveryReport.belongsTo(User, {
  as: 'deletedBy',
  foreignKey: 'deletedById',
});
User.hasMany(DeliveryReport, {
  as: 'deliveryReportsDeleted',
  foreignKey: 'deletedById',
});

DeliveryReportHistory.belongsTo(User, {
  as: 'performedByUser',
  foreignKey: 'performedByUserId',
});
User.hasMany(DeliveryReportHistory, {
  as: 'deliveryReportHistories',
  foreignKey: 'performedByUserId',
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
  WhatsappConversation,
  WhatsappMessage,
  WhatsappFlow,
  WhatsappFlowStep,
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
  DeliveryReport,
  DeliveryReportHistory,
  Demand,
  DemandHistory,
  DashboardActivity,
  HomologationDocumentType,
  NeedRegistrationInvite,
  NeedRegistration,
  NeedRegistrationDocument,
  NeedInternalDocument,
  AtaRegistration,
  AtaDocument,
  DashboardBanner,
  SystemUpdate,
};