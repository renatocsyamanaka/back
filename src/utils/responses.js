// src/utils/responses.js
function sendJson(res, status, payload) {
  // Express clássico: res.status().json()
  if (res && typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(status).json(payload);
  }

  // Alguns adaptadores expõem res.status().send()
  if (res && typeof res.status === 'function' && typeof res.send === 'function') {
    try { res.setHeader && res.setHeader('Content-Type', 'application/json; charset=utf-8'); } catch {}
    return res.status(status).send(JSON.stringify(payload));
  }

  // Node http nativo (writeHead/end)
  if (res && typeof res.writeHead === 'function' && typeof res.end === 'function') {
    try { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); } catch {}
    return res.end(JSON.stringify(payload));
  }

  // Fallback p/ testes: retorna o payload
  return payload;
}

module.exports = {
  ok:        (res, data)         => sendJson(res, 200, data),
  created:   (res, data)         => sendJson(res, 201, data),
  bad:       (res, error)        => sendJson(res, 400, { error }),
  forbidden: (res, error)        => sendJson(res, 403, { error }),
  notFound:  (res, error)        => sendJson(res, 404, { error }),
};
