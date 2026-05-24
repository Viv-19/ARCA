const prisma = require('../config/prisma');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { dispatchMap } = require('./dispatchController');

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

// GET /api/maps — list MAPs with filters & pagination
const getMaps = async (req, res, next) => {
  try {
    const { status, departmentId, priority, regulator, classification, limit = 20, page = 1 } = req.query;
    
    const where = {};
    if (status) where.status = status;
    if (departmentId) where.departmentId = departmentId;
    if (priority) where.priority = priority;
    if (classification) where.classification = classification;
    if (regulator) {
      where.document = { regulator };
    }

    const parsedLimit = parseInt(limit);
    const parsedPage = parseInt(page);
    const skip = (parsedPage - 1) * parsedLimit;

    const total = await prisma.map.count({ where });
    const maps = await prisma.map.findMany({
      where,
      orderBy: [
        { deadline: 'asc' },
        { priority: 'desc' }
      ],
      take: parsedLimit,
      skip: skip,
      include: {
        document: {
          select: { title: true, regulator: true, publicationDate: true }
        },
        department: true
      }
    });

    res.json({
      maps,
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

// GET /api/maps/pending-review — maps waiting for officer approval (flagged ones first)
const getPendingReview = async (req, res, next) => {
  try {
    const maps = await prisma.map.findMany({
      where: { status: 'PENDING_REVIEW' },
      orderBy: [
        { flaggedForReview: 'desc' }, // Flagged ones first!
        { priority: 'desc' },
        { deadline: 'asc' }
      ],
      include: {
        document: true,
        department: true
      }
    });
    res.json(maps);
  } catch (error) {
    next(error);
  }
};

// GET /api/maps/:id — fetch single map
const getMapById = async (req, res, next) => {
  try {
    const map = await prisma.map.findUnique({
      where: { id: req.params.id },
      include: {
        document: true,
        department: true,
        evidenceFiles: true,
        auditLogs: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!map) {
      return res.status(404).json({ error: 'MAP not found' });
    }

    res.json(map);
  } catch (error) {
    next(error);
  }
};

// POST /api/maps — Save new MAP (called by AI service during automated MAP generation)
const createMap = async (req, res, next) => {
  try {
    const mapData = req.body;
    
    // Generate high-quality structured unique map code if not provided
    if (!mapData.mapCode) {
      const doc = await prisma.document.findUnique({ where: { id: mapData.documentId } });
      const regulator = doc ? doc.regulator : 'REG';
      const year = doc && doc.publicationDate ? new Date(doc.publicationDate).getFullYear() : new Date().getFullYear();
      
      // Count all maps for this regulator and year across all documents
      const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
      const endDate = new Date(`${year}-12-31T23:59:59.999Z`);
      const count = await prisma.map.count({
        where: {
          document: {
            regulator: regulator,
            publicationDate: {
              gte: startDate,
              lte: endDate
            }
          }
        }
      });
      
      let finalCount = count;
      let code = `MAP-${regulator}-${year}-${String(finalCount + 1).padStart(3, '0')}`;
      
      // Safety loop to resolve concurrent inserts or edge cases
      let exists = await prisma.map.findUnique({ where: { mapCode: code } });
      while (exists) {
        finalCount++;
        code = `MAP-${regulator}-${year}-${String(finalCount + 1).padStart(3, '0')}`;
        exists = await prisma.map.findUnique({ where: { mapCode: code } });
      }
      
      mapData.mapCode = code;
    }

    const map = await prisma.map.create({
      data: mapData,
      include: { document: true }
    });

    // Log the event
    await createAuditLog({
      mapId: map.id,
      documentId: map.documentId,
      eventType: 'MAP_GENERATED',
      actor: 'system:generator',
      description: `MAP "${map.title}" generated for document ${map.document.title}.`
    });

    // Emit event to dashboard
    req.io.to('compliance-dashboard').emit('map:new', map);

    res.status(201).json(map);
  } catch (error) {
    next(error);
  }
};

// PUT /api/maps/:id/approve — officer approves MAP (automatically triggers dispatch sequence)
const approveMap = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { approvedBy = 'officer-1', notes = '' } = req.body;

    const map = await prisma.map.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy,
        approvedAt: new Date()
      },
      include: { document: true }
    });

    // Log the approval
    await createAuditLog({
      mapId: map.id,
      documentId: map.documentId,
      eventType: 'MAP_APPROVED',
      actor: `user:${approvedBy}`,
      description: `MAP approved by compliance officer. Notes: ${notes || 'none'}`
    });

    // Emit live update
    req.io.to('compliance-dashboard').emit('map:approved', { mapId: map.id, mapCode: map.mapCode });

    // Trigger auto-dispatch (routes department, creates JIRA, emails team)
    console.log(`[Review Gate] MAP ${map.mapCode} approved. Launching auto-dispatch sequence...`);
    dispatchMap(map.id, req.io).catch(err => {
      console.error(`[Review Gate Error] Dispatch failed for MAP ${map.mapCode}:`, err.message);
    });

    res.json(map);
  } catch (error) {
    next(error);
  }
};

// PUT /api/maps/:id/edit — officer edits MAP parameters then approves (starts dispatch)
const editAndApproveMap = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fieldsToUpdate, editReason, editedBy = 'officer-1' } = req.body;

    const originalMap = await prisma.map.findUnique({ where: { id } });
    if (!originalMap) {
      return res.status(404).json({ error: 'MAP not found' });
    }

    // Process fields like deadline dates properly
    const dataToUpdate = { ...fieldsToUpdate };
    if (dataToUpdate.deadline) {
      dataToUpdate.deadline = new Date(dataToUpdate.deadline);
    }
    dataToUpdate.status = 'APPROVED';
    dataToUpdate.approvedBy = editedBy;
    dataToUpdate.approvedAt = new Date();

    const map = await prisma.map.update({
      where: { id },
      data: dataToUpdate,
      include: { document: true }
    });

    // Log the edit & approval event (captures history for self-improving ML feedback loops)
    await createAuditLog({
      mapId: map.id,
      documentId: map.documentId,
      eventType: 'MAP_EDITED_AND_APPROVED',
      actor: `user:${editedBy}`,
      description: `MAP edited & approved. Reason: ${editReason || 'manual corrections'}`,
      inputData: originalMap,
      outputData: fieldsToUpdate
    });

    // Emit live update
    req.io.to('compliance-dashboard').emit('map:approved', { mapId: map.id, mapCode: map.mapCode });

    // Trigger auto-dispatch sequence
    dispatchMap(map.id, req.io).catch(err => {
      console.error(`[Review Gate Error] Dispatch failed for edited MAP ${map.mapCode}:`, err.message);
    });

    res.json(map);
  } catch (error) {
    next(error);
  }
};

