const Joi = require('joi');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');

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
const MAX_EXTRA_FILES = 5;

const DEFAULT_REQUIRED_DOCUMENTS = [
  {
    name: 'Ficha de Registro Técnico',
    code: 'FICHA_REGISTRO_TECNICO',
    description: 'Documento obrigatório para cadastro do técnico.',
    isRequired: true,
    allowMultiple: false,
    sortOrder: 10,
  },
  {
    name: 'Dados Cadastrais',
    code: 'DADOS_CADASTRAIS',
    description: 'Ficha com os dados cadastrais do prestador.',
    isRequired: true,
    allowMultiple: false,
    sortOrder: 20,
  },
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
    description: 'Fotos ou documentos extras opcionais, limitados a 5 arquivos.',
    isRequired: false,
    allowMultiple: true,
    sortOrder: 999,
  },
];

function buildPublicLink(token) {
  const base = process.env.TECHNICIAN_PUBLIC_BASE_URL || 'http://localhost:5173';
  return `${base.replace(/\/+$/, '')}/cadastro-tecnico/${token}`;
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

async function ensureDefaultDocumentTypes() {
  for (const item of DEFAULT_REQUIRED_DOCUMENTS) {
    await HomologationDocumentType.findOrCreate({
      where: { code: item.code },
      defaults: item,
    });
  }
}

async function ensureRegistrationFromInvite(invite) {
  let registration = await NeedRegistration.findOne({ where: { inviteId: invite.id } });

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

  const registration = await NeedRegistration.findOne({
    where: { needId },
    include: [
      {
        model: NeedRegistrationDocument,
        as: 'documents',
        include: [{ model: HomologationDocumentType, as: 'documentType' }],
      },
    ],
  });

  if (!registration) {
    await need.update({ homologationStatus: need.homologationLinkSentAt ? 'LINK_SENT' : 'NOT_SENT' });
    return;
  }

  if (registration.status === 'APPROVED') {
    await need.update({
      homologationStatus: 'APPROVED',
      homologationReviewedAt: registration.reviewedAt || new Date(),
      homologationReviewedById: registration.reviewedById || null,
    });
    return;
  }

  if (registration.status === 'REJECTED') {
    await need.update({
      homologationStatus: 'REJECTED',
      homologationReviewedAt: registration.reviewedAt || new Date(),
      homologationReviewedById: registration.reviewedById || null,
    });
    return;
  }

  if (registration.status === 'ADJUSTMENT_REQUIRED') {
    await need.update({
      homologationStatus: 'ADJUSTMENT_REQUIRED',
      homologationReviewedAt: registration.reviewedAt || new Date(),
      homologationReviewedById: registration.reviewedById || null,
    });
    return;
  }

  if (registration.status === 'UNDER_REVIEW') {
    await need.update({
      homologationStatus: 'UNDER_REVIEW',
      homologationSubmittedAt: registration.submittedAt || null,
    });
    return;
  }

  if (registration.status === 'SUBMITTED') {
    await need.update({
      homologationStatus: 'SUBMITTED',
      homologationSubmittedAt: registration.submittedAt || null,
    });
    return;
  }

  await need.update({ homologationStatus: 'IN_PROGRESS' });
}

async function getGroupedRegistrationDocuments(registrationId) {
  const documentTypes = await HomologationDocumentType.findAll({
    where: { active: true },
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

  const requiredDocumentTypes = documentTypes.filter(
    (docType) => docType.isRequired && docType.code !== EXTRA_DOCUMENT_CODE
  );

  const additionalDocumentType =
    documentTypes.find((docType) => docType.code === EXTRA_DOCUMENT_CODE) || null;

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
      allowMultiple: false,
      sentCount: docs.length,
      latestStatus: latestDocument?.status || 'PENDING',
      latestDocument,
      documents: docs,
    };
  });

  const additionalDocuments = additionalDocumentType
    ? documents.filter((doc) => doc.documentTypeId === additionalDocumentType.id)
    : [];

  const requiredTotal = requiredChecklist.length;
  const requiredSent = requiredChecklist.filter((item) => item.sentCount > 0).length;
  const requiredApproved = requiredChecklist.filter((item) => item.latestStatus === 'APPROVED').length;

  return {
    documentTypes,
    documents,
    requiredChecklist,
    additionalDocumentType,
    additionalDocuments,
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
  status: Joi.string().valid('UNDER_REVIEW', 'ADJUSTMENT_REQUIRED', 'APPROVED', 'REJECTED').required(),
  reviewNotes: Joi.string().allow('', null),
}).required();

