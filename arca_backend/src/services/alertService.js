const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const createAlert = async (map, alertType, severity, message, io) => {
  try {
    // Check if an alert of this type already exists for this map to avoid duplicate alerts
    const existing = await prisma.alert.findFirst({
      where: { mapId: map.id, alertType }
    });

    if (existing) return null;

    const alert = await prisma.alert.create({
      data: {
        mapId: map.id,
        alertType,
        severity,
        message
      }
    });

    console.log(`[Alert Engine] Created ${severity} alert for MAP ${map.mapCode}: "${message}"`);

    // Emit live socket event to compliance dashboard
    if (io) {
      io.to('compliance-dashboard').emit('alert:new', {
        ...alert,
        mapCode: map.mapCode,
        departmentName: map.department?.name
      });
    }

    return alert;
  } catch (error) {
    console.error("[Alert Service Error]", error);
  }
};

const checkAndCreateAlerts = async (io) => {
  console.log("[Alert Engine] Executing active MAP deadline scanning checks...");
  const today = new Date();

  try {
    // Find all active maps that are not completed, rejected, or waiting in review queue
    const activeMaps = await prisma.map.findMany({
      where: {
        status: { notIn: ['PASSED', 'FAILED', 'CLOSED', 'REJECTED', 'PENDING_REVIEW'] }
      },
      include: { department: true }
    });

    console.log(`[Alert Engine] Scanning ${activeMaps.length} active MAP(s) for deadline thresholds.`);

    for (const map of activeMaps) {
      if (!map.deadline) continue;

      const deadline = new Date(map.deadline);
      const diffTime = deadline - today;
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (daysRemaining <= 0) {
        // Critical escalation: deadline missed!
        await createAlert(
          map, 
          'DEADLINE_MISSED', 
          'CRITICAL',
          `Compliance deadline missed for MAP ${map.mapCode} assigned to "${map.department?.name || 'Unassigned'}". Immediate escalation triggered.`, 
          io
        );
        
        // Auto-escalate the map status in the database
        await prisma.map.update({
          where: { id: map.id },
          data: { status: 'ESCALATED' }
        });

        // Log escalation in Audit trail
        await prisma.auditLog.create({
          data: {
            mapId: map.id,
            documentId: map.documentId,
            eventType: 'DEADLINE_MISSED_ESCALATION',
            actor: 'system:alert-engine',
            description: `Compliance deadline has passed. MAP status auto-escalated to ESCALATED.`
          }
        });

      } else if (daysRemaining <= 3) {
        // High Alert: 3 days remaining
        await createAlert(
          map, 
          'DEADLINE_APPROACHING_3', 
          'HIGH',
          `Urgent warning! MAP ${map.mapCode} assigned to "${map.department?.name}" is due in ${daysRemaining} day(s).`, 
          io
        );
      } else if (daysRemaining <= 7) {
        // Medium Alert: 7 days remaining
        await createAlert(
          map, 
          'DEADLINE_APPROACHING_7', 
          'MEDIUM',
          `MAP ${map.mapCode} assigned to "${map.department?.name}" is due in ${daysRemaining} day(s).`, 
          io
        );
      }
    }

    console.log("[Alert Engine] Deadline scan process completed.");
  } catch (error) {
    console.error("[Alert Engine Error]", error);
  }
};

module.exports = {
  checkAndCreateAlerts,
  createAlert
};