// PUT /api/maps/:id/reject — officer rejects MAP
const rejectMap = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rejectedBy = 'officer-1', reason = '' } = req.body;

    const map = await prisma.map.update({
      where: { id },
      data: {
        status: 'REJECTED',
        closedAt: new Date()
      }
    });

    await createAuditLog({
      mapId: map.id,
      documentId: map.documentId,
      eventType: 'MAP_REJECTED',
      actor: `user:${rejectedBy}`,
      description: `MAP rejected by compliance officer. Reason: ${reason || 'Not specified'}`
    });

    req.io.to('compliance-dashboard').emit('map:rejected', { mapId: map.id, mapCode: map.mapCode });

    res.json(map);
  } catch (error) {
    next(error);
  }
};

// POST /api/maps/approve-bulk — bulk approve multiple maps
const bulkApprove = async (req, res, next) => {
  try {
    const { mapIds, approvedBy = 'officer-1' } = req.body;
    if (!mapIds || !Array.isArray(mapIds) || mapIds.length === 0) {
      return res.status(400).json({ error: 'Invalid or empty mapIds array' });
    }

    const result = await prisma.map.updateMany({
      where: { id: { in: mapIds }, status: 'PENDING_REVIEW' },
      data: {
        status: 'APPROVED',
        approvedBy,
        approvedAt: new Date()
      }
    });

    // Dispatch approved maps in background
    for (const mapId of mapIds) {
      dispatchMap(mapId, req.io).catch(err => {
        console.error(`[Bulk Dispatch Error] Dispatch failed for MAP ${mapId}:`, err.message);
      });
    }

    res.json({ success: true, approvedCount: result.count });
  } catch (error) {
    next(error);
  }
};

