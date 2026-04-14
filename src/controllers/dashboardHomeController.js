const { Op } = require('sequelize');
const { News, Sector, DashboardBanner, SystemUpdate } = require('../models');
const { ok, bad } = require('../utils/responses');

const QUICK_ACCESS_ITEMS = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    path: '/dashboard',
    permission: 'DASHBOARD_VIEW',
    icon: 'DashboardOutlined',
  },
  {
    key: 'installation-projects',
    label: 'Projetos de Instalação',
    path: '/projetos-instalacao',
    permission: 'INSTALLATION_PROJECTS_VIEW',
    icon: 'ProjectOutlined',
  },
  {
    key: 'delivery-reports',
    label: 'Relatórios de Entrega',
    path: '/delivery-reports',
    permission: 'DELIVERY_REPORTS_VIEW',
    icon: 'FileTextOutlined',
  },
  {
    key: 'techs-map',
    label: 'Mapa de Técnicos',
    path: '/mapa-tecnicos',
    permission: 'TECHS_MAP_VIEW',
    icon: 'EnvironmentOutlined',
  },
  {
    key: 'users',
    label: 'Usuários',
    path: '/users',
    permission: 'USERS_VIEW',
    icon: 'TeamOutlined',
  },
  {
    key: 'clients',
    label: 'Clientes',
    path: '/clients',
    permission: 'CLIENTS_VIEW',
    icon: 'BankOutlined',
  },
  {
    key: 'tasks',
    label: 'Tarefas',
    path: '/tasks',
    permission: 'TASKS_VIEW',
    icon: 'CheckSquareOutlined',
  },
  {
    key: 'news-admin',
    label: 'Gerenciar Notícias',
    path: '/news-admin',
    permission: 'NEWS_ADMIN_VIEW',
    icon: 'NotificationOutlined',
  },
  {
    key: 'dashboard-activities',
    label: 'Updates',
    path: '/dashboard-activities',
    permission: 'DASHBOARD_ACTIVITY_VIEW',
    icon: 'HistoryOutlined',
  },
];

function hasPermission(user, permission) {
  const level = user?.role?.level || user?.roleLevel || 0;
  if (level >= 5) return true;

  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  return permissions.includes(permission);
}

module.exports = {
  async getHome(req, res) {
    try {
      const newsLimit = Number(req.query.newsLimit) > 0 ? Number(req.query.newsLimit) : 6;
      const updatesLimit = Number(req.query.updatesLimit) > 0 ? Number(req.query.updatesLimit) : 6;
      const sectorId = Number(req.query.sectorId) || Number(req.user?.sectorId) || null;
      const now = new Date();

      const banners = await DashboardBanner.findAll({
        where: {
          isActive: true,
          [Op.and]: [
            {
              [Op.or]: [{ startsAt: null }, { startsAt: { [Op.lte]: now } }],
            },
            {
              [Op.or]: [{ endsAt: null }, { endsAt: { [Op.gte]: now } }],
            },
          ],
        },
        order: [
          ['sortOrder', 'ASC'],
          ['createdAt', 'DESC'],
        ],
      });

      const newsRows = await News.findAll({
        where: { isActive: true },
        include: [
          {
            model: Sector,
            as: 'sectors',
            attributes: ['id', 'name'],
            through: { attributes: [] },
            required: false,
          },
        ],
        order: [['createdAt', 'DESC']],
        limit: newsLimit,
      });

      const news = sectorId
        ? newsRows.filter((row) => {
            if (row.targetAllSectors) return true;
            return (row.sectors || []).some((s) => Number(s.id) === Number(sectorId));
          })
        : newsRows;

      const updates = await SystemUpdate.findAll({
        where: { isActive: true },
        order: [
          ['publishedAt', 'DESC'],
          ['createdAt', 'DESC'],
        ],
        limit: updatesLimit,
      });

      const quickAccess = QUICK_ACCESS_ITEMS.filter((item) =>
        hasPermission(req.user, item.permission)
      );

      return ok(res, {
        banners,
        news,
        updates,
        quickAccess,
      });
    } catch (e) {
      console.error('[dashboardHome.getHome]', e);
      return bad(res, 'Falha ao carregar a home do dashboard');
    }
  },
};