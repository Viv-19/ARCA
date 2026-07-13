const prisma = require('../config/prisma');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

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

// GET /api/documents — list all with filters & pagination
const getDocuments = async (req, res, next) => {
  try {
    const { regulator, status, limit = 20, page = 1 } = req.query;
    const where = {};
    if (regulator) where.regulator = regulator;
    if (status) where.status = status;

    const parsedLimit = parseInt(limit);
    const parsedPage = parseInt(page);
    const skip = (parsedPage - 1) * parsedLimit;

    const total = await prisma.document.count({ where });
    const documents = await prisma.document.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parsedLimit,
      skip: skip,
      include: {
        _count: {
          select: { maps: true }
        }
      }
    });

    res.json({
      documents,
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

// POST /api/documents — create document record (called by AI service after automated scraping)
const createDocument = async (req, res, next) => {
  try {
    const docData = req.body;
    
    // Check for sourceHash deduplication
    const existing = await prisma.document.findUnique({
      where: { sourceHash: docData.sourceHash }
    });

    if (existing) {
      return res.status(409).json({ error: "Document already exists (duplicate hash)", document: existing });
    }

    const doc = await prisma.document.create({ data: docData });

    // Log the event
    await createAuditLog({
      documentId: doc.id,
      eventType: 'DOCUMENT_INGESTED',
      actor: 'system:scraper',
      description: `Document "${doc.title}" automatically ingested from ${doc.regulator}.`
    });

    // Emit event to dashboard
    req.io.to('compliance-dashboard').emit('document:new', doc);

    res.status(201).json(doc);
  } catch (error) {
    next(error);
  }
};

// GET /api/documents/:id — fetch single document details with its MAPs
const getDocumentById = async (req, res, next) => {
  try {
    const doc = await prisma.document.findUnique({
      where: { id: req.params.id },
      include: {
        maps: {
          include: { department: true }
        }
      }
    });

    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json(doc);
  } catch (error) {
    next(error);
  }
};

// PUT /api/documents/:id/status — update document status
const updateDocumentStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const doc = await prisma.document.update({
      where: { id: req.params.id },
      data: { status }
    });

    await createAuditLog({
      documentId: doc.id,
      eventType: 'DOCUMENT_STATUS_UPDATED',
      actor: 'system:pipeline',
      description: `Document status updated to ${status}`
    });

    res.json(doc);
  } catch (error) {
    next(error);
  }
};

// PUT /api/documents/:id/draft — save session state (draftData) without finalizing
const updateDocumentDraft = async (req, res, next) => {
  try {
    const { draftData, status } = req.body;
    
    // Only update fields that are provided
    const dataToUpdate = {};
    if (draftData !== undefined) dataToUpdate.draftData = draftData;
    if (status !== undefined) dataToUpdate.status = status;

    const doc = await prisma.document.update({
      where: { id: req.params.id },
      data: dataToUpdate
    });

    await createAuditLog({
      documentId: doc.id,
      eventType: 'DOCUMENT_DRAFT_SAVED',
      actor: 'system:pipeline',
      description: `User saved pipeline session state for Document ${req.params.id}. Status: ${doc.status}`
    });

    res.json({ success: true, document: doc });
  } catch (error) {
    console.error("[Update Draft Error]", error);
    next(error);
  }
};

