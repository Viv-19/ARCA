export interface Department {
  id: string;
  name: string;
  email: string;
  score: number;
  riskLevel: string;
  overdueCount: number;
  atRiskCount: number;
}

export interface Alert {
  id: string;
  alertType: string;
  severity: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  eventType: string;
  actor: string;
  description: string;
  createdAt: string;
}

export interface MAP {
  id: string;
  mapCode: string;
  title: string;
  description: string;
  obligationType: string;
  classification: string;
  regulatoryKeywords: string[];
  deliverable: string;
  deadline: string;
  priority: string;
  riskLevel: string;
  riskDescription: string;
  evidenceRequired: string[];
  document: any;
  sectionReference?: string;
  department?: Department;
  departmentId?: string;
  jiraTicketId?: string;
  status: string;
  autoValidationResult?: string;
  autoValidationReason?: string;
  officerOverride?: string;
  finalVerdict?: string;
  confidenceScore: number;
  flaggedForReview: boolean;
  flagReason?: string;
  reasoningChain?: string;
  createdAt: string;
}

export interface Document {
  id: string;
  title: string;
  // Regulator field — used by both registry (department) and Prisma (regulator)
  regulator: string;
  department?: string;

  // Prisma / backend camelCase fields
  documentId?: string;
  documentType?: string;
  publicationDate?: string;
  sourceHash?: string;
  contentHash?: string;
  pdfUrl?: string;
  localFilePath?: string;
  extractedText?: string;
  draftData?: string;
  ingestionMethod?: string;
  uploadedBy?: string;
  createdAt?: string;

  // AI Registry snake_case fields (from FastAPI scraper service)
  publication_date?: string;
  circular_number?: string;
  detail_url?: string;
  pdf_path?: string;
  metadata_path?: string;
  markdown_path?: string;
  meant_for?: string;
  metadata_hash?: string;

  status: string;
}
