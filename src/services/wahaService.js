const axios = require('axios');

const WAHA_URL = (process.env.WAHA_URL || '').replace(/\/+$/, '');
const WAHA_API_KEY = process.env.WAHA_API_KEY || '';
const WAHA_SESSION = process.env.WAHA_SESSION || 'default';

if (!WAHA_URL) {
  console.warn('WAHA_URL não definido no .env');
}

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
      name: sessionName,
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
    console.log('WAHA getSessionStatus ->', `${WAHA_URL}/api/sessions?all=true`);

    const res = await client.get('/api/sessions?all=true');

    const sessions = extractSessions(res.data);
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

async function getQRCode(sessionName = WAHA_SESSION) {
  try {
    console.log('WAHA getQRCode ->', `${WAHA_URL}/api/${sessionName}/auth/qr?format=image`);

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

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits;
}

function normalizeChatId(phoneOrChatId) {
  const value = String(phoneOrChatId || '').trim();

  if (!value) return '';

  if (
    value.includes('@c.us') ||
    value.includes('@g.us') ||
    value.includes('@lid') ||
    value.includes('@s.whatsapp.net')
  ) {
    return value;
  }

  const digits = String(value).replace(/\D/g, '');
  return digits ? `${digits}@c.us` : '';
}

async function sendText(phone, text, sessionName = WAHA_SESSION) {
  try {
    const chatId = normalizeChatId(phone);

    if (!chatId) {
      throw new Error('Telefone/chatId inválido para envio');
    }

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

async function sendMenu(to, sessionName = WAHA_SESSION) {
  return sendText(
    to,
    [
      '👋 Olá! Seja bem-vindo.',
      '',
      'Como posso te ajudar?',
      '1️⃣ Consultar nota',
      '2️⃣ Falar com atendente',
      '',
      'Digite a opção desejada.',
    ].join('\n'),
    sessionName
  );
}

async function handleIncomingMessage(payload, sessionName = WAHA_SESSION) {
  try {
    const message = payload?.message || payload;
    const from =
      message?.from ||
      message?.chatId ||
      message?.author ||
      payload?.from ||
      payload?.chatId;

    const body =
      message?.body ||
      message?.text ||
      message?.message ||
      payload?.body ||
      payload?.text ||
      '';

    const text = String(body || '').trim();
    const normalizedText = text.toLowerCase();

    if (!from) {
      console.log('WAHA handleIncomingMessage: mensagem sem remetente');
      return { ok: false, message: 'Mensagem sem remetente' };
    }

    if (!text) {
      console.log('WAHA handleIncomingMessage: mensagem sem texto');
      return { ok: false, message: 'Mensagem sem texto' };
    }

    console.log('WAHA handleIncomingMessage FROM:', from);
    console.log('WAHA handleIncomingMessage TEXT:', text);

    if (
      normalizedText === 'oi' ||
      normalizedText === 'olá' ||
      normalizedText === 'ola' ||
      normalizedText === 'menu' ||
      normalizedText === 'bom dia' ||
      normalizedText === 'boa tarde' ||
      normalizedText === 'boa noite'
    ) {
      await sendMenu(from, sessionName);
      return { ok: true, flow: 'menu' };
    }

    if (normalizedText === '1') {
      await sendText(from, '📄 Informe o número da nota para consulta.', sessionName);
      return { ok: true, flow: 'solicitar_nota' };
    }

    if (normalizedText === '2') {
      await sendText(
        from,
        '👨‍💼 Perfeito. Vou registrar seu atendimento para falar com um responsável.',
        sessionName
      );
      return { ok: true, flow: 'atendente' };
    }

    if (/^\d+$/.test(normalizedText)) {
      await sendText(
        from,
        `🔍 Recebi o número ${normalizedText}. Agora você pode integrar aqui sua consulta real da nota.`,
        sessionName
      );

      // Exemplo de integração futura:
      // const { data } = await axios.get(`http://localhost:3000/api/notas/numero/${normalizedText}`);
      // await sendText(from, `Status da nota: ${data.status}`, sessionName);

      return { ok: true, flow: 'numero_nota', numero: normalizedText };
    }

    await sendText(
      from,
      '❌ Não entendi sua mensagem.\nDigite *menu* para ver as opções disponíveis.',
      sessionName
    );

    return { ok: true, flow: 'fallback' };
  } catch (error) {
    console.error('WAHA handleIncomingMessage ERROR:', error?.response?.data || error.message);
    throw new Error(getErrorMessage(error, 'Erro ao processar mensagem recebida'));
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
  sendMenu,
  handleIncomingMessage,
};