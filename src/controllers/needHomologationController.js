const Joi = require('joi');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { sendMail } = require('../services/mailer');
const archiver = require('archiver');

const {
  Need,
  User,
  HomologationDocumentType,
  NeedRegistrationInvite,
  NeedRegistration,
  NeedRegistrationDocument,
} = require('../models');

const { ok, created, bad, notFound } = require('../utils/responses');

const EXTRA_DOCUMENT_CODE = 'ARQUIVOS_ADICIONAIS';
const INTERNAL_DOCUMENT_CODE = 'DOCUMENTOS_INTERNOS';
const MAX_EXTRA_FILES = 10;

const REMOVED_ATA_CODES = ['FICHA_REGISTRO_TECNICO', 'DADOS_CADASTRAIS'];

const DEFAULT_REQUIRED_DOCUMENTS = [
  {
    name: 'CNH',
    code: 'CNH',
    description: 'Carteira Nacional de Habilitação.',
    isRequired: true,
    allowMultiple: false,
    sortOrder: 30,
  },
  {
    name: 'Cartão CNPJ',
    code: 'CARTAO_CNPJ',
    description: 'Comprovante de inscrição do CNPJ.',
    isRequired: true,
    allowMultiple: false,
    sortOrder: 40,
  },
  {
    name: 'Comprovante de residência',
    code: 'COMPROVANTE_RESIDENCIA',
    description: 'Comprovante de endereço atualizado.',
    isRequired: true,
    allowMultiple: false,
    sortOrder: 50,
  },
    {
    name: 'Contrato Social',
    code: 'CONTRATO_SOCIAL',
    description: 'Contrato social ou documento equivalente da empresa.',
    isRequired: true,
    allowMultiple: false,
    sortOrder: 45,
  },
  {
    name: 'Foto da fachada',
    code: 'FOTO_FACHADA',
    description: 'Foto da fachada do posto autorizado / oficina.',
    isRequired: false,
    allowMultiple: true,
    sortOrder: 80,
  },
  {
    name: 'Foto do interior',
    code: 'FOTO_INTERIOR',
    description: 'Foto do interior do posto autorizado / oficina.',
    isRequired: false,
    allowMultiple: true,
    sortOrder: 81,
  },
  {
    name: 'Foto do veículo 1',
    code: 'FOTO_VEICULO_1',
    description: 'Foto do veículo utilizado no atendimento.',
    isRequired: false,
    allowMultiple: true,
    sortOrder: 82,
  },
  {
    name: 'Foto do veículo 2',
    code: 'FOTO_VEICULO_2',
    description: 'Foto adicional do veículo utilizado no atendimento.',
    isRequired: false,
    allowMultiple: true,
    sortOrder: 83,
  },
  {
    name: 'Documento do veículo 1',
    code: 'DOCUMENTO_VEICULO_1',
    description: 'Primeiro documento obrigatório do veículo.',
    isRequired: true,
    allowMultiple: false,
    sortOrder: 60,
  },
  {
    name: 'Documento do veículo 2',
    code: 'DOCUMENTO_VEICULO_2',
    description: 'Segundo documento obrigatório do veículo.',
    isRequired: true,
    allowMultiple: false,
    sortOrder: 70,
  },
  {
    name: 'Arquivos adicionais',
    code: EXTRA_DOCUMENT_CODE,
    description: 'Fotos ou documentos extras opcionais, limitados a 10 arquivos.',
    isRequired: false,
    allowMultiple: true,
    sortOrder: 999,
  },
  {
    name: 'Documentos internos',
    code: INTERNAL_DOCUMENT_CODE,
    description: 'Arquivos internos visíveis apenas para usuários logados.',
    isRequired: false,
    allowMultiple: true,
    sortOrder: 1000,
  },
];

function buildPublicLink(token) {
  const base = process.env.TECHNICIAN_PUBLIC_BASE_URL || 'http://localhost:5173';
  return `${base.replace(/\/+$/, '')}/cadastro-tecnico/${token}`;
}
function sendInviteUnavailable(res, invite) {
  if (!invite) {
    return res.status(404).json({
      error: 'Link não encontrado.',
      code: 'LINK_NOT_FOUND',
      status: 'NOT_FOUND',
      message: 'O link informado não foi localizado.',
    });
  }

  if (invite.status === 'CANCELLED') {
    return res.status(410).json({
      error: 'Este link foi cancelado. Será necessário solicitar um novo link.',
      code: 'LINK_CANCELLED',
      status: 'CANCELLED',
      message: 'Este link foi cancelado. Será necessário solicitar um novo link.',
    });
  }

  if (isInviteExpired(invite)) {
    return res.status(410).json({
      error: 'Este link expirou. Será necessário solicitar um novo link.',
      code: 'LINK_EXPIRED',
      status: 'EXPIRED',
      message: 'Este link expirou. Será necessário solicitar um novo link.',
    });
  }

  return null;
}

async function findValidInviteByToken(token) {
  const invite = await NeedRegistrationInvite.findOne({
    where: { token },
  });

  if (!invite) {
    return { invite: null, blockedResponse: 'NOT_FOUND' };
  }

  if (invite.status === 'CANCELLED') {
    return { invite, blockedResponse: 'CANCELLED' };
  }

  if (isInviteExpired(invite)) {
    if (invite.status !== 'EXPIRED') {
      await invite.update({ status: 'EXPIRED' });
    }

    return { invite, blockedResponse: 'EXPIRED' };
  }

  return { invite, blockedResponse: null };
}
function isInviteExpired(invite) {
  return !!invite?.expiresAt && new Date(invite.expiresAt).getTime() < Date.now();
}

function getAbsoluteUploadPathFromUrl(url) {
  const rel = String(url || '').replace(/^\/+/, '');
  return path.resolve(process.cwd(), rel);
}

function buildStoredUploadUrl(token, fileName) {
  return `/uploads/homologation/tmp/${token}/${fileName}`;
}

function buildInternalStoredUploadUrl(needId, fileName) {
  return `/uploads/homologation/internal/${needId}/${fileName}`;
}
async function getLatestRegistrationByNeedId(needId) {
  return NeedRegistration.findOne({
    where: { needId },
    order: [['id', 'DESC']],
  });
}
async function getRegistrationApprovalSnapshot(registrationId) {
  const registration = await NeedRegistration.findByPk(registrationId);

  if (!registration) {
    return {
      registration: null,
      grouped: null,
      isFullyApproved: false,
      requiredTotal: 0,
      requiredApproved: 0,
      requiredPending: 0,
    };
  }

  const grouped = await getGroupedRegistrationDocuments(registration.id);

  const requiredTotal = grouped.progress?.requiredTotal || 0;
  const requiredApproved = grouped.progress?.requiredApproved || 0;
  const requiredPending = Math.max(requiredTotal - requiredApproved, 0);

  const isFullyApproved =
    registration.status === 'APPROVED' &&
    requiredTotal > 0 &&
    requiredApproved === requiredTotal;

  return {
    registration,
    grouped,
    isFullyApproved,
    requiredTotal,
    requiredApproved,
    requiredPending,
  };
}

async function getLatestRegistrationApprovalSnapshotByNeedId(needId) {
  const registration = await getLatestRegistrationByNeedId(needId);

  if (!registration) {
    return {
      registration: null,
      grouped: null,
      isFullyApproved: false,
      requiredTotal: 0,
      requiredApproved: 0,
      requiredPending: 0,
    };
  }

  return getRegistrationApprovalSnapshot(registration.id);
}
async function ensureDefaultDocumentTypes() {
  // remove tipos antigos de ATA que você não quer mais usar
  await HomologationDocumentType.destroy({
    where: {
      code: REMOVED_ATA_CODES,
    },
  });

  for (const item of DEFAULT_REQUIRED_DOCUMENTS) {
    await HomologationDocumentType.findOrCreate({
      where: { code: item.code },
      defaults: item,
    });
  }
}