// POST /api/documents/upload — officer uploads PDF (saves, calls AI process, and creates record)
const uploadDocument = async (req, res, next) => {
  try {
    const { file } = req;
    if (!file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const { regulator = 'RBI', documentType = 'circular', uploadedBy = 'officer-1' } = req.body;

    const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    console.log(`[Manual Upload] Forwarding ${file.originalname} to AI service at ${AI_SERVICE_URL}...`);

    // Prepare multipart form data for AI service
    const formData = new FormData();
    formData.append('file', fs.createReadStream(file.path), {
      filename: file.originalname,
      contentType: file.mimetype
    });
    formData.append('regulator', regulator);
    formData.append('document_type', documentType);

    // Call FastAPI /api/documents/process
    const aiResponse = await axios.post(
      `${AI_SERVICE_URL}/api/documents/process`,
      formData,
      {
        headers: {
          ...formData.getHeaders()
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );

    console.log(`[Manual Upload] Received extraction response from AI service:`, aiResponse.data);

    const extractedData = aiResponse.data;

    // Check for sourceHash deduplication
    const existing = await prisma.document.findUnique({
      where: { sourceHash: extractedData.sourceHash }
    });

    if (existing) {
      // Cleanup uploaded temp file
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(409).json({ error: "Document already exists (duplicate hash)", document: existing });
    }

    // Save PDF permanently into uploads folder
    const permanentFolder = path.join(__dirname, '../../uploads/documents');
    if (!fs.existsSync(permanentFolder)) {
      fs.mkdirSync(permanentFolder, { recursive: true });
    }
    const permanentPath = path.join(permanentFolder, `${Date.now()}_${file.originalname}`);
    fs.copyFileSync(file.path, permanentPath);
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

    // Save document record to PostgreSQL
    const doc = await prisma.document.create({
      data: {
        title: extractedData.title || file.originalname.replace('.pdf', ''),
        regulator: regulator,
        documentId: extractedData.documentId || null,
        documentType: documentType,
        publicationDate: extractedData.publicationDate ? new Date(extractedData.publicationDate) : null,
        sourceHash: extractedData.sourceHash,
        contentHash: extractedData.contentHash || null,
        pdfUrl: extractedData.pdfUrl || null,
        localFilePath: permanentPath,
        extractedText: extractedData.extractedText || "",
        status: "INGESTED",
        ingestionMethod: 'MANUAL_UPLOAD',
        uploadedBy: uploadedBy
      }
    });

    // Log the upload action
    await createAuditLog({
      documentId: doc.id,
      eventType: 'DOCUMENT_UPLOADED',
      actor: `user:${uploadedBy}`,
      description: `Document "${doc.title}" manually uploaded and processed.`
    });

    // Emit event to dashboard
    req.io.to('compliance-dashboard').emit('document:new', doc);

    res.status(201).json(doc);
  } catch (error) {
    console.error("[Manual Upload Error]", error);
    // Cleanup uploaded temp file in case of error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(error);
  }
};

// POST /api/documents/:id/trigger-pipeline — manually run pipeline on document
const triggerPipeline = async (req, res, next) => {
  try {
    let doc = await prisma.document.findUnique({
      where: { id: req.params.id }
    });

    if (!doc) {
      // If it's a scraped document from the AI service, we need to fetch it from AI service and create it here!
      try {
        const aiDocRes = await axios.get(`${process.env.AI_SERVICE_URL || 'http://localhost:8000'}/api/registry/documents/${req.params.id}`);
        if (aiDocRes.data) {
          const aiDoc = aiDocRes.data;
          doc = await prisma.document.create({
            data: {
              id: aiDoc.id,
              title: aiDoc.title,
              regulator: aiDoc.department || 'RBI',
              documentId: aiDoc.circular_number,
              documentType: 'circular',
              publicationDate: aiDoc.publication_date ? new Date(aiDoc.publication_date) : new Date(),
              sourceHash: aiDoc.metadata_hash || `hash_${aiDoc.id}`,
              contentHash: aiDoc.pdf_hash,
              pdfUrl: aiDoc.detail_url,
              localFilePath: aiDoc.pdf_path,
              status: "INGESTED"
            }
          });
        } else {
          return res.status(404).json({ error: "Document not found in registry" });
        }
      } catch (err) {
        console.error("[Manual Trigger Error] Failed to sync missing document:", err);
        return res.status(500).json({ error: "Failed to sync document to Prisma: " + err.message });
      }
    }

    // Update status to PROCESSING_STAGE1
    const updatedDoc = await prisma.document.update({
      where: { id: doc.id },
      data: { status: "PROCESSING_STAGE1" }
    });

    // Emit Socket event to update UI immediately
    req.io.to('compliance-dashboard').emit('document:status', updatedDoc);

    console.log(`[Manual Trigger] Dispatching document "${doc.title}" to AI pipeline...`);

    // Trigger AI pipeline in the background so HTTP response is fast
    axios.post(`${process.env.AI_SERVICE_URL || 'http://localhost:8000'}/api/pipeline/run`, {
      document_id: doc.id,
      extracted_text: doc.extractedText || "",
      publication_date: doc.publicationDate ? doc.publicationDate.toISOString() : null
    }).then(async (aiRes) => {
      console.log(`[Manual Trigger] AI pipeline completed for Document ${doc.id}`);
      
      // Update status to PROCESSED
      const finalDoc = await prisma.document.update({
        where: { id: doc.id },
        data: { status: "PROCESSED" }
      });
      req.io.to('compliance-dashboard').emit('document:status', finalDoc);

      // Create audit log
      await createAuditLog({
        documentId: doc.id,
        eventType: 'DOCUMENT_PROCESSED',
        actor: 'system:pipeline',
        description: `Document "${doc.title}" compliance analysis pipeline completed successfully.`
      });
    }).catch(async (err) => {
      console.error(`[Manual Trigger Error] AI pipeline failed:`, err.message);
      const failedDoc = await prisma.document.update({
        where: { id: doc.id },
        data: { status: "FAILED" }
      });
      req.io.to('compliance-dashboard').emit('document:status', failedDoc);
    });

    res.json({ message: "Pipeline run triggered", document: updatedDoc });
  } catch (error) {
    next(error);
  }
};

// GET /api/documents/:id/file — download/view local document PDF/TXT file
const downloadDocumentFile = async (req, res, next) => {
  try {
    const doc = await prisma.document.findUnique({
      where: { id: req.params.id }
    });
    if (!doc || !doc.localFilePath) {
      return res.status(404).json({ error: "File not found" });
    }
    const absolutePath = path.resolve(doc.localFilePath);
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ error: "File does not exist on disk" });
    }
    res.sendFile(absolutePath);
  } catch (error) {
    next(error);
  }
};