module.exports = {
  async seedDefaultDocumentTypes(_req, res) {
    await ensureDefaultDocumentTypes();

    const rows = await HomologationDocumentType.findAll({
      order: [['sortOrder', 'ASC'], ['name', 'ASC']],
    });

    return ok(res, rows);
  },

  async listDocumentTypes(_req, res) {
    await ensureDefaultDocumentTypes();

    const rows = await HomologationDocumentType.findAll({
      order: [['sortOrder', 'ASC'], ['name', 'ASC']],
    });

    return ok(res, rows);
  },

  async createDocumentType(req, res) {
    const { error, value } = documentTypeSchema.validate(req.body, { stripUnknown: true });
    if (error) return bad(res, error.message);

    if (value.code === EXTRA_DOCUMENT_CODE) {
      return bad(res, `O código ${EXTRA_DOCUMENT_CODE} é reservado pelo sistema`);
    }

    const exists = await HomologationDocumentType.findOne({ where: { code: value.code } });
    if (exists) return bad(res, 'Já existe tipo de documento com esse code');

    const row = await HomologationDocumentType.create(value);
    return created(res, row);
  },

  async updateDocumentType(req, res) {
    const { error, value } = documentTypeSchema.validate(req.body, { stripUnknown: true });
    if (error) return bad(res, error.message);

    const row = await HomologationDocumentType.findByPk(req.params.documentTypeId);
    if (!row) return notFound(res, 'Tipo de documento não encontrado');

    if (row.code === EXTRA_DOCUMENT_CODE || value.code === EXTRA_DOCUMENT_CODE) {
      return bad(res, `O código ${EXTRA_DOCUMENT_CODE} é reservado pelo sistema`);
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

  async createInvite(req, res) {
    const { error, value } = createInviteSchema.validate(req.body, { stripUnknown: true });
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
    await ensureDefaultDocumentTypes();

    const need = await Need.findByPk(req.params.needId, {
      include: [
        {
          model: NeedRegistrationInvite,
          as: 'registrationInvites',
          include: [{ model: User, as: 'createdBy', attributes: ['id', 'name'] }],
        },
        {
          model: NeedRegistration,
          as: 'registration',
          include: [
            { model: User, as: 'reviewedBy', attributes: ['id', 'name'] },
            {
              model: NeedRegistrationInvite,
              as: 'invite',
              attributes: [
                'id',
                'token',
                'technicianName',
                'technicianEmail',
                'technicianPhone',
                'status',
                'expiresAt',
              ],
            },
          ],
        },
      ],
      order: [[{ model: NeedRegistrationInvite, as: 'registrationInvites' }, 'createdAt', 'DESC']],
    });

    if (!need) return notFound(res, 'Prospecção não encontrada');

    const registration = need.registration;
    const grouped = registration
      ? await getGroupedRegistrationDocuments(registration.id)
      : {
          documentTypes: await HomologationDocumentType.findAll({
            where: { active: true },
            order: [['sortOrder', 'ASC'], ['name', 'ASC']],
          }),
          documents: [],
          requiredChecklist: [],
          additionalDocumentType: null,
          additionalDocuments: [],
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

    return ok(res, {
      need,
      requiredChecklist: grouped.requiredChecklist,
      additionalDocumentType: grouped.additionalDocumentType,
      additionalDocuments: grouped.additionalDocuments,
      documentTypes: grouped.documentTypes,
      documents: grouped.documents,
      progress: grouped.progress,
    });
  },

  async publicOpen(req, res) {
    await ensureDefaultDocumentTypes();

    const invite = await NeedRegistrationInvite.findOne({ where: { token: req.params.token } });
    if (!invite) return notFound(res, 'Link não encontrado');

    if (invite.status === 'CANCELLED') return bad(res, 'Link cancelado');
    if (isInviteExpired(invite)) {
      if (invite.status !== 'EXPIRED') await invite.update({ status: 'EXPIRED' });
      return bad(res, 'Link expirado');
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
      attributes: ['id', 'requestedName', 'providerName', 'requestedLocationText', 'homologationStatus'],
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
    const { error, value } = publicDraftSchema.validate(req.body, { stripUnknown: true });
    if (error) return bad(res, error.message);

    const invite = await NeedRegistrationInvite.findOne({ where: { token: req.params.token } });
    if (!invite) return notFound(res, 'Link não encontrado');
    if (invite.status === 'CANCELLED') return bad(res, 'Link cancelado');
    if (isInviteExpired(invite)) return bad(res, 'Link expirado');

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

    const invite = await NeedRegistrationInvite.findOne({ where: { token: req.params.token } });
    if (!invite) return notFound(res, 'Link não encontrado');
    if (invite.status === 'CANCELLED') return bad(res, 'Link cancelado');
    if (isInviteExpired(invite)) return bad(res, 'Link expirado');
    if (!req.file) return bad(res, 'Arquivo não enviado');

    const registration = await ensureRegistrationFromInvite(invite);

    let documentType = null;
    const requestedTypeId = req.body.documentTypeId ? Number(req.body.documentTypeId) : null;
    const requestedCode = String(req.body.documentCode || '').trim();
    const isAdditional = String(req.body.isAdditional || '').toLowerCase() === 'true';

    if (isAdditional || requestedCode === EXTRA_DOCUMENT_CODE) {
      documentType = await HomologationDocumentType.findOne({ where: { code: EXTRA_DOCUMENT_CODE } });
    } else if (requestedTypeId) {
      documentType = await HomologationDocumentType.findByPk(requestedTypeId);
    } else if (requestedCode) {
      documentType = await HomologationDocumentType.findOne({ where: { code: requestedCode } });
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
    const invite = await NeedRegistrationInvite.findOne({ where: { token: req.params.token } });
    if (!invite) return notFound(res, 'Link não encontrado');
    if (invite.status === 'CANCELLED') return bad(res, 'Link cancelado');
    if (isInviteExpired(invite)) return bad(res, 'Link expirado');

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

    const invite = await NeedRegistrationInvite.findOne({ where: { token: req.params.token } });
    if (!invite) return notFound(res, 'Link não encontrado');
    if (invite.status === 'CANCELLED') return bad(res, 'Link cancelado');
    if (isInviteExpired(invite)) return bad(res, 'Link expirado');

    const registration = await ensureRegistrationFromInvite(invite);

    const requiredFields = [
      'fullName',
      'cpf',
      'birthDate',
      'motherName',
      'address',
      'district',
      'city',
      'state',
      'zipCode',
      'phone',
    ];

    for (const field of requiredFields) {
      if (!registration[field]) {
        return bad(res, `Campo obrigatório não preenchido: ${field}`);
      }
    }

    const documentTypes = await HomologationDocumentType.findAll({
      where: {
        active: true,
        isRequired: true,
        code: { [Op.ne]: EXTRA_DOCUMENT_CODE },
      },
      order: [['sortOrder', 'ASC']],
    });

    for (const docType of documentTypes) {
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

    const { error, value } = reviewDocumentSchema.validate(req.body, { stripUnknown: true });
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

  async reviewRegistration(req, res) {
    const row = await NeedRegistration.findOne({ where: { needId: req.params.needId } });
    if (!row) return notFound(res, 'Cadastro não encontrado');

    const { error, value } = reviewRegistrationSchema.validate(req.body, { stripUnknown: true });
    if (error) return bad(res, error.message);

    await row.update({
      status: value.status,
      reviewNotes: value.reviewNotes || null,
      reviewedAt: new Date(),
      reviewedById: req.user?.id || null,
    });

    await syncNeedHomologationStatus(row.needId);

    return ok(res, row);
  },
  async resendInviteEmail(req, res) {
    const invite = await NeedRegistrationInvite.findByPk(req.params.inviteId);
    if (!invite) return notFound(res, 'Convite não encontrado');

    if (!invite.technicianEmail) {
      return bad(res, 'Este convite não possui e-mail cadastrado');
    }

    const publicLink = buildPublicLink(invite.token);

    // aqui entra seu serviço de e-mail
    // await sendMail({...})

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