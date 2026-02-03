// src/config/swagger.js
const path = require('path');
const swaggerJSDoc = require('swagger-jsdoc');

const routesGlob = path.resolve(__dirname, '../routes/*.routes.js'); // garante o match

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Operações - Colaboradores API',
      version: '1.0.0',
      description: 'API de gestão de colaboradores, agendas, requisições e banco de horas.'
    },
    servers: [{ url: 'http://localhost:3000/', description: 'Local' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
      }
    }
  },
  apis: [routesGlob], // JSDoc das rotas
};

const swaggerSpec = swaggerJSDoc(options);
module.exports = swaggerSpec;
