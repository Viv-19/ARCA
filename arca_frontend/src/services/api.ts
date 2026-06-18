import axios from 'axios';
import type { Department, MAP, Document } from '../types';

export const BACKEND_URL = 'http://127.0.0.1:3001';
export const AI_URL = 'http://127.0.0.1:8000';

// Axios instance configured for Express Node.js Backend
const backendApi = axios.create({
  baseURL: BACKEND_URL,
});

// Axios instance configured for FastAPI AI Service
const aiApi = axios.create({
  baseURL: AI_URL,
});

export const api = {
  // Dashboard & Metrics
  getDashboardMetrics: async () => {
    const res = await backendApi.get('/api/risk/dashboard');
    return res.data;
  },

  getDepartments: async () => {
    const res = await backendApi.get('/api/departments');
    return res.data as Department[];
  },

  // Alerts
  scanAlerts: async () => {
    const res = await backendApi.post('/api/alerts/scan');
    return res.data;
  },

  markAlertRead: async (id: string) => {
    const res = await backendApi.put(`/api/alerts/${id}/read`);
    return res.data;
  },

  // MAPs (Actionable Compliance Tasks)
  getAllMAPs: async (limit = 100) => {
    const res = await backendApi.get(`/api/maps?limit=${limit}`);
    return res.data;
  },

  getDeptMAPs: async (deptId: string) => {
    const res = await backendApi.get(`/api/departments/${deptId}/maps`);
    return res.data as MAP[];
  },

  approveMap: async (id: string, approvedBy: string, notes: string) => {
    const res = await backendApi.put(`/api/maps/${id}/approve`, { approvedBy, notes });
    return res.data;
  },

  rejectMap: async (id: string, rejectedBy: string, reason: string) => {
    const res = await backendApi.put(`/api/maps/${id}/reject`, { rejectedBy, reason });
    return res.data;
  },

  editMap: async (
    id: string,
    data: {
      fieldsToUpdate: {
        title: string;
        description: string;
        deliverable: string;
        deadline: string;
        priority: string;
        departmentId: string | null;
      };
      editReason: string;
      editedBy: string;
    }
  ) => {
    const res = await backendApi.put(`/api/maps/${id}/edit`, data);
    return res.data;
  },

  approveBulk: async (mapIds: string[]) => {
    const res = await backendApi.post('/api/maps/approve-bulk', { mapIds });
    return res.data;
  },

  // Evidence & Overrides
  uploadEvidence: async (id: string, formData: FormData) => {
    const res = await backendApi.post(`/api/maps/${id}/evidence`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  getValidationScript: async (id: string) => {
    const res = await backendApi.get(`/api/maps/${id}/validation-script`);
    return res.data;
  },

  getAuditTrail: async (id: string) => {
    const res = await backendApi.get(`/api/maps/${id}/audit-trail`);
    return res.data;
  },

  overrideValidation: async (
    id: string,
    data: {
      overrideVerdict: string;
      overrideReason: string;
      officerId: string;
    }
  ) => {
    const res = await backendApi.post(`/api/maps/${id}/override`, data);
    return res.data;
  },

  // Ingestion & Documents
  getDocuments: async (limit = 100) => {
    const res = await backendApi.get(`/api/documents?limit=${limit}`);
    return res.data;
  },

  uploadDocument: async (formData: FormData) => {
    const res = await backendApi.post('/api/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  triggerPipeline: async (docId: string) => {
    const res = await backendApi.post(`/api/documents/${docId}/trigger-pipeline`);
    return res.data;
  },

  deleteDocument: async (docId: string) => {
    const res = await backendApi.delete(`/api/documents/${docId}`);
    return res.data;
  },

  // Scraper Service (AI FastAPI Backend)
  getScraperStatus: async () => {
    const res = await aiApi.get('/api/scraper/status');
    return res.data;
  },

  triggerScraper: async () => {
    const res = await aiApi.post('/api/scraper/trigger');
    return res.data;
  },

  // Stepper-driven Interactive Pipeline
  startPipeline: async (id: string) => {
    const res = await backendApi.post(`/api/pipeline/start/${id}`);
    return res.data;
  },

  confirmMaps: async (id: string, maps: any[]) => {
    const res = await backendApi.post(`/api/pipeline/confirm-maps/${id}`, { maps });
    return res.data;
  },

  finalizePipeline: async (id: string, maps: any[]) => {
    const res = await backendApi.post(`/api/pipeline/finalize/${id}`, { maps });
    return res.data;
  },

  publishPipeline: async (id: string) => {
    const res = await backendApi.post(`/api/pipeline/publish/${id}`);
    return res.data;
  },
};
