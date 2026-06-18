const prisma = require('../config/prisma');
const axios = require('axios');

const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// Helper to create audit logs
const createAuditLog = async ({ mapId, documentId, eventType, actor, description }) => {
  try {
    return await prisma.auditLog.create({
      data: {
        mapId,
        documentId,
        eventType,
        actor,
        description
      }
    });
  } catch (error) {
    console.error("[Audit Log Error]", error);
  }
};

// POST /api/pipeline/start/:id
const startPipeline = async (req, res, next) => {
  try {
    const { id } = req.params;
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Update status to PROCESSING_STAGE1
    const processingDoc = await prisma.document.update({
      where: { id },
      data: { status: "PROCESSING_STAGE1" }
    });
    req.io.to('compliance-dashboard').emit('document:status', processingDoc);

    console.log(`[Pipeline Controller] Triggering Stage 1 for Document ${id}...`);

    // Call FastAPI stage1
    const aiResponse = await axios.post(`${AI_URL}/api/pipeline/stage1`, {
      extracted_text: doc.extractedText || "",
      publication_date: doc.publicationDate ? doc.publicationDate.toISOString().split('T')[0] : null
    });

    const { analysis, inventory_result, generated_maps } = aiResponse.data;

    // Save to draftData JSON string
    const draftData = JSON.stringify({
      analysis,
      inventory_result,
      generated_maps
    });

    const finalizedDoc = await prisma.document.update({
      where: { id },
      data: {
        status: "DRAFT_MAPS_GENERATED",
        draftData
      }
    });

    req.io.to('compliance-dashboard').emit('document:status', finalizedDoc);
    res.json({ success: true, document: finalizedDoc });
  } catch (error) {
    console.error("[Pipeline Start Error]", error.message);
    await prisma.document.update({
      where: { id: req.params.id },
      data: { status: "FAILED" }
    }).catch(() => {});
    next(error);
  }
};

// POST /api/pipeline/confirm-maps/:id
const confirmMaps = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { maps } = req.body; // Array of maps updated by officer

    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Update status to PROCESSING_STAGE2
    const processingDoc = await prisma.document.update({
      where: { id },
      data: { status: "PROCESSING_STAGE2" }
    });
    req.io.to('compliance-dashboard').emit('document:status', processingDoc);

    console.log(`[Pipeline Controller] Triggering Stage 2 for Document ${id} with ${maps.length} MAPs...`);

    // Call FastAPI stage2 (department routing)
    const aiResponse = await axios.post(`${AI_URL}/api/pipeline/stage2`, {
      maps
    });

    const { routing_results } = aiResponse.data;

    // Fetch all departments for matching
    const depts = await prisma.department.findMany();

    // Merge routing results and map to department IDs
    const routedMaps = maps.map(map_obj => {
      // Find matching routing result by title
      const routing = routing_results.find(r => r.map_title === map_obj.title);
      let departmentId = map_obj.departmentId || null;
      let routingJustification = "";

      if (routing && !departmentId) {
        // Match department name from routing
        const matchedDept = depts.find(d => d.name.toLowerCase() === routing.department.toLowerCase());
        if (matchedDept) {
          departmentId = matchedDept.id;
        }
        routingJustification = routing.justification || "";
      }

      return {
        ...map_obj,
        departmentId,
        routingJustification
      };
    });

    // Save back to draftData JSON string
    const draft = JSON.parse(doc.draftData || '{}');
    draft.generated_maps = routedMaps;

    const finalizedDoc = await prisma.document.update({
      where: { id },
      data: {
        status: "DRAFT_MAPS_ROUTED",
        draftData: JSON.stringify(draft)
      }
    });

    req.io.to('compliance-dashboard').emit('document:status', finalizedDoc);
    res.json({ success: true, document: finalizedDoc });
  } catch (error) {
    console.error("[Pipeline Confirm Maps Error]", error.message);
    await prisma.document.update({
      where: { id: req.params.id },
      data: { status: "FAILED" }
    }).catch(() => {});
    next(error);
  }
};

