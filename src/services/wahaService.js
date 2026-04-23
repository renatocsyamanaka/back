const axios = require('axios');

const WAHA_URL = (process.env.WAHA_URL || '').replace(/\/+$/, '');
const WAHA_API_KEY = process.env.WAHA_API_KEY || '';
const WAHA_SESSION = process.env.WAHA_SESSION || 'default';

const client = axios.create({
  baseURL: WAHA_URL,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(WAHA_API_KEY ? { 'X-Api-Key': WAHA_API_KEY } : {}),
  },
});

function getErrorMessage(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  );
}

async function createSession(sessionName = WAHA_SESSION) {
  try {
    console.log('WAHA createSession ->', `${WAHA_URL}/api/sessions`, sessionName);

    const res = await client.post('/api/sessions', {
      name: 'default',
      start: false,
    });

    console.log('WAHA createSession STATUS:', res.status);
    console.log('WAHA createSession DATA:', res.data);

    return res.data;
  } catch (error) {
    console.error('WAHA createSession ERROR:', error?.response?.data || error.message);

    if (error?.response?.status === 409) {
      return { ok: true, message: 'Sessão já existe' };
    }

    throw new Error(getErrorMessage(error, 'Erro ao criar sessão'));
  }
}

async function startSession(sessionName = WAHA_SESSION) {
  try {
    console.log('WAHA startSession ->', `${WAHA_URL}/api/sessions/${sessionName}/start`);

    const res = await client.post(`/api/sessions/${sessionName}/start`);
    return res.data;
  } catch (error) {
    console.error('WAHA startSession ERROR:', error?.response?.data || error.message);
    throw new Error(getErrorMessage(error, 'Erro ao iniciar sessão'));
  }
}

async function getSessionStatus(sessionName = WAHA_SESSION) {
  try {
    console.log('WAHA getSessionStatus ->', `${WAHA_URL}/api/sessions?all=true`);

    const res = await client.get('/api/sessions?all=true');

    const session = res.data.find((s) => s.name === sessionName);

    if (!session) {
      return { status: 'NOT_FOUND' };
    }

    return session;
  } catch (error) {
    console.error('WAHA getSessionStatus ERROR:', error?.response?.data || error.message);
    throw new Error(getErrorMessage(error, 'Erro ao buscar status da sessão'));
  }
}

async function getQRCode(sessionName = WAHA_SESSION) {
  try {

    const res = await client.get(`/api/${sessionName}/auth/qr?format=image`, {
      headers: {
        ...(WAHA_API_KEY ? { 'X-Api-Key': WAHA_API_KEY } : {}),
        Accept: 'application/json',
      },
    });


    return res.data;
  } catch (error) {
    console.error('WAHA getQRCode ERROR:', error?.response?.data || error.message);
    throw new Error(getErrorMessage(error, 'Erro ao buscar QR Code'));
  }
}

async function listSessions() {
  try {
    console.log('WAHA listSessions ->', `${WAHA_URL}/api/sessions?all=true`);

    const res = await client.get('/api/sessions?all=true');

    console.log('WAHA listSessions RAW:', JSON.stringify(res.data, null, 2));

    return res.data;
  } catch (error) {
    console.error('WAHA listSessions ERROR:', error?.response?.data || error.message);
    throw new Error(getErrorMessage(error, 'Erro ao listar sessões'));
  }
}

function extractSessions(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.sessions)) return payload.sessions;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

async function getSessionStatus(sessionName = WAHA_SESSION) {
  try {

    const res = await client.get('/api/sessions?all=true');

    const sessions = Array.isArray(res.data) ? res.data : [];
    const session = sessions.find((item) => item.name === sessionName);

    if (!session) {
      return { status: 'NOT_FOUND' };
    }

    return session;
  } catch (error) {
    console.error('WAHA getSessionStatus ERROR:', error?.response?.data || error.message);
    throw new Error(getErrorMessage(error, 'Erro ao buscar status da sessão'));
  }
}

async function logoutSession(sessionName = WAHA_SESSION) {
  try {
    console.log('WAHA logoutSession ->', `${WAHA_URL}/api/sessions/${sessionName}/logout`);

    const res = await client.post(`/api/sessions/${sessionName}/logout`);
    return res.data;
  } catch (error) {
    console.error('WAHA logoutSession ERROR:', error?.response?.data || error.message);
    throw new Error(getErrorMessage(error, 'Erro ao desconectar sessão'));
  }
}

async function deleteSession(sessionName = WAHA_SESSION) {
  try {
    console.log('WAHA deleteSession ->', `${WAHA_URL}/api/sessions/${sessionName}`);

    const res = await client.delete(`/api/sessions/${sessionName}`);
    return res.data;
  } catch (error) {
    console.error('WAHA deleteSession ERROR:', error?.response?.data || error.message);
    throw new Error(getErrorMessage(error, 'Erro ao excluir sessão'));
  }
}

async function sendText(phone, text, sessionName = WAHA_SESSION) {
  try {
    const chatId = `${String(phone || '').replace(/\D/g, '')}@c.us`;

    console.log('WAHA sendText ->', `${WAHA_URL}/api/sendText`, chatId);

    const res = await client.post('/api/sendText', {
      session: sessionName,
      chatId,
      text,
    });

    return res.data;
  } catch (error) {
    console.error('WAHA sendText ERROR:', error?.response?.data || error.message);
    throw new Error(getErrorMessage(error, 'Erro ao enviar mensagem'));
  }
}

module.exports = {
  listSessions,
  createSession,
  startSession,
  getSessionStatus,
  getQRCode,
  logoutSession,
  deleteSession,
  sendText,
};