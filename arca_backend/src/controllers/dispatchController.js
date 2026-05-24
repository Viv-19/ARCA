const prisma = require('../config/prisma');
const axios = require('axios');
const { createComplianceTicket } = require('../services/jiraService');
const { sendMapAssignmentEmail } = require('../services/emailService');

// Helper to create audit logs
const createAuditLog = async ({ mapId, documentId, eventType, actor, description, inputData, outputData }) => {
  try {
    return await prisma.auditLog.create({
      data: {
        mapId,
        documentId,
        eventType,
        actor,
        description,
        inputData: inputData ? JSON.parse(JSON.stringify(inputData)) : null,
        outputData: outputData ? JSON.parse(JSON.stringify(outputData)) : null
      }
    });
  } catch (error) {
    console.error("[Audit Log Error]", error);
  }
};

const dispatchMap = async (mapId, io) => {
  console.log(`[Dispatch] Initiating dispatch sequence for MAP: ${mapId}...`);

  // Step 1: Fetch MAP details with Document and Department
  const map = await prisma.map.findUnique({
    where: { id: mapId },
    include: { document: true, department: true }
  });

  if (!map) {
    throw new Error(`MAP with ID ${mapId} not found`);
  }

  let finalDeptName = null;
  let routingJustification = "Pre-routed by compliance officer during review gate.";
  let confidenceScore = 1.0;

  // Step 2: Route the MAP using RAG + AI routing service
  try {
    console.log(`[Dispatch] Requesting AI Service routing at ${process.env.AI_SERVICE_URL}/api/routing/route-map/${map.id}...`);
    const aiResponse = await axios.post(
      `${process.env.AI_SERVICE_URL}/api/routing/route-map/${map.id}`,
      {},
      { timeout: 4000 }
    );
    finalDeptName = aiResponse.data.department;
    routingJustification = aiResponse.data.justification;
    confidenceScore = aiResponse.data.confidence || 0.8;
    console.log(`[Dispatch] AI Service routed MAP to "${finalDeptName}" with ${Math.round(confidenceScore * 100)}% confidence.`);
  } catch (err) {
    console.warn(`[Dispatch Warning] AI routing service failed (${err.message}). Activating fallback router...`);
    
    if (map.departmentId) {
      // Use the department already assigned by the officer
      const preAssignedDept = await prisma.department.findUnique({ where: { id: map.departmentId } });
      finalDeptName = preAssignedDept.name;
      routingJustification = "Officer manual assignment used as router fallback.";
    } else {
      // Ultimate default fallback
      finalDeptName = "Compliance Central";
      routingJustification = "Router fallback triggered. Routed to Central Compliance for manual triage.";
      confidenceScore = 0.5;
    }
  }

  // Step 3: Fetch the database ID of the routed Department
  let dept = await prisma.department.findUnique({ where: { name: finalDeptName } });
  
  if (!dept) {
    console.warn(`[Dispatch] Department "${finalDeptName}" not found in DB. Creating dynamically...`);
    dept = await prisma.department.create({
      data: {
        name: finalDeptName,
        email: `${finalDeptName.toLowerCase().replace(/\s+/g, '-')}@canarabank.com`
      }
    });
  }

  // Step 4: Update MAP with department ID, routing justification, status
  const updatedMap = await prisma.map.update({
    where: { id: mapId },
    data: {
      departmentId: dept.id,
      status: 'DISPATCHED',
      dispatchedAt: new Date(),
      confidenceScore: map.confidenceScore || confidenceScore
    },
    include: { document: true, department: true }
  });

  // Step 5: Create JIRA compliance task ticket (if TECHNICAL)
  let jiraTicketId = map.jiraTicketId || null;
  if (updatedMap.classification === 'TECHNICAL' && !jiraTicketId) {
    try {
      console.log(`[Dispatch] MAP is technical. Creating JIRA compliance ticket...`);
      jiraTicketId = await createComplianceTicket(updatedMap);
      if (jiraTicketId) {
        await prisma.map.update({
          where: { id: mapId },
          data: { jiraTicketId }
        });
        updatedMap.jiraTicketId = jiraTicketId;
      }
    } catch (err) {
      console.error(`[Dispatch Error] JIRA ticket creation failed:`, err);
    }
  }

  // Step 6: Send Email notification to routed department group
  try {
    console.log(`[Dispatch] Sending compliance email notification to ${dept.name} (${dept.email})...`);
    await sendMapAssignmentEmail(updatedMap, dept);
  } catch (err) {
    console.error(`[Dispatch Error] Email notification failed:`, err);
  }

  // Step 7: Log dispatch action to central AuditLog
  await createAuditLog({
    mapId: map.id,
    documentId: map.documentId,
    eventType: 'MAP_DISPATCHED',
    actor: 'system:dispatch',
    description: `MAP routed to "${dept.name}" department. Justification: ${routingJustification}`,
    outputData: { department: dept.name, jiraTicketId, confidenceScore }
  });

  // Step 8: Emit real-time WebSocket notifications
  if (io) {
    io.to('compliance-dashboard').emit('map:dispatched', {
      mapId: updatedMap.id,
      mapCode: updatedMap.mapCode,
      department: dept.name
    });
    io.to(`department:${dept.id}`).emit('map:assigned', updatedMap);
  }

  console.log(`[Dispatch Success] MAP ${updatedMap.mapCode} successfully dispatched to "${dept.name}".`);
  return { success: true, department: dept.name, jiraTicketId, justification: routingJustification };
};

// POST Endpoint handler for manual route /api/maps/:id/dispatch
const handleManualDispatch = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await dispatchMap(id, req.io);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  dispatchMap,
  handleManualDispatch
};