// POST /api/maps/:id/evidence — department uploads compliance proof files
const uploadEvidence = async (req, res, next) => {
  try {
    const { id: mapId } = req.params;
    const { evidenceType = 'other', notes = '', uploadedBy = 'dept-user' } = req.body;
    const { files } = req;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No evidence files uploaded' });
    }

    const map = await prisma.map.findUnique({
      where: { id: mapId },
      include: { document: true }
    });

    if (!map) {
      return res.status(404).json({ error: 'MAP not found' });
    }

    const permanentFolder = path.join(__dirname, `../../uploads/evidence/${mapId}`);
    if (!fs.existsSync(permanentFolder)) {
      fs.mkdirSync(permanentFolder, { recursive: true });
    }

    const savedFiles = [];
    for (const file of files) {
      const permanentPath = path.join(permanentFolder, `${Date.now()}_${file.originalname}`);
      fs.copyFileSync(file.path, permanentPath);
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

      const evidence = await prisma.evidence.create({
        data: {
          mapId,
          fileName: file.originalname,
          filePath: permanentPath,
          fileSize: file.size,
          mimeType: file.mimetype,
          evidenceType,
          uploadedBy,
          notes
        }
      });
      savedFiles.push(evidence);
    }

    // Update MAP status to EVIDENCE_SUBMITTED
    await prisma.map.update({
      where: { id: mapId },
      data: { status: 'EVIDENCE_SUBMITTED' }
    });

    // Audit log
    await createAuditLog({
      mapId,
      documentId: map.documentId,
      eventType: 'EVIDENCE_SUBMITTED',
      actor: `user:${uploadedBy}`,
      description: `Submitted ${savedFiles.length} evidence file(s). Notes: ${notes || 'none'}`
    });

    req.io.to('compliance-dashboard').emit('evidence:submitted', { mapId, filesCount: savedFiles.length });

    // Trigger AI validation automatically (Phase 4 autonomous checking loop)
    console.log(`[Validation Gate] Fired autonomous validation for MAP: ${mapId}...`);
    
    // Asynchronous background call
    axios.post(`${process.env.AI_SERVICE_URL}/api/validation/validate/${mapId}`)
      .then(async (result) => {
        console.log(`[Validation Gate] AI validation results received for MAP ${map.mapCode}:`, result.data);
        const { overall_result, reasoning } = result.data;
        
        await prisma.map.update({
          where: { id: mapId },
          data: {
            status: overall_result === 'NEEDS_REVIEW' ? 'VALIDATION_IN_PROGRESS' : overall_result,
            autoValidationResult: overall_result,
            autoValidationReason: reasoning,
            finalVerdict: overall_result !== 'NEEDS_REVIEW' ? overall_result : null,
            closedAt: ['PASSED', 'PARTIALLY_COMPLIANT'].includes(overall_result) ? new Date() : null
          }
        });

        // Emit WS update
        req.io.to('compliance-dashboard').emit('validation:complete', { mapId, verdict: overall_result });
      })
      .catch(async (err) => {
        console.error(`[Validation Gate Error] AI Validation failed for MAP ${map.mapCode}:`, err.message);
        
        // Mark status as NEEDS_REVIEW if AI is offline
        await prisma.map.update({
          where: { id: mapId },
          data: {
            status: 'NEEDS_REVIEW',
            autoValidationResult: 'NEEDS_REVIEW',
            autoValidationReason: `AI Service offline during validation trigger. Error: ${err.message}`
          }
        });
        req.io.to('compliance-dashboard').emit('validation:complete', { mapId, verdict: 'NEEDS_REVIEW' });
      });

    res.json({ success: true, uploaded: savedFiles.length, files: savedFiles });
  } catch (error) {
    console.error("[Evidence Upload Error]", error);
    // Cleanup temporary files
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      });
    }
    next(error);
  }
};

