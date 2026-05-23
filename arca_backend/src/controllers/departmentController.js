const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PRIORITY_WEIGHTS = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
const REGULATOR_WEIGHTS = { RBI: 1.5, 'CERT-In': 1.3, SEBI: 1.2, OTHER: 1.0 };

// Dynamic Compliance Grade Calculator (Phase 5)
const calculateDepartmentScore = async (departmentId) => {
  const maps = await prisma.map.findMany({
    where: {
      departmentId,
      status: { notIn: ['REJECTED', 'SUPERSEDED', 'PENDING_REVIEW'] }
    },
    include: { document: true }
  });

  let totalWeight = 0;
  let achievedWeight = 0;
  const today = new Date();

  for (const map of maps) {
    const pw = PRIORITY_WEIGHTS[map.priority] || 2;
    const rw = REGULATOR_WEIGHTS[map.document?.regulator] || 1.0;
    const weight = pw * rw;
    totalWeight += weight;

    // Award full credit for completed/passed maps
    if (['PASSED', 'OVERRIDDEN_COMPLETE', 'APPROVED'].includes(map.finalVerdict) || map.status === 'PASSED') {
      achievedWeight += weight;
    } else if (map.finalVerdict === 'PARTIALLY_COMPLIANT' || map.status === 'PARTIALLY_COMPLIANT') {
      // Award 50% credit for partial compliance
      achievedWeight += weight * 0.5;
    }
  }

  const score = totalWeight > 0 ? Math.round((achievedWeight / totalWeight) * 100) : 100;

  const overdueMaps = maps.filter(m => {
    if (!m.deadline) return false;
    const isCompleted = ['PASSED', 'PARTIALLY_COMPLIANT'].includes(m.finalVerdict) || m.status === 'PASSED';
    return new Date(m.deadline) < today && !isCompleted;
  });

  const atRiskMaps = maps.filter(m => {
    if (!m.deadline) return false;
    const isCompleted = ['PASSED', 'PARTIALLY_COMPLIANT'].includes(m.finalVerdict) || m.status === 'PASSED';
    const daysLeft = Math.ceil((new Date(m.deadline) - today) / (1000 * 60 * 60 * 24));
    return daysLeft <= 14 && daysLeft > 0 && !isCompleted;
  });

  return {
    score,
    riskLevel: score < 70 ? 'HIGH' : score < 85 ? 'MEDIUM' : 'LOW',
    overdueCount: overdueMaps.length,
    atRiskCount: atRiskMaps.length,
    totalAssigned: maps.length
  };
};

// GET /api/departments — list all departments along with dynamic compliance health scores
const getDepartments = async (req, res, next) => {
  try {
    const depts = await prisma.department.findMany({
      orderBy: { name: 'asc' }
    });

    const enrichedDepts = [];
    for (const dept of depts) {
      const metrics = await calculateDepartmentScore(dept.id);
      enrichedDepts.push({
        ...dept,
        metrics
      });
    }

    res.json(enrichedDepts);
  } catch (error) {
    next(error);
  }
};

// GET /api/departments/:id — fetch single department details with score card
const getDepartmentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const dept = await prisma.department.findUnique({
      where: { id }
    });

    if (!dept) {
      return res.status(404).json({ error: 'Department not found' });
    }

    const metrics = await calculateDepartmentScore(dept.id);
    res.json({
      ...dept,
      metrics
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/departments/:id/maps — get all MAPs assigned to a specific department (with status filters)
const getDepartmentMaps = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.query;

    const where = { departmentId: id };
    if (status) where.status = status;

    const maps = await prisma.map.findMany({
      where,
      orderBy: [
        { deadline: 'asc' },
        { priority: 'desc' }
      ],
      include: {
        document: {
          select: { title: true, regulator: true }
        }
      }
    });

    res.json(maps);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDepartments,
  getDepartmentById,
  getDepartmentMaps,
  calculateDepartmentScore
};
