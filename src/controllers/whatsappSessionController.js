const waha = require('../services/wahaService');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForSession(sessionName = 'default', timeoutMs = 15000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const status = await waha.getSessionStatus(sessionName);
      const normalizedStatus = String(status?.status || '').toUpperCase();

      if (normalizedStatus && normalizedStatus !== 'NOT_FOUND') {
        return status;
      }
    } catch (error) {
      console.log('WAIT SESSION CHECK ERROR:', error?.message);
    }

    await sleep(1000);
  }

  throw new Error('Sessão não apareceu após criação');
}

async function connect(req, res) {
  console.log('>>> CONNECT HIT');

  try {
    const status = await waha.getSessionStatus();
    console.log('SESSION STATUS ON CONNECT:', status);

    if (String(status?.status || '').toUpperCase() === 'NOT_FOUND') {
      return res.status(404).json({
        error: 'Sessão default não encontrada via API do WAHA',
      });
    }

    const started = await waha.startSession();
    console.log('SESSION STARTED:', started);

    return res.json({
      ok: true,
      status,
      started,
    });
  } catch (error) {
    console.error('CONNECT ERROR:', error.message);
    return res.status(500).json({
      error: error.message || 'Erro ao iniciar conexão',
    });
  }
}

async function status(req, res) {
  console.log('>>> /whatsapp/session/status HIT');

  try {
    const data = await waha.getSessionStatus();
    return res.json(data);
  } catch (error) {
    console.error('STATUS SESSION ERROR:', error?.message);
    return res.status(500).json({
      error: error.message || 'Erro ao buscar status da sessão',
    });
  }
}

async function qr(req, res) {
  console.log('>>> /whatsapp/session/qr HIT');

  try {
    const status = await waha.getSessionStatus();
    const normalizedStatus = String(status?.status || '').toUpperCase();

    if (normalizedStatus === 'NOT_FOUND') {
      return res.status(404).json({
        error: 'Sessão não encontrada no WAHA.',
      });
    }

    const data = await waha.getQRCode();
    return res.json(data);
  } catch (error) {
    console.error('QR SESSION ERROR:', error?.message);
    return res.status(500).json({
      error: error.message || 'Erro ao buscar QR Code',
    });
  }
}

async function logout(req, res) {
  console.log('>>> /whatsapp/session/logout HIT');

  try {
    const data = await waha.logoutSession();

    return res.json({
      ok: true,
      ...data,
    });
  } catch (error) {
    console.error('LOGOUT SESSION ERROR:', error?.message);
    return res.status(500).json({
      error: error.message || 'Erro ao desconectar sessão',
    });
  }
}
async function restart(req, res) {
  console.log('>>> RESTART HIT');

  try {
    const status = await waha.getSessionStatus();
    console.log('SESSION STATUS:', status);

    if (String(status?.status || '').toUpperCase() === 'NOT_FOUND') {
      return res.status(404).json({
        error: 'Sessão default não encontrada via API do WAHA',
      });
    }

    const started = await waha.startSession();
    console.log('SESSION STARTED:', started);

    return res.json({
      ok: true,
      status,
      started,
    });
  } catch (error) {
    console.error('RESTART ERROR:', error.message);
    return res.status(500).json({
      error: error.message || 'Erro ao reiniciar sessão',
    });
  }
}

async function debug(req, res) {
  console.log('>>> /whatsapp/session/debug HIT');

  try {
    const sessions = await waha.listSessions();
    return res.json(sessions);
  } catch (error) {
    console.error('DEBUG SESSION ERROR:', error?.message);
    return res.status(500).json({
      error: error.message || 'Erro ao listar sessões',
    });
  }
}

module.exports = {
  connect,
  status,
  qr,
  logout,
  restart,
  debug,
};