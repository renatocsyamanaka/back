const express = require('express');
const routes = require('./routes');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const cors = require('cors');
const { sequelize, Role } = require('./models');
const path = require('path');

const app = express();

// log simples para ver se as requisições chegam
app.use((req, _res, next) => { console.log(new Date().toISOString(), req.method, req.originalUrl); next(); });

app.use(express.json());

const origins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',').map(s => s.trim()).filter(Boolean);

const corsConfig = {
  origin: origins,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
};

app.use(cors(corsConfig));
// ✅ muito importante no Express 5
app.options(/.*/, cors(corsConfig));

app.get('/docs.json', (_req, res) => res.json(swaggerSpec));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));
app.use('/uploads', express.static(path.resolve(__dirname, '..', 'uploads')));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// ✅ todas as rotas da API vão em /api
app.use('/api', routes);

// healthcheck
app.get('/api/ping', (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.get('/', (_req, res) => res.json({ ok: true }));

module.exports = { app,
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
      for (const r of roles) await Role.findOrCreate({ where: { name: r.name }, defaults: r });
    }
  }
};
