const express = require('express');
const routes = require('./routes');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const cors = require('cors');
const { sequelize, Role } = require('./models');
const path = require('path');

const app = express();

app.use((req, _res, next) => {
  console.log(new Date().toISOString(), req.method, req.originalUrl);
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ SERVIR PUBLIC (LOGO)
app.use('/public', express.static(path.resolve(__dirname, '..', 'public')));

// ================= CORS =================
const origins = (
  process.env.CORS_ORIGINS ||
  'http://localhost:5173,http://127.0.0.1:5173,https://app.projetos-rc.online'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const corsConfig = {
  origin: origins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsConfig));
app.options(/.*/, cors(corsConfig));

// ================= COOKIE =================
function getCookie(req, name) {
  const cookies = req.headers.cookie || '';

  const found = cookies
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));

  return found ? decodeURIComponent(found.split('=')[1]) : null;
}

// ================= AUTH SWAGGER =================
function swaggerAuth(req, res, next) {
  const tokenCookie = getCookie(req, 'swagger_token');
  const expectedToken =
    process.env.SWAGGER_TOKEN || 'token-swagger-omnilink-2026';

  if (tokenCookie === expectedToken) {
    return next();
  }

  return res.redirect('/docs-login');
}

// ================= LOGIN PAGE =================
app.get('/docs-login', (req, res) => {
  const hasError = req.query.error === '1';

  res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <title>Login - Swagger</title>

      <style>
        body {
          margin: 0;
          height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          background: #f4f4f4;
          font-family: Arial, sans-serif;
        }

        .card {
          width: 400px;
          background: #fff;
          border-radius: 10px;
          padding: 30px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          text-align: center;
        }

        h2 {
          color: #008fd3;
          margin-bottom: 20px;
        }

        .error {
          background: #fff1f0;
          border: 1px solid #ffccc7;
          color: #cf1322;
          padding: 10px;
          border-radius: 6px;
          margin-bottom: 16px;
          font-size: 14px;
        }

        label {
          display: block;
          text-align: left;
          margin-bottom: 6px;
          font-size: 14px;
        }

        input {
          width: 100%;
          height: 38px;
          border: 1px solid #c8c8c8;
          border-radius: 4px;
          padding: 0 10px;
          margin-bottom: 15px;
          background: #eaf2ff;
          box-sizing: border-box;
        }

        button {
          width: 100%;
          height: 40px;
          border: none;
          border-radius: 6px;
          background: #089bd8;
          color: white;
          font-size: 16px;
          cursor: pointer;
        }

        button:hover {
          background: #007fba;
        }

        .logo {
          margin-top: 20px;
        }

        .logo img {
          width: 180px;
        }

        .footer {
          margin-top: 10px;
          color: #666;
          font-size: 13px;
        }
      </style>
    </head>

    <body>
      <div class="card">
        <h2>Login - Swagger</h2>

        ${hasError ? `<div class="error">Usuário ou senha inválidos</div>` : ''}

        <form method="POST" action="/docs-login">
          <label>Usuário:</label>
          <input name="user" required />

          <label>Senha:</label>
          <input name="pass" type="password" required />

          <button type="submit">Entrar</button>
        </form>

        <div class="logo">
          <img src="/public/logo.png" />
        </div>

        <div class="footer">
          É sempre um prazer atender você!
        </div>
      </div>
    </body>
    </html>
  `);
});

// ================= LOGIN =================
app.post('/docs-login', (req, res) => {
  const { user, pass } = req.body;

  const swaggerUser = process.env.SWAGGER_USER || 'admin';
  const swaggerPass = process.env.SWAGGER_PASS || 'admin123';
  const swaggerToken =
    process.env.SWAGGER_TOKEN || 'token-swagger-omnilink-2026';

  if (user !== swaggerUser || pass !== swaggerPass) {
    return res.redirect('/docs-login?error=1');
  }

  res.setHeader(
    'Set-Cookie',
    `swagger_token=${encodeURIComponent(
      swaggerToken
    )}; HttpOnly; Path=/; SameSite=Lax`
  );

  return res.redirect('/docs');
});

// ================= LOGOUT =================
app.get('/docs-logout', (req, res) => {
  res.setHeader(
    'Set-Cookie',
    'swagger_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax'
  );

  return res.redirect('/docs-login');
});

// ================= SWAGGER =================
app.get('/docs.json', swaggerAuth, (_req, res) => {
  res.json(swaggerSpec);
});

app.use(
  '/docs',
  swaggerAuth,
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    swaggerOptions: {
      persistAuthorization: true,
    },
  })
);

// ================= STATIC =================
app.use('/uploads', express.static(path.resolve(__dirname, '..', 'uploads')));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// ================= API =================
app.use('/api', routes);

// ================= HEALTH =================
app.get('/api/ping', (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

app.get('/', (_req, res) => {
  res.json({ ok: true });
});

module.exports = {
  app,

  bootstrap: async ({ sync = false } = {}) => {
    if (sync) {
      await sequelize.sync({ alter: true });

      const roles = [
        { name: 'Tecnico', level: 1 },
        { name: 'Supervisor', level: 2 },
        { name: 'Coordenador', level: 3 },
        { name: 'Gerente', level: 4 },
        { name: 'Analista', level: 2 },
        { name: 'Diretor', level: 5 },
        { name: 'Admin', level: 5 },
      ];

      for (const r of roles) {
        await Role.findOrCreate({
          where: { name: r.name },
          defaults: r,
        });
      }
    }
  },
};