// PUT /api/documents/:id/reset-pipeline — reset pipeline session, keep document
const resetPipelineSession = async (req, res, next) => {
  try {
    const { id } = req.params;

    const doc = await prisma.document.findUnique({
      where: { id },
      include: {
        maps: { include: { evidenceFiles: true } }
      }
    });

    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    await prisma.$transaction(async (tx) => {
      const mapIds = doc.maps.map(m => m.id);

      if (mapIds.length > 0) {
        await tx.alert.deleteMany({ where: { mapId: { in: mapIds } } });
        await tx.evidence.deleteMany({ where: { mapId: { in: mapIds } } });
        await tx.auditLog.deleteMany({ where: { mapId: { in: mapIds } } });
        await tx.map.deleteMany({ where: { documentId: id } });
      }

      // Clear pipeline-specific audit logs but keep upload/ingest logs
      await tx.auditLog.deleteMany({
        where: {
          documentId: id,
          eventType: { in: ['DOCUMENT_DRAFT_SAVED', 'DOCUMENT_PROCESSED', 'DOCUMENT_STATUS_UPDATED'] }
        }
      });

      await tx.document.update({
        where: { id },
        data: { draftData: null, status: 'INGESTED' }
      });
    });

    await createAuditLog({
      documentId: id,
      eventType: 'PIPELINE_SESSION_RESET',
      actor: 'user:officer',
      description: `Pipeline session for "${doc.title}" was reset to INGESTED state.`
    });

    req.io.to('compliance-dashboard').emit('document:status', { id, status: 'INGESTED' });

    res.json({ success: true, message: `Pipeline session for "${doc.title}" reset successfully.` });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/documents/:id — delete document, related maps, evidence, and clear AI memory
const deleteDocument = async (req, res, next) => {
  try {
    const { id } = req.params;

    // 1. Find document
    const doc = await prisma.document.findUnique({
      where: { id },
      include: {
        maps: {
          include: {
            evidenceFiles: true
          }
        }
      }
    });

    if (!doc) {
      // Not in Prisma — try the AI registry directly (scraped-only documents)
      try {
        const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
        await axios.delete(`${AI_SERVICE_URL}/api/registry/documents/${id}`);
        req.io.to('compliance-dashboard').emit('document:deleted', { id });
        return res.json({ success: true, message: 'Document deleted from AI registry.' });
      } catch (aiErr) {
        return res.status(404).json({ error: 'Document not found in any system' });
      }
    }
    
    // 2. Perform Prisma Transaction to delete related child records
    await prisma.$transaction(async (tx) => {
      const mapIds = doc.maps.map(m => m.id);
      
      // Delete Alerts for those MAPs
      if (mapIds.length > 0) {
        await tx.alert.deleteMany({
          where: { mapId: { in: mapIds } }
        });
        
        // Delete Evidence records
        await tx.evidence.deleteMany({
          where: { mapId: { in: mapIds } }
        });
        
        // Delete Audit logs for those MAPs
        await tx.auditLog.deleteMany({
          where: { mapId: { in: mapIds } }
        });
      }
      
      // Delete Audit logs for the document itself
      await tx.auditLog.deleteMany({
        where: { documentId: id }
      });
      
      // Delete Maps
      await tx.map.deleteMany({
        where: { documentId: id }
      });
      
      // Delete Document
      await tx.document.delete({
        where: { id }
      });
    });
    
    // 3. Delete physical PDF file if it exists
    if (doc.localFilePath && fs.existsSync(doc.localFilePath)) {
      try {
        fs.unlinkSync(doc.localFilePath);
        console.log(`[Delete Document] Deleted physical file: ${doc.localFilePath}`);
      } catch (err) {
        console.error(`[Delete Document Warning] Failed to delete file on disk: ${err.message}`);
      }
    }
    
    // 4. Call FastAPI AI Service to clear its memory/embeddings
    try {
      let filename = null;
      if (doc.localFilePath) {
        filename = path.basename(doc.localFilePath);
        // Strip out the timestamp prefix (e.g. 1718712312_filename.pdf) if present to match FastAPI upload
        const match = filename.match(/^\d+_(.+)$/);
        if (match) {
          filename = match[1];
        }
      }
      
      const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
      console.log(`[Delete Document] Requesting FastAPI to delete memory for ID: ${id}`);
      await axios.delete(`${AI_SERVICE_URL}/api/documents/${id}`, {
        params: { filename }
      });
    } catch (err) {
      console.error(`[Delete Document Warning] Failed to clear AI memory: ${err.message}`);
    }
    
    // 5. Emit socket event
    req.io.to('compliance-dashboard').emit('document:deleted', { id });
    
    res.json({ success: true, message: `Document "${doc.title}" deleted from system and memory successfully.` });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDocuments,
  createDocument,
  getDocumentById,
  updateDocumentStatus,
  updateDocumentDraft,
  uploadDocument,
  triggerPipeline,
  downloadDocumentFile,
  deleteDocument,
  resetPipelineSession
};
