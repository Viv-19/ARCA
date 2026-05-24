const prisma = require('../config/prisma');

// GET /api/audit-log — list all audit trail logs
const getAuditLogs = async (req, res, next) => {
  try {
    const { eventType, limit = 50, page = 1 } = req.query;
    
    const where = {};
    if (eventType) where.eventType = eventType;

    const parsedLimit = parseInt(limit);
    const parsedPage = parseInt(page);
    const skip = (parsedPage - 1) * parsedLimit;

    const total = await prisma.auditLog.count({ where });
    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parsedLimit,
      skip: skip,
      include: {
        map: {
          select: { mapCode: true, title: true }
        }
      }
    });

    res.json({
      logs,
      pagination: {
        total,
        page: parsedPage,
        limit: parsedLimit,
        pages: Math.ceil(total / parsedLimit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/audit-log/map/:mapId — audit log for one MAP
const getAuditLogsByMapId = async (req, res, next) => {
  try {
    const { mapId } = req.params;
    const logs = await prisma.auditLog.findMany({
      where: { mapId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(logs);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAuditLogs,
  getAuditLogsByMapId
};
