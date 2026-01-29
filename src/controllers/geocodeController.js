const Joi = require('joi');
const { ok, bad } = require('../utils/responses');

// node-fetch (ESM) via import dinâmico para manter compat com CommonJS
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const headers = {
  // Nominatim exige User-Agent identificável
  'User-Agent': 'operacoes-app/1.0 (geocode)',
  'Accept': 'application/json',
  // opcional: forçar pt-BR nos resultados
  'Accept-Language': 'pt-BR,pt;q=0.9',
};

// ---------- helpers ----------

// tenta pegar UF real via ISO3166-2 retornado pelo Nominatim
function getUF(address = {}) {
  const iso =
    address['ISO3166-2-lvl4'] ||
    address['ISO3166-2-lvl6'] ||
    address['ISO3166-2-lvl8'] ||
    null;

  if (iso) {
    const m = /^BR-(..)$/.exec(String(iso).toUpperCase());
    if (m) return m[1]; // SP, RJ...
  }

  // alguns retornos vêm com state_code
  if (address.state_code && String(address.state_code).length === 2) {
    return String(address.state_code).toUpperCase();
  }

  // NÃO usar slice(0,2) do "São Paulo" (isso gera "SÃ")
  return null;
}

function getCity(address = {}) {
  return (
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.county ||
    null
  );
}

function getDistrict(address = {}) {
  return (
    address.suburb ||
    address.neighbourhood ||
    address.quarter ||
    address.city_district ||
    null
  );
}

function getStreet(address = {}) {
  return (
    address.road ||
    address.pedestrian ||
    address.footway ||
    address.highway ||
    address.residential ||
    null
  );
}

// mantém sua assinatura antiga, mas sem gerar UF quebrada
function pickCityStateCep(address = {}) {
  const city = getCity(address);

  // "state" agora vai ser UF quando existir; se não existir, usa o nome do estado
  const uf = getUF(address);
  const state = uf || (address.state ? String(address.state) : null);

  const cep = address.postcode || null;

  return { city, state, cep, uf };
}

function mapSearchItem(x) {
  const a = x.address || {};
  const { city, state, cep, uf } = pickCityStateCep(a);

  const street = getStreet(a);
  const district = getDistrict(a);

  return {
    label: x.display_name,
    lat: Number(x.lat),
    lng: Number(x.lon),

    // ✅ novos (para preencher o form)
    street,
    district,
    uf,         // "SP"
    // mantém state como antes (mas agora sem "SÃ")
    state,      // "SP" ou "São Paulo" (fallback)
    city,
    cep,

    raw: x, // mantém o bruto se quiser usar depois (opcional)
  };
}

module.exports = {
  // GET /api/geocode?q=avenida paulista 1000&limit=8
  async search(req, res) {
    const schema = Joi.object({
      q: Joi.string().min(2).required(),
      limit: Joi.number().min(1).max(20).default(8),
      countrycodes: Joi.string().optional(), // ex: "br" se quiser forçar
    });

    const { error, value } = schema.validate(req.query);
    if (error) return bad(res, error.message);

    try {
      const base =
        `https://nominatim.openstreetmap.org/search?` +
        `format=json&addressdetails=1&limit=${value.limit}` +
        `&q=${encodeURIComponent(value.q)}` +
        (value.countrycodes ? `&countrycodes=${encodeURIComponent(value.countrycodes)}` : '');

      const r = await fetch(base, { headers });
      if (!r.ok) return bad(res, `Geocoding error (${r.status})`);

      const data = await r.json();
      const items = Array.isArray(data) ? data.map(mapSearchItem) : [];

      return ok(res, items);
    } catch (e) {
      console.error('geocode search error:', e?.message);
      return bad(res, 'Falha ao buscar geocode');
    }
  },

  // GET /api/geocode/suggest?q=rua xv de novembro curitiba
  // Sugestão: retorna menos itens e força BR por padrão
  async suggest(req, res) {
    const schema = Joi.object({
      q: Joi.string().min(3).required(),
      limit: Joi.number().min(1).max(10).default(6),
      countrycodes: Joi.string().default('br'),
    });

    const { error, value } = schema.validate(req.query);
    if (error) return bad(res, error.message);

    try {
      const url =
        `https://nominatim.openstreetmap.org/search?` +
        `format=json&addressdetails=1&limit=${value.limit}` +
        `&countrycodes=${encodeURIComponent(value.countrycodes)}` +
        `&q=${encodeURIComponent(value.q)}`;

      const r = await fetch(url, { headers });
      if (!r.ok) return bad(res, 'Falha no geocode');

      const arr = await r.json();
      const out = Array.isArray(arr) ? arr.map(mapSearchItem) : [];

      return ok(res, out);
    } catch (e) {
      console.error('geocode suggest error:', e?.message);
      return bad(res, 'Falha ao buscar sugestões');
    }
  },
};