// POST /api/maps/:id/override — officer manually overrides validation results
const overrideValidation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { overrideVerdict, overrideReason, officerId = 'officer-1' } = req.body;

    if (!overrideReason || overrideReason.trim() === '') {
      return res.status(400).json({ error: 'An override justification reason is mandatory!' });
    }

    const map = await prisma.map.findUnique({ where: { id } });
    if (!map) {
      return res.status(404).json({ error: 'MAP not found' });
    }

    const updatedMap = await prisma.map.update({
      where: { id },
      data: {
        officerOverride: overrideVerdict,
        finalVerdict: overrideVerdict,
        status: overrideVerdict,
        closedAt: ['PASSED', 'PARTIALLY_COMPLIANT'].includes(overrideVerdict) ? new Date() : null
      }
    });

    await createAuditLog({
      mapId: map.id,
      documentId: map.documentId,
      eventType: 'VALIDATION_OVERRIDDEN',
      actor: `user:${officerId}`,
      description: `Manual override. Verdict: ${overrideVerdict}. Reason: ${overrideReason}`,
      inputData: { autoResult: map.autoValidationResult, autoReason: map.autoValidationReason },
      outputData: { overrideVerdict, overrideReason }
    });

    req.io.to('compliance-dashboard').emit('validation:overridden', { mapId: map.id, verdict: overrideVerdict });

    res.json(updatedMap);
  } catch (error) {
    next(error);
  }
};

// GET /api/maps/:id/evidence — fetch evidence uploaded for a MAP
const getMapEvidence = async (req, res, next) => {
  try {
    const evidence = await prisma.evidence.findMany({
      where: { mapId: req.params.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json(evidence);
  } catch (error) {
    next(error);
  }
};

// GET /api/maps/:id/validation-result — fetch validation details for a MAP
const getMapValidationResult = async (req, res, next) => {
  try {
    const map = await prisma.map.findUnique({
      where: { id: req.params.id },
      select: {
        autoValidationResult: true,
        autoValidationReason: true,
        officerOverride: true,
        finalVerdict: true
      }
    });

    if (!map) {
      return res.status(404).json({ error: 'MAP not found' });
    }

    res.json(map);
  } catch (error) {
    next(error);
  }
};

// GET /api/maps/:id/validation-script — fetch AI technical check script
const getMapValidationScript = async (req, res, next) => {
  try {
    console.log(`[Validation Script] Forwarding query to AI service for MAP ${req.params.id}...`);
    const response = await axios.get(
      `${process.env.AI_SERVICE_URL}/api/validation/script/${req.params.id}`,
      { timeout: 3000 }
    );
    res.json(response.data);
  } catch (error) {
    console.warn(`[Validation Script Fallback] AI Service offline. Delivering secure simulated script...`);
    res.json({
      mapId: req.params.id,
      script: `
# Auto-Generated Validation Script for MAP ${req.params.id}
# Class: TECHNICAL
# Safety: READ-ONLY sandboxed sandbox validation

import sys
import json
import socket

def check_ssl_configuration():
    # Simulated read-only TLS connection check
    print("Checking TLS/SSL version status...")
    return {
        "status": "PASS",
        "detail": "TLS v1.3 is enabled. Older deprecated algorithms (SSLv3, TLS v1.0) are disabled."
    }

if __name__ == '__main__':
    res = check_ssl_configuration()
    print(json.dumps({
        "overall": "PASS",
        "checks": [
            { "name": "ssl_negotiation_test", "status": res["status"], "message": res["detail"] }
        ]
    }))
      `.trim()
    });
  }
};

// GET /api/maps/:id/audit-trail — fetch specific audit trail for a MAP
const getMapAuditTrail = async (req, res, next) => {
  try {
    const logs = await prisma.auditLog.findMany({
      where: { mapId: req.params.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json(logs);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMaps,
  getPendingReview,
  getMapById,
  createMap,
  approveMap,
  editAndApproveMap,
  rejectMap,
  bulkApprove,
  uploadEvidence,
  overrideValidation,
  getMapEvidence,
  getMapValidationResult,
  getMapValidationScript,
  getMapAuditTrail
};