async function ensureRegistrationFromInvite(invite) {
  let registration = await NeedRegistration.findOne({
    where: { inviteId: invite.id },
  });

  if (!registration) {
    registration = await NeedRegistration.create({
      needId: invite.needId,
      inviteId: invite.id,
      fullName: invite.technicianName || null,
      email: invite.technicianEmail || null,
      phone: invite.technicianPhone || null,
      status: 'DRAFT',
    });
  }

  return registration;
}

async function syncNeedHomologationStatus(needId) {
  const need = await Need.findByPk(needId);
  if (!need) return;

  const snapshot = await getLatestRegistrationApprovalSnapshotByNeedId(needId);
  const registration = snapshot.registration;

  if (!registration) {
    await need.update({
      homologationStatus: need.homologationLinkSentAt ? 'LINK_SENT' : 'NOT_SENT',
      homologationReviewedAt: null,
      homologationReviewedById: null,
    });
    return;
  }

  if (snapshot.isFullyApproved) {
    await need.update({
      homologationStatus: 'APPROVED',
      homologationReviewedAt: registration.reviewedAt || new Date(),
      homologationReviewedById: registration.reviewedById || null,
      homologationSubmittedAt: registration.submittedAt || null,
    });
    return;
  }

  if (registration.status === 'REJECTED') {
    await need.update({
      homologationStatus: 'REJECTED',
      homologationReviewedAt: registration.reviewedAt || new Date(),
      homologationReviewedById: registration.reviewedById || null,
      homologationSubmittedAt: registration.submittedAt || null,
    });
    return;
  }

  if (registration.status === 'ADJUSTMENT_REQUIRED') {
    await need.update({
      homologationStatus: 'ADJUSTMENT_REQUIRED',
      homologationReviewedAt: registration.reviewedAt || new Date(),
      homologationReviewedById: registration.reviewedById || null,
      homologationSubmittedAt: registration.submittedAt || null,
    });
    return;
  }

  if (registration.status === 'UNDER_REVIEW') {
    await need.update({
      homologationStatus: 'UNDER_REVIEW',
      homologationSubmittedAt: registration.submittedAt || null,
      homologationReviewedAt: registration.reviewedAt || null,
      homologationReviewedById: registration.reviewedById || null,
    });
    return;
  }

  if (registration.status === 'APPROVED' && !snapshot.isFullyApproved) {
    await need.update({
      homologationStatus: 'UNDER_REVIEW',
      homologationSubmittedAt: registration.submittedAt || null,
      homologationReviewedAt: registration.reviewedAt || null,
      homologationReviewedById: registration.reviewedById || null,
    });
    return;
  }

  if (registration.status === 'SUBMITTED') {
    await need.update({
      homologationStatus: 'SUBMITTED',
      homologationSubmittedAt: registration.submittedAt || null,
      homologationReviewedAt: null,
      homologationReviewedById: null,
    });
    return;
  }

  await need.update({
    homologationStatus: 'IN_PROGRESS',
    homologationSubmittedAt: registration.submittedAt || null,
    homologationReviewedAt: null,
    homologationReviewedById: null,
  });
}

async function getGroupedRegistrationDocuments(registrationId) {
  const registration = await NeedRegistration.findByPk(registrationId);

  if (!registration) {
    return {
      documentTypes: [],
      documents: [],
      requiredChecklist: [],
      additionalDocumentType: null,
      additionalDocuments: [],
      internalDocumentType: null,
      internalDocuments: [],
      progress: {
        requiredTotal: 0,
        requiredSent: 0,
        requiredApproved: 0,
        missingRequired: 0,
        percent: 0,
        extraLimit: MAX_EXTRA_FILES,
        extraUsed: 0,
        extraRemaining: MAX_EXTRA_FILES,
      },
    };
  }

  const documentTypes = await HomologationDocumentType.findAll({
    where: {
      active: true,
      code: { [Op.notIn]: REMOVED_ATA_CODES },
    },
    order: [['sortOrder', 'ASC'], ['name', 'ASC']],
  });

  const documents = await NeedRegistrationDocument.findAll({
    where: { registrationId },
    include: [
      { model: HomologationDocumentType, as: 'documentType' },
      { model: User, as: 'reviewedBy', attributes: ['id', 'name'] },
    ],
    order: [['createdAt', 'DESC']],
  });

  const additionalDocumentType =
    documentTypes.find((docType) => docType.code === EXTRA_DOCUMENT_CODE) || null;

  const internalDocumentType =
    documentTypes.find((docType) => docType.code === INTERNAL_DOCUMENT_CODE) || null;

  const hasVehicle =
    !!registration.vehicleCar ||
    !!registration.vehicleMoto ||
    !!registration.vehicleTruck;

  const hasWorkshop =
    !!registration.serviceOmnilinkWorkshop ||
    !!registration.serviceLinkerWorkshop;

  const conditionalRequiredCodes = new Set();

  if (hasWorkshop) {
    conditionalRequiredCodes.add('FOTO_FACHADA');
    conditionalRequiredCodes.add('FOTO_INTERIOR');
  }

  if (hasVehicle) {
    conditionalRequiredCodes.add('FOTO_VEICULO_1');
    conditionalRequiredCodes.add('FOTO_VEICULO_2');
  }

  const requiredDocumentTypes = documentTypes.filter((docType) => {
    if (docType.code === EXTRA_DOCUMENT_CODE) return false;
    if (docType.code === INTERNAL_DOCUMENT_CODE) return false;

    return docType.isRequired || conditionalRequiredCodes.has(docType.code);
  });

  const requiredChecklist = requiredDocumentTypes.map((docType) => {
    const docs = documents.filter((doc) => doc.documentTypeId === docType.id);
    const latestDocument = docs[0] || null;

    return {
      documentTypeId: docType.id,
      code: docType.code,
      name: docType.name,
      description: docType.description,
      templateName: docType.templateName,
      templateUrl: docType.templateUrl,
      isRequired: true,
      allowMultiple: !!docType.allowMultiple,
      sentCount: docs.length,
      latestStatus: latestDocument?.status || 'PENDING',
      latestDocument,
      documents: docs,
    };
  });

  const additionalDocuments = additionalDocumentType
    ? documents.filter((doc) => doc.documentTypeId === additionalDocumentType.id)
    : [];

  const internalDocuments = internalDocumentType
    ? documents.filter((doc) => doc.documentTypeId === internalDocumentType.id)
    : [];

  const requiredTotal = requiredChecklist.length;
  const requiredSent = requiredChecklist.filter((item) => item.sentCount > 0).length;
  const requiredApproved = requiredChecklist.filter(
    (item) => item.latestStatus === 'APPROVED'
  ).length;

  return {
    documentTypes,
    documents,
    requiredChecklist,
    additionalDocumentType,
    additionalDocuments,
    internalDocumentType,
    internalDocuments,
    progress: {
      requiredTotal,
      requiredSent,
      requiredApproved,
      missingRequired: Math.max(requiredTotal - requiredSent, 0),
      percent: requiredTotal ? Math.round((requiredApproved / requiredTotal) * 100) : 0,
      extraLimit: MAX_EXTRA_FILES,
      extraUsed: additionalDocuments.length,
      extraRemaining: Math.max(MAX_EXTRA_FILES - additionalDocuments.length, 0),
    },
  };
}

