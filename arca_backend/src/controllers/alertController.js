const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { calculateDepartmentScore } = require('./departmentController');
const { checkAndCreateAlerts } = require('../services/alertService');

// GET /api/risk/dashboard — dynamic compliance posture aggregator
const getRiskDashboard = async (req, res, next) => {
  try {
    const depts = await prisma.department.findMany();
    
    let sumScores = 0;
    let totalOverdue = 0;
    let totalAtRisk = 0;
    let totalActive = 0;
    const departmentBreakdown = [];

    for (const dept of depts) {
      const metrics = await calculateDepartmentScore(dept.id);
      sumScores += metrics.score;
      totalOverdue += metrics.overdueCount;
      totalAtRisk += metrics.atRiskCount;
      totalActive += metrics.totalAssigned;
      
      departmentBreakdown.push({
        id: dept.id,
        name: dept.name,
        email: dept.email,
        score: metrics.score,
        riskLevel: metrics.riskLevel,
        overdueCount: metrics.overdueCount,
        atRiskCount: metrics.atRiskCount
      });
    }

    const averageBankScore = depts.length > 0 ? Math.round(sumScores / depts.length) : 100;

    // Fetch up to 10 latest active unread alerts
    const activeAlerts = await prisma.alert.findMany({
      where: { isRead: false },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    // Fetch recent compliance audit logs
    const recentActivity = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8
    });

    res.json({
      overallScore: averageBankScore,
      overallRiskLevel: averageBankScore < 70 ? 'HIGH' : averageBankScore < 85 ? 'MEDIUM' : 'LOW',
      totalActiveMAPs: totalActive,
      totalOverdueMAPs: totalOverdue,
      totalAtRiskMAPs: totalAtRisk,
      departments: departmentBreakdown,
      activeAlerts: activeAlerts,
      recentActivity: recentActivity
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/alerts — list compliance alerts
const getAlerts = async (req, res, next) => {
  try {
    const { isRead } = req.query;
    const where = {};
    if (isRead !== undefined) {
      where.isRead = isRead === 'true';
    }

    const alerts = await prisma.alert.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    res.json(alerts);
  } catch (error) {
    next(error);
  }
};

// PUT /api/alerts/:id/read — mark alert as read
const markAlertAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const alert = await prisma.alert.update({
      where: { id },
      data: { isRead: true }
    });
    res.json(alert);
  } catch (error) {
    next(error);
  }
};

// POST /api/alerts/trigger-scan — manually run deadline alerts engine
const triggerScan = async (req, res, next) => {
  try {
    await checkAndCreateAlerts(req.io);
    res.json({ success: true, message: "Deadline check scan successfully executed." });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRiskDashboard,
  getAlerts,
  markAlertAsRead,
  triggerScan
};
