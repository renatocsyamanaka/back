const Joi = require('joi');
const fs = require('fs');
const path = require('path');

const {
  Need,
  TechType,
  User,
  AtaRegistration,
  AtaDocument,
} = require('../models');

const { ok, created, bad, notFound } = require('../utils/responses');

const ataProfileSchema = Joi.object({
  fullName: Joi.string().min(3).max(180).required(),
  cpf: Joi.string().min(11).max(30).required(),
  rg: Joi.string().min(3).max(80).required(),
  address: Joi.string().min(5).max(255).required(),
  email: Joi.string().email().required(),
}).required();

const ataReviewSchema = Joi.object({
  status: Joi.string()
    .valid('UNDER_REVIEW', 'APPROVED', 'REJECTED', 'ADJUSTMENT_REQUIRED')
    .required(),
  reviewNotes: Joi.string().allow('', null),
}).required();

function logSqlError(err, label = 'Erro SQL ATA') {
  console.error(`\n[${label}]`);
  console.error('MESSAGE:', err?.message);
  if (err?.parent?.sqlMessage) console.error('SQL MESSAGE:', err.parent.sqlMessage);
  if (err?.parent?.code) console.error('SQL CODE:', err.parent.code);
  if (err?.parent?.errno) console.error('SQL ERRNO:', err.parent.errno);
  if (err?.sql) console.error('SQL:', err.sql);
  console.error(err);
}

function getAbsoluteUploadPathFromUrl(url) {
  const rel = String(url || '').replace(/^\/+/, '');
  return path.resolve(process.cwd(), rel);
}

function buildAtaStoredUploadUrl(fileName) {
  return `/uploads/homologation/ata/${fileName}`;
}

async function findNeedOr404(needId) {
  return Need.findByPk(needId, {
    include: [{ model: TechType, as: 'techType' }],
  });
}

function isAtaNeed(need) {
  const techName = String(need?.techType?.name || '').trim().toUpperCase();
  return techName === 'ATA' || techName.includes('ATA');
}

async function ensureAtaNeed(needId) {
  const need = await findNeedOr404(needId);

  if (!need) return { error: 'Solicitação não encontrada' };
  if (!isAtaNeed(need)) return { error: 'Esta solicitação não é do tipo ATA' };

  return { need };
}

async function ensureAtaRegistration(need) {
  let registration = await AtaRegistration.findOne({
    where: { needId: need.id },
  });

  if (!registration) {
    registration = await AtaRegistration.create({
      needId: need.id,
      status: 'DRAFT',
      fullName: need.providerName || need.requestedName || null,
      address: need.requestedLocationText || null,
      email: null,
      cpf: null,
      rg: null,
    });
  }

  return registration;
}