async function buildNeedSummaryPayload(needId) {
  await ensureDefaultDocumentTypes();

  const need = await Need.findByPk(needId, {
    include: [
      {
        model: NeedRegistrationInvite,
        as: 'registrationInvites',
        include: [{ model: User, as: 'createdBy', attributes: ['id', 'name'] }],
      },
    ],
    order: [[{ model: NeedRegistrationInvite, as: 'registrationInvites' }, 'createdAt', 'DESC']],
  });

  if (!need) return null;

  const registration = await getLatestRegistrationByNeedId(needId);

  const grouped = registration
    ? await getGroupedRegistrationDocuments(registration.id)
    : {
        documentTypes: await HomologationDocumentType.findAll({
          where: {
            active: true,
            code: { [Op.notIn]: REMOVED_ATA_CODES },
          },
          order: [['sortOrder', 'ASC'], ['name', 'ASC']],
        }),
        documents: [],
        requiredChecklist: [],
        additionalDocumentType: null,
        additionalDocuments: [],
        internalDocumentType: null,
        internalDocuments: [],
        progress: {
          requiredTotal: 0,
          requiredSent: 0,
          requiredApproved: 0,
          missingRequired: 0,
          percent: 0,
          extraLimit: MAX_EXTRA_FILES,
          extraUsed: 0,
          extraRemaining: MAX_EXTRA_FILES,
        },
      };

  return {
    need: {
      ...need.toJSON(),
      registration,
    },
    requiredChecklist: grouped.requiredChecklist,
    additionalDocumentType: grouped.additionalDocumentType,
    additionalDocuments: grouped.additionalDocuments,
    internalDocumentType: grouped.internalDocumentType,
    internalDocuments: grouped.internalDocuments,
    documentTypes: grouped.documentTypes,
    documents: grouped.documents,
    progress: grouped.progress,
  };
}
const createInviteSchema = Joi.object({
  technicianName: Joi.string().min(3).max(180).required(),
  technicianEmail: Joi.string().email().allow(null, ''),
  technicianPhone: Joi.string().max(40).allow(null, ''),
  expiresInDays: Joi.number().integer().min(1).max(90).default(15),
}).required();

const documentTypeSchema = Joi.object({
  name: Joi.string().min(2).max(180).required(),
  code: Joi.string().min(2).max(80).required(),
  description: Joi.string().allow('', null),
  isRequired: Joi.boolean().default(true),
  allowMultiple: Joi.boolean().default(false),
  sortOrder: Joi.number().integer().default(0),
  active: Joi.boolean().default(true),
}).required();

const publicDraftSchema = Joi.object({
  fullName: Joi.string().allow('', null),
  rg: Joi.string().allow('', null),
  cpf: Joi.string().allow('', null),
  birthDate: Joi.string().allow('', null),
  motherName: Joi.string().allow('', null),
  address: Joi.string().allow('', null),
  district: Joi.string().allow('', null),
  company: Joi.string().allow('', null),
  city: Joi.string().allow('', null),
  state: Joi.string().max(2).allow('', null),
  zipCode: Joi.string().allow('', null),
  phone: Joi.string().allow('', null),
  roleName: Joi.string().allow('', null),
  cnpj: Joi.string().allow('', null),
  email: Joi.string().email().allow('', null),
  schedulingContactName: Joi.string().allow('', null),
  schedulingContactEmail: Joi.string().email().allow('', null),
  schedulingContactPhone: Joi.string().allow('', null),
  paymentContactName: Joi.string().allow('', null),
  paymentContactEmail: Joi.string().email().allow('', null),
  paymentContactPhone: Joi.string().allow('', null),
  witnessName: Joi.string().allow('', null),
  witnessCpf: Joi.string().allow('', null),
  witnessEmail: Joi.string().email().allow('', null),
  witnessPhone: Joi.string().allow('', null),
  bankName: Joi.string().allow('', null),
  bankCode: Joi.string().allow('', null),
  agency: Joi.string().allow('', null),
  agencyDigit: Joi.string().allow('', null),
  accountNumber: Joi.string().allow('', null),
  accountDigit: Joi.string().allow('', null),
  hasCltEmployees: Joi.boolean().allow(null),
  serviceOmnilinkWorkshop: Joi.boolean().allow(null),
  serviceLinkerWorkshop: Joi.boolean().allow(null),
  serviceOmnilinkExternal: Joi.boolean().allow(null),
  serviceLinkerExternal: Joi.boolean().allow(null),
  vehicleCar: Joi.boolean().allow(null),
  vehicleMoto: Joi.boolean().allow(null),
  vehicleTruck: Joi.boolean().allow(null),
  agreeTravel: Joi.boolean().allow(null),
  declarationAccepted: Joi.boolean().allow(null),
}).required();

const reviewDocumentSchema = Joi.object({
  status: Joi.string().valid('APPROVED', 'REJECTED').required(),
  notes: Joi.string().allow('', null),
}).required();

const reviewRegistrationSchema = Joi.object({
  status: Joi.string()
    .valid('UNDER_REVIEW', 'ADJUSTMENT_REQUIRED', 'APPROVED', 'REJECTED')
    .required(),
  reviewNotes: Joi.string().allow('', null),
}).required();
function normalizePagination(query) {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 100);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function buildApprovedWhere(query) {
  const where = {
    status: 'APPROVED',
  };

  if (query.q) {
    const q = String(query.q).trim();
    if (q) {
      where[Op.or] = [
        { fullName: { [Op.like]: `%${q}%` } },
        { company: { [Op.like]: `%${q}%` } },
        { cpf: { [Op.like]: `%${q}%` } },
        { cnpj: { [Op.like]: `%${q}%` } },
        { email: { [Op.like]: `%${q}%` } },
        { phone: { [Op.like]: `%${q}%` } },
      ];
    }
  }

  if (query.city) {
    where.city = { [Op.like]: `%${String(query.city).trim()}%` };
  }

  if (query.state) {
    where.state = String(query.state).trim().toUpperCase();
  }

  if (query.company) {
    where.company = { [Op.like]: `%${String(query.company).trim()}%` };
  }

  if (query.dateFrom || query.dateTo) {
    where.reviewedAt = {};
    if (query.dateFrom) {
      where.reviewedAt[Op.gte] = new Date(`${query.dateFrom}T00:00:00`);
    }
    if (query.dateTo) {
      where.reviewedAt[Op.lte] = new Date(`${query.dateTo}T23:59:59`);
    }
  }

  return where;
}

function buildRegistrationSummary(row, snapshot = null) {
  const json = row.toJSON();

  const documents = Array.isArray(json.documents) ? json.documents : [];
  const approvedDocs = documents.filter((doc) => doc.status === 'APPROVED');

  return {
    id: json.id,
    needId: json.needId,
    inviteId: json.inviteId,
    status: json.status,
    fullName: json.fullName,
    company: json.company,
    cpf: json.cpf,
    cnpj: json.cnpj,
    phone: json.phone,
    email: json.email,
    city: json.city,
    state: json.state,
    roleName: json.roleName,
    reviewedAt: json.reviewedAt,
    submittedAt: json.submittedAt,
    createdAt: json.createdAt,
    updatedAt: json.updatedAt,
    reviewedBy: json.reviewedBy || null,
    isFullyApproved: !!snapshot?.isFullyApproved,
    progress: {
      requiredTotal: snapshot?.requiredTotal || 0,
      requiredApproved: snapshot?.requiredApproved || 0,
      requiredPending: snapshot?.requiredPending || 0,
    },
    need: json.need
      ? {
          id: json.need.id,
          requestedName: json.need.requestedName,
          providerName: json.need.providerName,
          requestedLocationText: json.need.requestedLocationText,
          requestedCity: json.need.requestedCity,
          requestedState: json.need.requestedState,
          requestedCep: json.need.requestedCep,
          homologationStatus: json.need.homologationStatus,
          homologationReviewedAt: json.need.homologationReviewedAt,
        }
      : null,
    invite: json.invite
      ? {
          id: json.invite.id,
          technicianName: json.invite.technicianName,
          technicianEmail: json.invite.technicianEmail,
          technicianPhone: json.invite.technicianPhone,
          status: json.invite.status,
          openedAt: json.invite.openedAt,
          usedAt: json.invite.usedAt,
          lastSentAt: json.invite.lastSentAt,
          expiresAt: json.invite.expiresAt,
        }
      : null,
    totals: {
      documentsSent: documents.length,
      documentsApproved: approvedDocs.length,
    },
  };
}

async function findApprovedRegistrationOr404(registrationId) {
  const row = await NeedRegistration.findOne({
    where: {
      id: registrationId,
      status: 'APPROVED',
    },
    include: [
      {
        model: Need,
        as: 'need',
      },
      {
        model: NeedRegistrationInvite,
        as: 'invite',
      },
      {
        model: User,
        as: 'reviewedBy',
        attributes: ['id', 'name', 'email'],
      },
      {
        model: NeedRegistrationDocument,
        as: 'documents',
        include: [
          {
            model: HomologationDocumentType,
            as: 'documentType',
          },
          {
            model: User,
            as: 'reviewedBy',
            attributes: ['id', 'name', 'email'],
          },
        ],
      },
    ],
    order: [
      [{ model: NeedRegistrationDocument, as: 'documents' }, 'createdAt', 'DESC'],
    ],
  });

  if (!row) return null;

  const snapshot = await getRegistrationApprovalSnapshot(row.id);
  if (!snapshot.isFullyApproved) return null;

  return row;
}

