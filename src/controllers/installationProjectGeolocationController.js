const { InstallationProject, Client } = require('../models');
const { ok, bad } = require('../utils/responses');

function toNumber(v) {
  if (v === null || v === undefined || v === '') return null;

  const value = String(v).replace(',', '.').trim();
  const n = Number(value);

  return Number.isFinite(n) ? n : null;
}

function normalizeUF(uf) {
  if (!uf) return '';

  const value = String(uf).toUpperCase().trim();

  const aliases = {
    SA: 'SP',
  };

  return aliases[value] || value;
}

function isMissing(lat, lng) {
  return lat == null || lng == null;
}

function isInvalid(lat, lng) {
  return (
    lat === 0 ||
    lng === 0 ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  );
}

async function audit(req, res) {
  try {
    const projects = await InstallationProject.findAll({
      include: [
        {
          model: Client,
          as: 'client',
          required: false,
        },
      ],
      order: [['id', 'DESC']],
    });

    const result = {
      summary: {
        total: projects.length,
        valid: 0,
        missing: 0,
        invalid: 0,
      },
      valid: [],
      missing: [],
      invalid: [],
    };

    for (const p of projects) {
      const client = p.client;

      const lat = toNumber(p.requestedLat);
      const lng = toNumber(p.requestedLng);

      const row = {
        projectId: p.id,
        title: p.title,

        clientId: client?.id || null,
        clientName: client?.name || null,

        city: p.requestedCity || '',
        uf: normalizeUF(p.requestedState),

        lat,
        lng,

        locationText: p.requestedLocationText || '',
        cep: p.requestedCep || '',

        source: 'project',
      };

      if (isMissing(lat, lng)) {
        result.summary.missing++;
        result.missing.push({
          ...row,
          reason: 'SEM_COORDENADA_NO_PROJETO',
        });
        continue;
      }

      if (isInvalid(lat, lng)) {
        result.summary.invalid++;
        result.invalid.push({
          ...row,
          reason: 'COORDENADA_INVALIDA_NO_PROJETO',
        });
        continue;
      }

      result.summary.valid++;
      result.valid.push(row);
    }

    return ok(res, result);
  } catch (err) {
    console.error('[installationProjectGeolocation.audit]', err);
    return bad(res, 'Erro ao auditar geolocalização');
  }
}

module.exports = {
  audit,
};