// POST /api/pipeline/finalize/:id
const finalizePipeline = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { maps } = req.body; // Final maps with departments selected by officer

    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Update status to PROCESSING_STAGE3
    const processingDoc = await prisma.document.update({
      where: { id },
      data: { status: "PROCESSING_STAGE3" }
    });
    req.io.to('compliance-dashboard').emit('document:status', processingDoc);

    console.log(`[Pipeline Controller] Triggering Stage 3 for Document ${id} with ${maps.length} MAPs...`);

    // Call FastAPI stage3 (Risk + Validation Scripts)
    const aiResponse = await axios.post(`${AI_URL}/api/pipeline/stage3`, {
      maps
    });

    const { risk_assessment, scripts } = aiResponse.data;

    // Save draft data with final scripts & risk for preview
    const draft = JSON.parse(doc.draftData || '{}');
    draft.generated_maps = maps;
    draft.risk_assessment = risk_assessment;
    draft.scripts = scripts;

    const finalizedDoc = await prisma.document.update({
      where: { id },
      data: {
        status: "DRAFT_PIPELINE_FINALIZED",
        draftData: JSON.stringify(draft)
      }
    });

    req.io.to('compliance-dashboard').emit('document:status', finalizedDoc);
    res.json({ success: true, document: finalizedDoc, risk_assessment, scripts });
  } catch (error) {
    console.error("[Pipeline Finalize Error]", error.message);
    await prisma.document.update({
      where: { id: req.params.id },
      data: { status: "FAILED" }
    }).catch(() => {});
    next(error);
  }
};

// POST /api/pipeline/publish/:id
const publishPipeline = async (req, res, next) => {
  try {
    const { id } = req.params;
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    const draft = JSON.parse(doc.draftData || '{}');
    const maps = draft.generated_maps || [];

    console.log(`[Pipeline Controller] Publishing ${maps.length} MAPs to active boards for Document ${id}...`);

    const regulator = doc.regulator || 'REG';
    const year = doc.publicationDate ? new Date(doc.publicationDate).getFullYear() : new Date().getFullYear();

    // Iterate and write each individual MAP record
    for (let i = 0; i < maps.length; i++) {
      const map_obj = maps[i];

      // Generate unique map code matching mapController format
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
      
      let exists = await prisma.map.findUnique({ where: { mapCode: code } });
      while (exists) {
        finalCount++;
        code = `MAP-${regulator}-${year}-${String(finalCount + 1).padStart(3, '0')}`;
        exists = await prisma.map.findUnique({ where: { mapCode: code } });
      }

      await prisma.map.create({
        data: {
          mapCode: code,
          documentId: id,
          sectionReference: map_obj.sectionReference || map_obj.section_reference || "",
          rawTextExcerpt: map_obj.reasoningChain || map_obj.reasoning_chain || "",
          title: map_obj.title,
          description: map_obj.description,
          obligationType: map_obj.obligationType || map_obj.obligation_type || "MANDATORY",
          classification: map_obj.classification || "NON_TECHNICAL",
          regulatoryKeywords: map_obj.regulatoryKeywords ? JSON.stringify(map_obj.regulatoryKeywords) : JSON.stringify(map_obj.regulatory_keywords || []),
          deliverable: map_obj.deliverable || "",
          deadline: map_obj.deadline ? new Date(map_obj.deadline) : null,
          priority: map_obj.priority || "MEDIUM",
          riskLevel: map_obj.riskLevel || map_obj.risk_level || "MEDIUM",
          riskDescription: map_obj.riskDescription || map_obj.risk_description || "",
          evidenceRequired: map_obj.evidenceRequired ? JSON.stringify(map_obj.evidenceRequired) : JSON.stringify(map_obj.evidence_required || []),
          confidenceScore: map_obj.confidenceScore || map_obj.confidence_score || 0.9,
          flaggedForReview: map_obj.flaggedForReview || map_obj.flagged_for_review || false,
          flagReason: map_obj.flagReason || map_obj.flag_reason || "",
          reasoningChain: map_obj.reasoningChain || map_obj.reasoning_chain || "",
          modelUsed: "gpt-4o (ARCA multi-agent)",
          departmentId: map_obj.departmentId || null,
          status: "PENDING_REVIEW"
        }
      });
    }

    // Update document status to PROCESSED
    const finalDoc = await prisma.document.update({
      where: { id },
      data: { status: "PROCESSED" }
    });

    // Create audit log
    await createAuditLog({
      documentId: id,
      eventType: 'DOCUMENT_PROCESSED',
      actor: 'system:pipeline',
      description: `Document "${doc.title}" compliance analysis pipeline completed and published successfully by compliance officer.`
    });

    req.io.to('compliance-dashboard').emit('document:status', finalDoc);
    // Emit new map event to let UI refresh
    req.io.to('compliance-dashboard').emit('map:new', { id: 'dummy-refresh', mapCode: 'REFRESH' });

    res.json({ success: true, document: finalDoc });
  } catch (error) {
    console.error("[Pipeline Publish Error]", error.message);
    next(error);
  }
};

module.exports = {
  startPipeline,
  confirmMaps,
  finalizePipeline,
  publishPipeline
};