async function findApprovedRegistrationOr404(registrationId) {
  const row = await NeedRegistration.findOne({
    where: {
      id: registrationId,
      status: 'APPROVED',
    },
    include: [
      {
        model: Need,
        as: 'need',
      },
      {
        model: NeedRegistrationInvite,
        as: 'invite',
      },
      {
        model: User,
        as: 'reviewedBy',
        attributes: ['id', 'name', 'email'],
      },
      {
        model: NeedRegistrationDocument,
        as: 'documents',
        include: [
          {
            model: HomologationDocumentType,
            as: 'documentType',
          },
          {
            model: User,
            as: 'reviewedBy',
            attributes: ['id', 'name', 'email'],
          },
        ],
      },
    ],
    order: [
      [{ model: NeedRegistrationDocument, as: 'documents' }, 'createdAt', 'DESC'],
    ],
  });

  return row;
}
async function findRegistrationWithRelationsOr404(registrationId) {
  const row = await NeedRegistration.findOne({
    where: {
      id: registrationId,
    },
    include: [
      {
        model: Need,
        as: 'need',
      },
      {
        model: NeedRegistrationInvite,
        as: 'invite',
      },
      {
        model: User,
        as: 'reviewedBy',
        attributes: ['id', 'name', 'email'],
      },
      {
        model: NeedRegistrationDocument,
        as: 'documents',
        include: [
          {
            model: HomologationDocumentType,
            as: 'documentType',
          },
          {
            model: User,
            as: 'reviewedBy',
            attributes: ['id', 'name', 'email'],
          },
        ],
      },
    ],
    order: [
      [{ model: NeedRegistrationDocument, as: 'documents' }, 'createdAt', 'DESC'],
    ],
  });

  return row;
}
module.exports = {
  async seedDefaultDocumentTypes(_req, res) {
    await ensureDefaultDocumentTypes();

    const rows = await HomologationDocumentType.findAll({
      where: {
        code: { [Op.notIn]: REMOVED_ATA_CODES },
      },
      order: [['sortOrder', 'ASC'], ['name', 'ASC']],
    });

    return ok(res, rows);
  },
async downloadApprovedRegistrationDocumentsZip(req, res) {
  try {
    const { registrationId } = req.params;

    const row = await findRegistrationWithRelationsOr404(registrationId);
    if (!row) return notFound(res, 'Cadastro não encontrado');

    const documents = await NeedRegistrationDocument.findAll({
      where: { registrationId: row.id },
      include: [
        {
          model: HomologationDocumentType,
          as: 'documentType',
          attributes: ['id', 'name', 'code'],
        },
      ],
      order: [['createdAt', 'ASC']],
    });

    if (!documents.length) {
      return notFound(res, 'Nenhum documento encontrado para este cadastro');
    }

    const safeName = String(row.fullName || row.company || `cadastro-${row.id}`)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '_');

    const archive = archiver('zip', { zlib: { level: 9 } });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="documentos_${safeName}.zip"`
    );

    archive.on('error', (err) => {
      console.error('Erro no ZIP:', err);
      if (!res.headersSent) {
        return res.status(500).json({ error: 'Erro ao gerar ZIP' });
      }
      res.end();
    });

    archive.pipe(res);

    let added = 0;

    // 🔥 FUNÇÃO CORRIGIDA (fora do loop)
    function resolveUploadFilePath(url) {
      let cleanUrl = String(url || '').trim();

      cleanUrl = cleanUrl.replace(/^https?:\/\/[^/]+/i, '');
      cleanUrl = cleanUrl.replace(/^\/api\//i, '/');
      cleanUrl = cleanUrl.replace(/^\/+/, '');

      if (!cleanUrl.startsWith('uploads/')) {
        cleanUrl = cleanUrl.replace(/^.*uploads\//i, 'uploads/');
      }

      return path.resolve(process.cwd(), cleanUrl);
    }

    // 🔥 LOOP CORRIGIDO
    for (const doc of documents) {
      if (!doc.url) continue;

      const absPath = resolveUploadFilePath(doc.url);

      console.log('ZIP arquivo:', {
        id: doc.id,
        url: doc.url,
        absPath,
        exists: fs.existsSync(absPath),
      });

      if (!fs.existsSync(absPath)) continue;

      const typeName = String(doc.documentType?.name || 'Documento')
        .replace(/[\\/:*?"<>|]/g, '-');

      const originalName = String(
        doc.originalName || doc.fileName || `documento-${doc.id}`
      ).replace(/[\\/:*?"<>|]/g, '-');

      archive.file(absPath, {
        name: `${typeName}/${originalName}`,
      });

      added++;
    }

    // 🔥 fallback caso não encontre arquivos
    if (!added) {
      archive.append(
        'Nenhum arquivo físico encontrado no servidor.\n\nVerifique os caminhos dos arquivos.',
        { name: 'aviso.txt' }
      );
    }

    await archive.finalize();
  } catch (error) {
    console.error('ERRO ZIP:', error);

    if (!res.headersSent) {
      return res.status(500).json({
        error: error.message || 'Erro ao baixar documentos em ZIP.',
      });
    }

    return res.end();
  }
},
  async listDocumentTypes(_req, res) {
    await ensureDefaultDocumentTypes();

    const rows = await HomologationDocumentType.findAll({
      where: {
        code: { [Op.notIn]: REMOVED_ATA_CODES },
      },
      order: [['sortOrder', 'ASC'], ['name', 'ASC']],
    });

    return ok(res, rows);
  },

  async createDocumentType(req, res) {
    const { error, value } = documentTypeSchema.validate(req.body, {
      stripUnknown: true,
    });
    if (error) return bad(res, error.message);

    if ([EXTRA_DOCUMENT_CODE, INTERNAL_DOCUMENT_CODE].includes(value.code)) {
      return bad(res, `O código ${value.code} é reservado pelo sistema`);
    }

    if (REMOVED_ATA_CODES.includes(value.code)) {
      return bad(res, `O código ${value.code} não pode mais ser usado`);
    }

    const exists = await HomologationDocumentType.findOne({
      where: { code: value.code },
    });
    if (exists) return bad(res, 'Já existe tipo de documento com esse code');

    const row = await HomologationDocumentType.create(value);
    return created(res, row);
  },
  
async listApprovedRegistrations(req, res) {
  try {
    const { page, limit } = normalizePagination(req.query);

    const all = await NeedRegistration.findAll({
      include: [
        {
          model: Need,
          as: 'need',
          attributes: [
            'id',
            'requestedName',
            'providerName',
            'requestedLocationText',
            'requestedCity',
            'requestedState',
            'requestedCep',
            'homologationStatus',
            'homologationReviewedAt',
          ],
        },
        {
          model: NeedRegistrationInvite,
          as: 'invite',
          attributes: [
            'id',
            'technicianName',
            'technicianEmail',
            'technicianPhone',
            'status',
            'openedAt',
            'usedAt',
            'lastSentAt',
            'expiresAt',
          ],
        },
        {
          model: User,
          as: 'reviewedBy',
          attributes: ['id', 'name', 'email'],
        },
        {
          model: NeedRegistrationDocument,
          as: 'documents',
          attributes: ['id', 'status'],
          required: false,
        },
      ],
      order: [['needId', 'ASC'], ['id', 'DESC']],
    });

    const map = new Map();

    for (const row of all) {
      if (!map.has(row.needId)) {
        map.set(row.needId, row);
      }
    }

    let rows = Array.from(map.values());

    if (req.query.q) {
      const q = String(req.query.q).trim().toLowerCase();
      rows = rows.filter((row) => {
        const j = row.toJSON();
        return [
          j.fullName,
          j.company,
          j.cpf,
          j.cnpj,
          j.email,
          j.phone,
        ]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
      });
    }

    if (req.query.city) {
      const city = String(req.query.city).trim().toLowerCase();
      rows = rows.filter((row) =>
        String(row.city || '').toLowerCase().includes(city)
      );
    }

    if (req.query.state) {
      const state = String(req.query.state).trim().toUpperCase();
      rows = rows.filter((row) =>
        String(row.state || '').toUpperCase() === state
      );
    }

    if (req.query.company) {
      const company = String(req.query.company).trim().toLowerCase();
      rows = rows.filter((row) =>
        String(row.company || '').toLowerCase().includes(company)
      );
    }

    const enriched = [];
    for (const row of rows) {
      let snapshot = null;
      if (typeof getRegistrationApprovalSnapshot === 'function') {
        snapshot = await getRegistrationApprovalSnapshot(row.id);
      }
      enriched.push(buildRegistrationSummary(row, snapshot));
    }

    const total = enriched.length;
    const offset = (page - 1) * limit;
    const paginated = enriched.slice(offset, offset + limit);

    return ok(res, {
      items: paginated,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    });
  } catch (error) {
    console.error('listApprovedRegistrations error:', error);
    return res.status(500).json({
      error: 'Erro ao listar prestadores aprovados.',
    });
  }
},

async getApprovedRegistrationDetail(req, res) {
  try {
    const { registrationId } = req.params;

    const registration = await NeedRegistration.findOne({
      where: {
        id: registrationId,
      },
      include: [
        {
          model: Need,
          as: 'need',
          attributes: [
            'id',
            'requestedName',
            'providerName',
            'providerWhatsapp',
            'requestedLocationText',
            'requestedCity',
            'requestedState',
            'requestedCep',
            'homologationStatus',
            'homologationReviewedAt',
          ],
        },
        {
          model: NeedRegistrationInvite,
          as: 'invite',
          attributes: [
            'id',
            'technicianName',
            'technicianEmail',
            'technicianPhone',
            'status',
            'openedAt',
            'usedAt',
            'lastSentAt',
            'expiresAt',
          ],
        },
        {
          model: User,
          as: 'reviewedBy',
          attributes: ['id', 'name', 'email'],
        },
        {
          model: NeedRegistrationDocument,
          as: 'documents',
          include: [
            {
              model: HomologationDocumentType,
              as: 'documentType',
              attributes: ['id', 'name', 'code', 'isRequired'],
            },
            {
              model: User,
              as: 'reviewedBy',
              attributes: ['id', 'name', 'email'],
            },
          ],
        },
      ],
      order: [[{ model: NeedRegistrationDocument, as: 'documents' }, 'createdAt', 'DESC']],
    });

    if (!registration) {
      return res.status(404).json({ error: 'Cadastro não encontrado.' });
    }

    const json = registration.toJSON();

    const requiredDocuments = (json.documents || []).filter(
      (doc) => doc.documentType?.isRequired
    );

    const additionalDocuments = (json.documents || []).filter(
      (doc) => !doc.documentType?.isRequired
    );

    const requiredTotal = requiredDocuments.length;
    const requiredApproved = requiredDocuments.filter(
      (doc) => doc.status === 'APPROVED'
    ).length;
    const requiredPending = Math.max(requiredTotal - requiredApproved, 0);

    return res.json({
      registration: {
        id: json.id,
        status: json.status,
        fullName: json.fullName,
        rg: json.rg,
        cpf: json.cpf,
        birthDate: json.birthDate,
        motherName: json.motherName,
        address: json.address,
        district: json.district,
        company: json.company,
        city: json.city,
        state: json.state,
        zipCode: json.zipCode,
        phone: json.phone,
        roleName: json.roleName,
        cnpj: json.cnpj,
        email: json.email,
        schedulingContactName: json.schedulingContactName,
        schedulingContactEmail: json.schedulingContactEmail,
        schedulingContactPhone: json.schedulingContactPhone,
        paymentContactName: json.paymentContactName,
        paymentContactEmail: json.paymentContactEmail,
        paymentContactPhone: json.paymentContactPhone,
        witnessName: json.witnessName,
        witnessCpf: json.witnessCpf,
        witnessEmail: json.witnessEmail,
        witnessPhone: json.witnessPhone,
        bankName: json.bankName,
        bankCode: json.bankCode,
        agency: json.agency,
        agencyDigit: json.agencyDigit,
        accountNumber: json.accountNumber,
        accountDigit: json.accountDigit,
        hasCltEmployees: json.hasCltEmployees,
        serviceOmnilinkWorkshop: json.serviceOmnilinkWorkshop,
        serviceLinkerWorkshop: json.serviceLinkerWorkshop,
        serviceOmnilinkExternal: json.serviceOmnilinkExternal,
        serviceLinkerExternal: json.serviceLinkerExternal,
        vehicleCar: json.vehicleCar,
        vehicleMoto: json.vehicleMoto,
        vehicleTruck: json.vehicleTruck,
        agreeTravel: json.agreeTravel,
        declarationAccepted: json.declarationAccepted,
        reviewNotes: json.reviewNotes,
        submittedAt: json.submittedAt,
        reviewedAt: json.reviewedAt,
        reviewedBy: json.reviewedBy || null,
      },
      invite: json.invite || null,
      need: json.need || null,
      documents: json.documents || [],
      requiredDocuments,
      additionalDocuments,
      progress: {
        requiredTotal,
        requiredApproved,
        requiredPending,
        additionalTotal: additionalDocuments.length,
        isFullyApproved:
          json.status === 'APPROVED' &&
          requiredTotal > 0 &&
          requiredApproved === requiredTotal,
      },
    });
  } catch (error) {
    console.error('getApprovedRegistrationDetail error:', error);
    return res.status(500).json({
      error: 'Erro ao carregar detalhes do cadastro.',
    });
  }
},

async listApprovedRegistrationDocuments(req, res) {
  const row = await findRegistrationWithRelationsOr404(req.params.registrationId);
  if (!row) return notFound(res, 'Cadastro não encontrado');

  const grouped = await getGroupedRegistrationDocuments(row.id);

  return ok(res, {
    registrationId: row.id,
    documents: grouped.documents.map((doc) => ({
      id: doc.id,
      registrationId: doc.registrationId,
      documentTypeId: doc.documentTypeId,
      typeName: doc.documentType?.name || null,
      typeCode: doc.documentType?.code || null,
      status: doc.status,
      originalName: doc.originalName,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
      size: doc.size,
      url: doc.url,
      notes: doc.notes,
      uploadedAt: doc.uploadedAt,
      reviewedAt: doc.reviewedAt,
      reviewedBy: doc.reviewedBy || null,
      canView: true,
      canDownload: true,
      viewUrl: `/api/need-homologation/approved/${row.id}/documents/${doc.id}/view`,
      downloadUrl: `/api/need-homologation/approved/${row.id}/documents/${doc.id}/download`,
    })),
  });
},

  async viewApprovedRegistrationDocument(req, res) {
    const row = await findRegistrationWithRelationsOr404(req.params.registrationId);
    if (!row) return notFound(res, 'Cadastro não encontrado');

    const document = await NeedRegistrationDocument.findOne({
      where: {
        id: req.params.documentId,
        registrationId: row.id,
      },
    });

    if (!document) return notFound(res, 'Documento não encontrado');

    const absPath = getAbsoluteUploadPathFromUrl(document.url);
    if (!fs.existsSync(absPath)) {
      return notFound(res, 'Arquivo não encontrado');
    }

    return res.sendFile(absPath);
  },

  async downloadApprovedRegistrationDocument(req, res) {
    const row = await findRegistrationWithRelationsOr404(req.params.registrationId);
    if (!row) return notFound(res, 'Cadastro não encontrado');

    const document = await NeedRegistrationDocument.findOne({
      where: {
        id: req.params.documentId,
        registrationId: row.id,
      },
    });

    if (!document) return notFound(res, 'Documento não encontrado');

    const absPath = getAbsoluteUploadPathFromUrl(document.url);
    if (!fs.existsSync(absPath)) {
      return notFound(res, 'Arquivo não encontrado');
    }

    return res.download(absPath, document.originalName || document.fileName);
  },

  async exportApprovedRegistrationsCsv(req, res) {
    const where = buildApprovedWhere(req.query);

    const rows = await NeedRegistration.findAll({
      where,
      include: [
        {
          model: Need,
          as: 'need',
          attributes: ['id', 'requestedName', 'requestedLocationText', 'requestedCity', 'requestedState'],
        },
        {
          model: NeedRegistrationInvite,
          as: 'invite',
          attributes: ['id', 'technicianName', 'technicianEmail', 'technicianPhone'],
        },
        {
          model: User,
          as: 'reviewedBy',
          attributes: ['id', 'name'],
        },
      ],
      order: [['reviewedAt', 'DESC'], ['id', 'DESC']],
    });

    const header = [
      'ID',
      'Nome',
      'Empresa',
      'CPF',
      'CNPJ',
      'Telefone',
      'E-mail',
      'Cidade',
      'UF',
      'Cargo',
      'Data Aprovacao',
      'Solicitacao',
      'Local Solicitado',
      'Cidade Solicitada',
      'UF Solicitada',
      'Revisado Por',
    ];

    const escapeCsv = (value) => {
      const str = value == null ? '' : String(value);
      return `"${str.replace(/"/g, '""')}"`;
    };

    const lines = rows.map((row) => {
      const json = row.toJSON();
      return [
        json.id,
        json.fullName,
        json.company,
        json.cpf,
        json.cnpj,
        json.phone,
        json.email,
        json.city,
        json.state,
        json.roleName,
        json.reviewedAt,
        json.need?.requestedName,
        json.need?.requestedLocationText,
        json.need?.requestedCity,
        json.need?.requestedState,
        json.reviewedBy?.name,
      ]
        .map(escapeCsv)
        .join(';');
    });

    const csv = [header.join(';'), ...lines].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="prestadores-aprovados.csv"');

    return res.send('\uFEFF' + csv);
  },
  
  async updateDocumentType(req, res) {
    const { error, value } = documentTypeSchema.validate(req.body, {
      stripUnknown: true,
    });
    if (error) return bad(res, error.message);

    const row = await HomologationDocumentType.findByPk(req.params.documentTypeId);
    if (!row) return notFound(res, 'Tipo de documento não encontrado');

    if (
      [EXTRA_DOCUMENT_CODE, INTERNAL_DOCUMENT_CODE].includes(row.code) ||
      [EXTRA_DOCUMENT_CODE, INTERNAL_DOCUMENT_CODE].includes(value.code)
    ) {
      return bad(res, `O código ${value.code} é reservado pelo sistema`);
    }

    if (REMOVED_ATA_CODES.includes(value.code)) {
      return bad(res, `O código ${value.code} não pode mais ser usado`);
    }

    const sameCode = await HomologationDocumentType.findOne({
      where: { code: value.code, id: { [Op.ne]: row.id } },
    });
    if (sameCode) return bad(res, 'Já existe tipo de documento com esse code');

    await row.update(value);
    return ok(res, row);
  },
  async uploadDocumentTypeTemplate(req, res) {
    const row = await HomologationDocumentType.findByPk(req.params.documentTypeId);
    if (!row) return notFound(res, 'Tipo de documento não encontrado');
    if (!req.file) return bad(res, 'Arquivo não enviado');

    const url = `/uploads/homologation/templates/${req.file.filename}`;
    await row.update({
      templateName: req.file.originalname,
      templateUrl: url,
    });

    return ok(res, row);
  },
  async sendToFinance(req, res) {
    try {
      const { needId } = req.params;
      const { to = [], cc = [], subject, message } = req.body;

      const need = await Need.findByPk(needId);
      if (!need) {
        return res.status(404).json({ error: 'Homologação não encontrada.' });
      }

      const snapshot = await getLatestRegistrationApprovalSnapshotByNeedId(need.id);
      const registration = snapshot.registration;

      if (!registration) {
        return res.status(400).json({ error: 'Cadastro do prestador não encontrado.' });
      }

      if (!snapshot.isFullyApproved) {
        return res.status(400).json({
          error: 'A homologação ainda não está 100% aprovada para envio ao financeiro.',
        });
      }

      const recipients = Array.isArray(to) ? to.filter(Boolean) : [];
      const copies = Array.isArray(cc) ? cc.filter(Boolean) : [];

      if (!recipients.length) {
        return res.status(400).json({
          error: 'Informe ao menos um destinatário.',
        });
      }

      await sendMail({
        to: recipients,
        cc: copies,
        subject:
          subject ||
          `Prestador aprovado para criação de código - ${
            registration.fullName || registration.company || 'Prestador'
          }`,
        html: `
          <p>Olá,</p>
          <p>O prestador abaixo foi homologado com sucesso.</p>
          <p>
            <b>Nome:</b> ${registration.fullName || '-'}<br/>
            <b>Empresa:</b> ${registration.company || '-'}<br/>
            <b>CPF:</b> ${registration.cpf || '-'}<br/>
            <b>CNPJ:</b> ${registration.cnpj || '-'}<br/>
            <b>Telefone:</b> ${registration.phone || '-'}<br/>
            <b>E-mail:</b> ${registration.email || '-'}<br/>
            <b>Cidade/UF:</b> ${registration.city || '-'} / ${registration.state || '-'}
          </p>
          <p>${message || ''}</p>
          <p>O prestador já se encontra na aba <b>Prestadores Ativos</b> com os dados completos.</p>
        `,
      });

      return res.json({
        ok: true,
        message: 'E-mail enviado ao financeiro com sucesso.',
      });
    } catch (error) {
      console.error('sendToFinance error:', error);
      return res.status(500).json({
        error: 'Erro ao enviar e-mail para o financeiro.',
      });
    }
  },
  async createInvite(req, res) {
    const { error, value } = createInviteSchema.validate(req.body, {
      stripUnknown: true,
    });
    if (error) return bad(res, error.message);

    const need = await Need.findByPk(req.params.needId);
    if (!need) return notFound(res, 'Prospecção não encontrada');

    await ensureDefaultDocumentTypes();

    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + value.expiresInDays);

    const invite = await NeedRegistrationInvite.create({
      needId: need.id,
      technicianName: value.technicianName,
      technicianEmail: value.technicianEmail || null,
      technicianPhone: value.technicianPhone || null,
      token,
      expiresAt,
      createdById: req.user?.id || null,
      lastSentAt: new Date(),
    });

    await need.update({
      homologationStatus: 'LINK_SENT',
      homologationLinkSentAt: new Date(),
      providerName: need.providerName || value.technicianName,
      providerWhatsapp: need.providerWhatsapp || value.technicianPhone || null,
    });

    return created(res, {
      invite,
      publicLink: buildPublicLink(token),
    });
  },
  async listInvites(req, res) {
    const need = await Need.findByPk(req.params.needId);
    if (!need) return notFound(res, 'Prospecção não encontrada');

    const rows = await NeedRegistrationInvite.findAll({
      where: { needId: need.id },
      include: [{ model: User, as: 'createdBy', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
    });

    return ok(
      res,
      rows.map((row) => ({
        ...row.toJSON(),
        publicLink: buildPublicLink(row.token),
        isExpired: isInviteExpired(row),
      }))
    );
  },

  async cancelInvite(req, res) {
    const row = await NeedRegistrationInvite.findOne({
      where: { id: req.params.inviteId, needId: req.params.needId },
    });
    if (!row) return notFound(res, 'Convite não encontrado');

    await row.update({ status: 'CANCELLED' });
    return ok(res, { ok: true });
  },
  async getInternalSummary(req, res) {
    const payload = await buildNeedSummaryPayload(req.params.needId);
    if (!payload) return notFound(res, 'Prospecção não encontrada');
    return ok(res, payload);
  },

  async publicOpen(req, res) {
    await ensureDefaultDocumentTypes();

    const { invite, blockedResponse } = await findValidInviteByToken(req.params.token);

    if (!invite) {
      return sendInviteUnavailable(res, null);
    }

    if (blockedResponse) {
      return sendInviteUnavailable(res, invite);
    }

    if (!invite.openedAt) {
      await invite.update({
        openedAt: new Date(),
        status: invite.status === 'PENDING' ? 'OPENED' : invite.status,
      });
    }

    const registration = await ensureRegistrationFromInvite(invite);
    const grouped = await getGroupedRegistrationDocuments(registration.id);

    const need = await Need.findByPk(invite.needId, {
      attributes: [
        'id',
        'requestedName',
        'providerName',
        'requestedLocationText',
        'homologationStatus',
      ],
    });

    return ok(res, {
      invite: {
        id: invite.id,
        technicianName: invite.technicianName,
        technicianEmail: invite.technicianEmail,
        technicianPhone: invite.technicianPhone,
        expiresAt: invite.expiresAt,
        status: invite.status,
      },
      need,
      registration,
      requiredDocumentTypes: grouped.requiredChecklist,
      additionalDocumentType: grouped.additionalDocumentType,
      additionalDocuments: grouped.additionalDocuments,
      documentTypes: grouped.documentTypes,
      documents: grouped.documents,
      progress: grouped.progress,
      config: {
        extraDocumentCode: EXTRA_DOCUMENT_CODE,
        extraLimit: MAX_EXTRA_FILES,
      },
    });
  },

  async publicSaveDraft(req, res) {
    const { error, value } = publicDraftSchema.validate(req.body, {
      stripUnknown: true,
    });
    if (error) return bad(res, error.message);

    const { invite, blockedResponse } = await findValidInviteByToken(req.params.token);

    if (!invite) {
      return sendInviteUnavailable(res, null);
    }

    if (blockedResponse) {
      return sendInviteUnavailable(res, invite);
    }

    const registration = await ensureRegistrationFromInvite(invite);

    await registration.update({
      ...value,
      status: registration.status === 'SUBMITTED' ? 'SUBMITTED' : 'DRAFT',
    });

    const need = await Need.findByPk(invite.needId);
    if (need && ['NOT_SENT', 'LINK_SENT'].includes(need.homologationStatus)) {
      await need.update({ homologationStatus: 'IN_PROGRESS' });
    }

    return ok(res, registration);
  },

  async publicUploadDocument(req, res) {
    await ensureDefaultDocumentTypes();

    const { invite, blockedResponse } = await findValidInviteByToken(req.params.token);

    if (!invite) {
      return sendInviteUnavailable(res, null);
    }

    if (blockedResponse) {
      return sendInviteUnavailable(res, invite);
    }

    if (!req.file) return bad(res, 'Arquivo não enviado');

    const registration = await ensureRegistrationFromInvite(invite);

      let documentType = null;
      const requestedTypeId = req.body.documentTypeId ? Number(req.body.documentTypeId) : null;
      const requestedCode = String(req.body.documentCode || '').trim();
      const isAdditional = String(req.body.isAdditional || '').toLowerCase() === 'true';

      if (isAdditional || requestedCode === EXTRA_DOCUMENT_CODE) {
        documentType = await HomologationDocumentType.findOne({
          where: { code: EXTRA_DOCUMENT_CODE },
        });
      } else if (requestedTypeId) {
        documentType = await HomologationDocumentType.findByPk(requestedTypeId);
      } else if (requestedCode) {
        documentType = await HomologationDocumentType.findOne({
          where: { code: requestedCode },
        });
      }

      if (!documentType || !documentType.active) {
        return bad(res, 'Tipo de documento inválido');
      }

      if (documentType.code === EXTRA_DOCUMENT_CODE) {
        const extrasCount = await NeedRegistrationDocument.count({
          where: {
            registrationId: registration.id,
            documentTypeId: documentType.id,
          },
        });

        if (extrasCount >= MAX_EXTRA_FILES) {
          return bad(res, `Limite de ${MAX_EXTRA_FILES} arquivos adicionais atingido`);
        }
      }

      if (!documentType.allowMultiple) {
        const previous = await NeedRegistrationDocument.findOne({
          where: {
            registrationId: registration.id,
            documentTypeId: documentType.id,
          },
          order: [['createdAt', 'DESC']],
        });

        if (previous) {
          try {
            const filePath = getAbsoluteUploadPathFromUrl(previous.url);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          } catch {}

          await previous.destroy();
        }
      }

      const row = await NeedRegistrationDocument.create({
        registrationId: registration.id,
        documentTypeId: documentType.id,
        originalName: req.file.originalname,
        fileName: req.file.filename,
        mimeType: req.file.mimetype,
        size: req.file.size,
        url: buildStoredUploadUrl(invite.token, req.file.filename),
        status: 'SENT',
        notes: req.body?.notes || null,
      });

      return created(res, row);
    },

    async publicDeleteDocument(req, res) {
      const { invite, blockedResponse } = await findValidInviteByToken(req.params.token);

      if (!invite) {
        return sendInviteUnavailable(res, null);
      }

      if (blockedResponse) {
        return sendInviteUnavailable(res, invite);
      }

      const registration = await ensureRegistrationFromInvite(invite);
      const row = await NeedRegistrationDocument.findOne({
        where: {
          id: req.params.documentId,
          registrationId: registration.id,
        },
        include: [{ model: HomologationDocumentType, as: 'documentType' }],
      });

      if (!row) return notFound(res, 'Documento não encontrado');

      try {
        const filePath = getAbsoluteUploadPathFromUrl(row.url);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch {}

      await row.destroy();
      return ok(res, { ok: true });
    },

  async publicSubmit(req, res) {
    await ensureDefaultDocumentTypes();

    const invite = await NeedRegistrationInvite.findOne({
      where: { token: req.params.token },
    });
    if (!invite) return notFound(res, 'Link não encontrado');
    if (invite.status === 'CANCELLED') return bad(res, 'Link cancelado');
    if (isInviteExpired(invite)) return bad(res, 'Link expirado');

    const registration = await ensureRegistrationFromInvite(invite);

    const requiredFields = [
      'fullName',
      'email',
      'phone',
      'rg',
      'cpf',
      'company',
      'cnpj',
      'birthDate',
      'motherName',
      'address',
      'district',
      'city',
      'state',
      'zipCode',
      'bankName',
      'bankCode',
      'agency',
      'agencyDigit',
      'accountNumber',
      'accountDigit',
    ];

    for (const field of requiredFields) {
      if (!String(registration[field] || '').trim()) {
        return bad(res, `Campo obrigatório não preenchido: ${field}`);
      }
    }

    const allDocumentTypes = await HomologationDocumentType.findAll({
      where: {
        active: true,
        code: {
          [Op.notIn]: [
            EXTRA_DOCUMENT_CODE,
            INTERNAL_DOCUMENT_CODE,
            ...REMOVED_ATA_CODES,
          ],
        },
      },
      order: [['sortOrder', 'ASC']],
    });

    const requiredCodes = new Set([
      'CNH',
      'CARTAO_CNPJ',
      'COMPROVANTE_RESIDENCIA',
      'CONTRATO_SOCIAL',
      'DOCUMENTO_VEICULO_1',
      'DOCUMENTO_VEICULO_2',
    ]);

    const hasVehicle =
      !!registration.vehicleCar ||
      !!registration.vehicleMoto ||
      !!registration.vehicleTruck;

    const hasWorkshop =
      !!registration.serviceOmnilinkWorkshop ||
      !!registration.serviceLinkerWorkshop;

    if (hasVehicle) {
      requiredCodes.add('FOTO_VEICULO_1');
      requiredCodes.add('FOTO_VEICULO_2');
    }

    if (hasWorkshop) {
      requiredCodes.add('FOTO_FACHADA');
      requiredCodes.add('FOTO_INTERIOR');
    }

    const requiredDocs = allDocumentTypes.filter((docType) =>
      requiredCodes.has(docType.code)
    );

    for (const docType of requiredDocs) {
      const count = await NeedRegistrationDocument.count({
        where: {
          registrationId: registration.id,
          documentTypeId: docType.id,
        },
      });

      if (!count) {
        return bad(res, `Documento obrigatório não enviado: ${docType.name}`);
      }
    }

    await registration.update({
      status: 'SUBMITTED',
      submittedAt: new Date(),
    });

    await invite.update({
      status: 'SUBMITTED',
      usedAt: new Date(),
    });

    await syncNeedHomologationStatus(invite.needId);

    return ok(res, {
      message: 'Cadastro enviado com sucesso',
      registration,
    });
  },

  async reviewDocument(req, res) {
    const row = await NeedRegistrationDocument.findByPk(req.params.documentId, {
      include: [{ model: NeedRegistration, as: 'registration' }],
    });
    if (!row) return notFound(res, 'Documento não encontrado');

    const { error, value } = reviewDocumentSchema.validate(req.body, {
      stripUnknown: true,
    });
    if (error) return bad(res, error.message);

    await row.update({
      status: value.status,
      notes: value.notes || null,
      reviewedAt: new Date(),
      reviewedById: req.user?.id || null,
    });

    await syncNeedHomologationStatus(row.registration.needId);

    return ok(res, row);
  },

    async uploadAdditionalDocument(req, res) {
    await ensureDefaultDocumentTypes();

    const need = await Need.findByPk(req.params.needId);
    if (!need) return notFound(res, 'Prospecção não encontrada');
    if (!req.file) return bad(res, 'Arquivo não enviado');

    let registration = await getLatestRegistrationByNeedId(need.id);

    if (!registration) {
      const invite = await NeedRegistrationInvite.findOne({
        where: { needId: need.id },
        order: [['id', 'DESC']],
      });

      if (!invite) {
        return bad(res, 'Nenhum cadastro vinculado');
      }

      registration = await ensureRegistrationFromInvite(invite);
    }

    const documentType = await HomologationDocumentType.findOne({
      where: {
        code: EXTRA_DOCUMENT_CODE,
        active: true,
      },
    });

    if (!documentType) {
      return bad(res, 'Tipo adicional não configurado');
    }

    const extrasCount = await NeedRegistrationDocument.count({
      where: {
        registrationId: registration.id,
        documentTypeId: documentType.id,
      },
    });

    if (extrasCount >= MAX_EXTRA_FILES) {
      return bad(res, `Limite de ${MAX_EXTRA_FILES} arquivos adicionais atingido`);
    }

    const row = await NeedRegistrationDocument.create({
      registrationId: registration.id,
      documentTypeId: documentType.id,
      originalName: req.file.originalname,
      fileName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      url: buildInternalStoredUploadUrl(need.id, req.file.filename),
      status: 'SENT',
      notes: req.body?.notes || null,
    });

    return created(res, row);
  },

  async uploadInternalDocument(req, res) {
    await ensureDefaultDocumentTypes();

    const need = await Need.findByPk(req.params.needId);
    if (!need) return notFound(res, 'Prospecção não encontrada');
    if (!req.file) return bad(res, 'Arquivo não enviado');

    let registration = await getLatestRegistrationByNeedId(need.id);

    if (!registration) {
      const invite = await NeedRegistrationInvite.findOne({
        where: { needId: need.id },
        order: [['id', 'DESC']],
      });

      if (!invite) {
        return bad(res, 'Nenhum cadastro vinculado');
      }

      registration = await ensureRegistrationFromInvite(invite);
    }

    const documentType = await HomologationDocumentType.findOne({
      where: {
        code: INTERNAL_DOCUMENT_CODE,
        active: true,
      },
    });

    if (!documentType) {
      return bad(res, 'Tipo interno não configurado');
    }

    const row = await NeedRegistrationDocument.create({
      registrationId: registration.id,
      documentTypeId: documentType.id,
      originalName: req.file.originalname,
      fileName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      url: buildInternalStoredUploadUrl(need.id, req.file.filename),
      status: 'SENT',
      notes: req.body?.notes || null,
    });

    return created(res, row);
  },

async reviewRegistration(req, res) {
  const requestedRegistrationId = Number(req.body?.registrationId || 0);

  let row = null;

  if (requestedRegistrationId) {
    row = await NeedRegistration.findOne({
      where: {
        id: requestedRegistrationId,
        needId: req.params.needId,
      },
    });
  }

  if (!row) {
    row = await NeedRegistration.findOne({
      where: { needId: req.params.needId },
      order: [['id', 'DESC']],
    });
  }

  if (!row) return notFound(res, 'Cadastro não encontrado');

  const { error, value } = reviewRegistrationSchema.validate(req.body, {
    stripUnknown: true,
  });
  if (error) return bad(res, error.message);

  const snapshot = await getRegistrationApprovalSnapshot(row.id);

  if (value.status === 'APPROVED') {
    if (snapshot.requiredTotal === 0) {
      return bad(res, 'Não é possível aprovar: nenhum documento obrigatório foi encontrado.');
    }

    if (snapshot.requiredApproved !== snapshot.requiredTotal) {
      return bad(
        res,
        `Não é possível aprovar: ${snapshot.requiredApproved}/${snapshot.requiredTotal} documentos obrigatórios aprovados.`
      );
    }
  }

  await row.update({
    status: value.status,
    reviewNotes: value.reviewNotes || null,
    reviewedAt: new Date(),
    reviewedById: req.user?.id || null,
  });

  await syncNeedHomologationStatus(row.needId);

  return ok(res, row);
},
async sendApprovedProviderToFinance(req, res) {
  try {
    const { registrationId } = req.params;
    const { to = [], cc = [], subject, message } = req.body;

    const snapshot = await getRegistrationApprovalSnapshot(registrationId);
    const registration = snapshot.registration;

    if (!registration || !snapshot.isFullyApproved) {
      return res.status(404).json({ error: 'Prestador aprovado não encontrado.' });
    }

    const recipients = Array.isArray(to) ? to.filter(Boolean) : [];
    const copies = Array.isArray(cc) ? cc.filter(Boolean) : [];

    if (!recipients.length) {
      return res.status(400).json({ error: 'Informe ao menos um destinatário.' });
    }

    await sendMail({
      to: recipients,
      cc: copies,
      subject,
      html: `
        <p>Olá,</p>

        <p>O prestador abaixo foi homologado com sucesso e já está disponível na aba <b>Prestadores Ativos</b>.</p>

        <p><b>Nome:</b> ${registration.fullName || '-'}<br/>
        <b>Empresa:</b> ${registration.company || '-'}<br/>
        <b>CPF:</b> ${registration.cpf || '-'}<br/>
        <b>CNPJ:</b> ${registration.cnpj || '-'}<br/>
        <b>Telefone:</b> ${registration.phone || '-'}<br/>
        <b>E-mail:</b> ${registration.email || '-'}<br/>
        <b>Cidade/UF:</b> ${registration.city || '-'} / ${registration.state || '-'}</p>

        <p>${message || ''}</p>

        <p>Favor seguir com a criação do código do prestador no sistema ERP.</p>
      `,
    });

    await registration.update({
      financeSentAt: new Date(),
      financeSentById: req.user?.id || null,
    });

    return res.json({
      ok: true,
      message: 'E-mail enviado ao financeiro com sucesso.',
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao enviar para o financeiro.' });
  }
},
  async resendInviteEmail(req, res) {
    const invite = await NeedRegistrationInvite.findByPk(req.params.inviteId);
    if (!invite) return notFound(res, 'Convite não encontrado');

    if (!invite.technicianEmail) {
      return bad(res, 'Este convite não possui e-mail cadastrado');
    }

    const publicLink = buildPublicLink(invite.token);

    await invite.update({
      lastSentAt: new Date(),
    });

    return ok(res, { ok: true, publicLink });
  },

  async deleteRegistrationDocument(req, res) {
    const row = await NeedRegistrationDocument.findByPk(req.params.documentId);
    if (!row) return notFound(res, 'Documento não encontrado');

    try {
      const filePath = getAbsoluteUploadPathFromUrl(row.url);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {}

    await row.destroy();
    return ok(res, { ok: true });
  },
};