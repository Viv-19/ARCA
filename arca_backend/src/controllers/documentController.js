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

// POST /api/documents/upload — officer uploads PDF (saves, calls AI process, and creates record)
const uploadDocument = async (req, res, next) => {
  try {
    const { file } = req;
    if (!file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const { regulator = 'RBI', documentType = 'circular', uploadedBy = 'officer-1' } = req.body;

    console.log(`[Manual Upload] Forwarding ${file.originalname} to AI service at ${process.env.AI_SERVICE_URL}...`);

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
      `${process.env.AI_SERVICE_URL}/api/documents/process`,
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

    // Trigger AI pipeline automatically to generate MAPs
    console.log(`[Manual Upload] Triggering MAP Generation pipeline for Document: ${doc.id}...`);
    axios.post(`${process.env.AI_SERVICE_URL}/api/pipeline/run`, {
      document_id: doc.id,
      extracted_text: doc.extractedText,
      publication_date: doc.publicationDate
    }).catch(err => {
      console.error("[Manual Ingestion] Failed to auto-trigger LangGraph pipeline:", err.message);
    });

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

module.exports = {
  getDocuments,
  createDocument,
  getDocumentById,
  updateDocumentStatus,
  uploadDocument
};