async function syncAtaNeedStatus(needId) {
  const need = await Need.findByPk(needId);
  if (!need) return;

  const registration = await AtaRegistration.findOne({
    where: { needId },
  });

  if (!registration) {
    await need.update({
      homologationStatus: 'NOT_SENT',
      homologationSubmittedAt: null,
      homologationReviewedAt: null,
      homologationReviewedById: null,
    });
    return;
  }

  if (registration.status === 'APPROVED') {
    await need.update({
      homologationStatus: 'APPROVED',
      homologationSubmittedAt: registration.submittedAt || null,
      homologationReviewedAt: registration.reviewedAt || new Date(),
      homologationReviewedById: registration.reviewedById || null,
    });
    return;
  }

  if (registration.status === 'REJECTED') {
    await need.update({
      homologationStatus: 'REJECTED',
      homologationSubmittedAt: registration.submittedAt || null,
      homologationReviewedAt: registration.reviewedAt || new Date(),
      homologationReviewedById: registration.reviewedById || null,
    });
    return;
  }

  if (registration.status === 'ADJUSTMENT_REQUIRED') {
    await need.update({
      homologationStatus: 'ADJUSTMENT_REQUIRED',
      homologationSubmittedAt: registration.submittedAt || null,
      homologationReviewedAt: registration.reviewedAt || new Date(),
      homologationReviewedById: registration.reviewedById || null,
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
  });
}

async function buildAtaSummary(needId) {
  const need = await Need.findByPk(needId, {
    include: [
      { model: TechType, as: 'techType' },
      {
        model: AtaRegistration,
        as: 'ataRegistration',
        include: [{ model: User, as: 'reviewedBy', attributes: ['id', 'name'] }],
      },
    ],
  });

  if (!need) return null;

  const registration = need.ataRegistration || (await ensureAtaRegistration(need));

  const docs = await AtaDocument.findAll({
    where: { ataRegistrationId: registration.id },
    include: [{ model: User, as: 'reviewedBy', attributes: ['id', 'name'] }],
    order: [['createdAt', 'DESC']],
  });

  const latestDocument = docs[0] || null;

  return {
    need,
    registration,
    document: latestDocument,
    documents: docs,
    progress: {
      profileComplete: !!(
        registration.fullName &&
        registration.cpf &&
        registration.rg &&
        registration.address &&
        registration.email
      ),
      documentSent: !!latestDocument,
      documentApproved: latestDocument?.status === 'APPROVED',
    },
  };
}

module.exports = {
async getAtaSummary(req, res) {
  try {

    const { need, error } = await ensureAtaNeed(req.params.needId);
    if (error) {
      if (error === 'Solicitação não encontrada') return notFound(res, error);
      return bad(res, error);
    }

    const summary = await buildAtaSummary(need.id);

    return ok(res, summary);
  } catch (err) {
    return bad(res, err?.message || 'Erro ao carregar resumo ATA');
  }
},

  async saveAtaProfile(req, res) {
    try {
      const { need, error } = await ensureAtaNeed(req.params.needId);
      if (error) {
        if (error === 'Solicitação não encontrada') return notFound(res, error);
        return bad(res, error);
      }

      const { error: validationError, value } = ataProfileSchema.validate(req.body, {
        stripUnknown: true,
      });

      if (validationError) return bad(res, validationError.message);

      const registration = await ensureAtaRegistration(need);

      await registration.update({
        fullName: value.fullName,
        cpf: value.cpf,
        rg: value.rg,
        address: value.address,
        email: value.email,
        status:
          registration.status === 'SUBMITTED' ||
          registration.status === 'UNDER_REVIEW' ||
          registration.status === 'APPROVED'
            ? registration.status
            : 'DRAFT',
      });

      await need.update({
        providerName: value.fullName || need.providerName,
        requestedLocationText: value.address || need.requestedLocationText,
        homologationStatus: 'IN_PROGRESS',
      });

      await syncAtaNeedStatus(need.id);

      return ok(res, registration);
    } catch (err) {
      logSqlError(err, 'saveAtaProfile');
      return bad(res, 'Erro ao salvar perfil ATA');
    }
  },

  async uploadAtaDocument(req, res) {
    try {
      const { need, error } = await ensureAtaNeed(req.params.needId);
      if (error) {
        if (error === 'Solicitação não encontrada') return notFound(res, error);
        return bad(res, error);
      }

      if (!req.file) return bad(res, 'Arquivo não enviado');

      const registration = await ensureAtaRegistration(need);

      const previous = await AtaDocument.findOne({
        where: { ataRegistrationId: registration.id },
        order: [['createdAt', 'DESC']],
      });

      if (previous) {
        try {
          const prevFilePath = getAbsoluteUploadPathFromUrl(previous.url);
          if (fs.existsSync(prevFilePath)) fs.unlinkSync(prevFilePath);
        } catch {}

        await previous.destroy();
      }

      const row = await AtaDocument.create({
        ataRegistrationId: registration.id,
        status: 'SENT',
        originalName: req.file.originalname,
        fileName: req.file.filename,
        mimeType: req.file.mimetype,
        size: req.file.size,
        url: buildAtaStoredUploadUrl(req.file.filename),
        notes: req.body?.notes || null,
      });

      await syncAtaNeedStatus(need.id);

      return created(res, row);
    } catch (err) {
      logSqlError(err, 'uploadAtaDocument');
      return bad(res, 'Erro ao enviar documento ATA');
    }
  },

  async deleteAtaDocument(req, res) {
    try {
      const { need, error } = await ensureAtaNeed(req.params.needId);
      if (error) {
        if (error === 'Solicitação não encontrada') return notFound(res, error);
        return bad(res, error);
      }

      const registration = await ensureAtaRegistration(need);

      const row = await AtaDocument.findOne({
        where: {
          id: req.params.documentId,
          ataRegistrationId: registration.id,
        },
      });

      if (!row) return notFound(res, 'Documento não encontrado');

      try {
        const filePath = getAbsoluteUploadPathFromUrl(row.url);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch {}

      await row.destroy();
      await syncAtaNeedStatus(need.id);

      return ok(res, { ok: true });
    } catch (err) {
      logSqlError(err, 'deleteAtaDocument');
      return bad(res, 'Erro ao excluir documento ATA');
    }
  },

  async submitAta(req, res) {
    try {
      const { need, error } = await ensureAtaNeed(req.params.needId);
      if (error) {
        if (error === 'Solicitação não encontrada') return notFound(res, error);
        return bad(res, error);
      }

      const registration = await ensureAtaRegistration(need);

      const requiredFields = [
        { key: 'fullName', label: 'Nome' },
        { key: 'cpf', label: 'CPF' },
        { key: 'rg', label: 'RG' },
        { key: 'address', label: 'Endereço' },
        { key: 'email', label: 'E-mail' },
      ];

      for (const field of requiredFields) {
        if (!String(registration[field.key] || '').trim()) {
          return bad(res, `Campo obrigatório não preenchido: ${field.label}`);
        }
      }

      const document = await AtaDocument.findOne({
        where: { ataRegistrationId: registration.id },
        order: [['createdAt', 'DESC']],
      });

      if (!document) {
        return bad(res, 'Documento obrigatório não enviado: Ficha cadastral ATA');
      }

      await registration.update({
        status: 'SUBMITTED',
        submittedAt: new Date(),
      });

      await syncAtaNeedStatus(need.id);

      return ok(res, {
        message: 'Cadastro ATA enviado para análise com sucesso',
        registration,
      });
    } catch (err) {
      logSqlError(err, 'submitAta');
      return bad(res, 'Erro ao enviar ATA para análise');
    }
  },

  async reviewAta(req, res) {
    try {
      const { need, error } = await ensureAtaNeed(req.params.needId);
      if (error) {
        if (error === 'Solicitação não encontrada') return notFound(res, error);
        return bad(res, error);
      }

      const { error: validationError, value } = ataReviewSchema.validate(req.body, {
        stripUnknown: true,
      });

      if (validationError) return bad(res, validationError.message);

      const registration = await ensureAtaRegistration(need);

      await registration.update({
        status: value.status,
        reviewNotes: value.reviewNotes || null,
        reviewedAt: new Date(),
        reviewedById: req.user?.id || null,
      });

      const document = await AtaDocument.findOne({
        where: { ataRegistrationId: registration.id },
        order: [['createdAt', 'DESC']],
      });

      if (document) {
        if (value.status === 'APPROVED') {
          await document.update({
            status: 'APPROVED',
            reviewedAt: new Date(),
            reviewedById: req.user?.id || null,
          });
        }

        if (value.status === 'REJECTED' || value.status === 'ADJUSTMENT_REQUIRED') {
          await document.update({
            status: 'REJECTED',
            reviewedAt: new Date(),
            reviewedById: req.user?.id || null,
            notes: value.reviewNotes || document.notes || null,
          });
        }
      }

      await syncAtaNeedStatus(need.id);

      return ok(res, registration);
    } catch (err) {
      logSqlError(err, 'reviewAta');
      return bad(res, 'Erro ao revisar ATA');
    }
  },
};