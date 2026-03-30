const {
  InstallationProject,
  Client,
} = require('../models');

const { ok, bad } = require('../utils/responses');

// ========================================
// Helpers
// ========================================

function toNumber(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
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

// ========================================
// BASE DE COORDENADAS (principais cidades)
// ========================================

const CITY_COORDS = {
  'OSASCO__SP': { lat: -23.5329, lng: -46.7916 },
  'GUARULHOS__SP': { lat: -23.4538, lng: -46.5333 },
  'SAO PAULO__SP': { lat: -23.5505, lng: -46.6333 },
  'MANAUS__AM': { lat: -3.1190, lng: -60.0217 },
  'PORTO VELHO__RO': { lat: -8.7619, lng: -63.9039 },
  'TUPA__SP': { lat: -21.9347, lng: -50.5136 },
};

// ========================================
// 1. AUDITORIA
// ========================================

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

      const lat = toNumber(client?.latitude);
      const lng = toNumber(client?.longitude);

      const row = {
        projectId: p.id,
        title: p.title,
        clientId: client?.id,
        clientName: client?.name,
        city: client?.cidade || '',
        uf: normalizeUF(client?.estado),
        lat,
        lng,
      };

      if (isMissing(lat, lng)) {
        result.summary.missing++;
        result.missing.push(row);
        continue;
      }

      if (isInvalid(lat, lng)) {
        result.summary.invalid++;
        result.invalid.push({
          ...row,
          reason: 'COORDENADA_INVALIDA',
        });
        continue;
      }

      result.summary.valid++;
      result.valid.push(row);
    }

    return ok(res, result);
  } catch (err) {
    console.error(err);
    return bad(res, 'Erro ao auditar geolocalização');
  }
}

// ========================================
// 2. AUTO PREENCHIMENTO
// ========================================

async function fillMissing(req, res) {
  try {
    const projects = await InstallationProject.findAll({
      include: [
        {
          model: Client,
          as: 'client',
          required: false,
        },
      ],
    });

    let updated = 0;
    let skipped = 0;

    for (const p of projects) {
      const client = p.client;
      if (!client) continue;

      const lat = toNumber(client.latitude);
      const lng = toNumber(client.longitude);

      // já tem coordenada válida → pula
      if (!isMissing(lat, lng) && !isInvalid(lat, lng)) {
        skipped++;
        continue;
      }

      const city = String(client.cidade || '').toUpperCase().trim();
      const uf = normalizeUF(client.estado);

      const key = `${city}__${uf}`;

      const coords = CITY_COORDS[key];

      if (!coords) {
        skipped++;
        continue;
      }

      // atualiza cliente
      await client.update({
        latitude: coords.lat,
        longitude: coords.lng,
      });

      updated++;
    }

    return ok(res, {
      updated,
      skipped,
      message: 'Coordenadas preenchidas automaticamente',
    });
  } catch (err) {
    console.error(err);
    return bad(res, 'Erro ao preencher coordenadas');
  }
}

module.exports = {
  audit,
  fillMissing,
};