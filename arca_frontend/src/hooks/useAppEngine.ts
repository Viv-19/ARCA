import React, { useState, useEffect, useCallback } from 'react';
import type { Department, Alert, AuditLog, MAP, Document } from '../types';
import { api } from '../services/api';
import { useDashboardSocket } from './useDashboardSocket';

export function useAppEngine() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'review' | 'tracker' | 'portal' | 'ingestion' | 'workbench' | 'library' | 'sessions'>('dashboard');

  // Dashboard state
  const [overallScore, setOverallScore] = useState<number>(100);
  const [totalActive, setTotalActive] = useState<number>(0);
  const [totalOverdue, setTotalOverdue] = useState<number>(0);
  const [totalAtRisk, setTotalAtRisk] = useState<number>(0);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([]);

  // All Maps for trackers
  const [allMaps, setAllMaps] = useState<MAP[]>([]);
  const [bulkList, setBulkList] = useState<string[]>([]);

  // Department Portal state
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [deptMaps, setDeptMaps] = useState<MAP[]>([]);
  const [evidenceFiles, setEvidenceFiles] = useState<FileList | null>(null);
  const [evidenceNotes, setEvidenceNotes] = useState<string>('');
  const [evidenceType, setEvidenceType] = useState<string>('other');

  // Ingestion Hub state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [scraperStatus, setScraperStatus] = useState<any>({ status: 'IDLE', logs: [] });
  const [intakeStatus, setIntakeStatus] = useState<any>({ status: 'IDLE', logs: [] });
  const [manualRegulator, setManualRegulator] = useState<string>('RBI');
  const [manualType, setManualType] = useState<string>('circular');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [allDocsModalOpen, setAllDocsModalOpen] = useState<boolean>(false);
  const [pipelineProgress, setPipelineProgress] = useState<Record<string, string>>({});
  const [backendDocuments, setBackendDocuments] = useState<Document[]>([]);

  // Modals and Active Selections
  const [activeMap, setActiveMap] = useState<MAP | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);

  // Edit MAP form fields
  const [editFields, setEditFields] = useState({
    title: '',
    description: '',
    deliverable: '',
    deadline: '',
    priority: 'MEDIUM',
    departmentId: '',
    editReason: 'Manual parameter calibration for Demo circular requirements',
  });

  // Override Form fields
  const [overrideVerdict, setOverrideVerdict] = useState<string>('PASSED');
  const [overrideReason, setOverrideReason] = useState<string>('');

  // Technical script and audit trail cache
  const [validationScript, setValidationScript] = useState<string>('');
  const [mapAuditLogs, setMapAuditLogs] = useState<AuditLog[]>([]);

  // Agent Workbench State
  const [activePipelineDocId, setActivePipelineDocId] = useState<string | null>(null);
  const [workbenchStep, setWorkbenchStep] = useState<number>(1);
  const [draftMapsList, setDraftMapsList] = useState<any[]>([]);
  const [executiveSummary, setExecutiveSummary] = useState<string>('');
  const [riskScore, setRiskScore] = useState<number>(0);
  const [conflictAlerts, setConflictAlerts] = useState<string[]>([]);
  const [generatedScripts, setGeneratedScripts] = useState<any[]>([]);
  const [pendingMapsData, setPendingMapsData] = useState<any[]>([]);
  const [mapsLoading, setMapsLoading] = useState<boolean>(false);
  const [confirmingMaps, setConfirmingMaps] = useState<boolean>(false);
  const [confirmingRouting, setConfirmingRouting] = useState<boolean>(false);

  // Toast notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Fetch Master Dashboard metrics
  const fetchDashboard = useCallback(async () => {
    try {
      const data = await api.getDashboardMetrics();
      setOverallScore(data.overallScore);
      setTotalActive(data.totalActiveMAPs);
      setTotalOverdue(data.totalOverdueMAPs);
      setTotalAtRisk(data.totalAtRiskMAPs);
      setDepartments(data.departments || []);
      setAlerts(data.activeAlerts || []);
      setRecentLogs(data.recentActivity || []);
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    }
  }, []);

  // Fetch all maps list
  const fetchAllMaps = useCallback(async () => {
    try {
      const data = await api.getAllMAPs(100);
      setAllMaps(data.maps || []);
    } catch (err) {
      console.error('Failed to load all maps:', err);
    }
  }, []);

  // Fetch maps assigned to selected Department
  const fetchDeptMaps = useCallback(async (deptId: string) => {
    if (!deptId) return;
    try {
      const maps = await api.getDeptMAPs(deptId);
      setDeptMaps(maps);
    } catch (err) {
      console.error('Failed to load department maps:', err);
    }
  }, []);

  // Fetch scraper status
  const fetchScraper = useCallback(async () => {
    try {
      const data = await api.getScraperStatus();
      setScraperStatus(data);
    } catch (err) {
      console.error('Failed to load scraper status:', err);
    }
  }, []);

  // Fetch intake status
  const fetchIntakeStatus = useCallback(async () => {
    try {
      const data = await api.getIntakeStatus();
      setIntakeStatus(data);
    } catch (err) {
      console.error('Failed to load intake status:', err);
    }
  }, []);

  // Fetch ingested documents (AI registry — scraper-managed circulars)
  const fetchDocuments = useCallback(async () => {
    try {
      const data = await api.getDocuments(100);
      setDocuments(data.documents || []);
    } catch (err) {
      console.error('Failed to load documents:', err);
    }
  }, []);

  // Fetch backend (Prisma) documents — these have draftData and pipeline statuses
  const fetchBackendDocuments = useCallback(async () => {
    try {
      const data = await api.getBackendDocuments(200);
      setBackendDocuments(data.documents || []);
    } catch (err) {
      console.error('Failed to load backend documents:', err);
    }
  }, []);

  // Socket setup
  const { isConnected, wsLogs } = useDashboardSocket({
    onMapNew: useCallback((data: any) => {
      setAllMaps((prev) => {
        if (prev.some((x) => x.id === data.id)) return prev;
        return [data, ...prev];
      });
      fetchDashboard();
      fetchDocuments();
    }, [fetchDashboard, fetchDocuments]),

    onMapApproved: useCallback((data: any) => {
      fetchDashboard();
      fetchAllMaps();
    }, [fetchDashboard, fetchAllMaps]),

    onEvidenceSubmitted: useCallback((data: any) => {
      fetchDashboard();
      fetchAllMaps();
      if (selectedDeptId) fetchDeptMaps(selectedDeptId);
    }, [fetchDashboard, fetchAllMaps, selectedDeptId, fetchDeptMaps]),

    onValidationComplete: useCallback((data: any) => {
      fetchDashboard();
      fetchAllMaps();
      if (selectedDeptId) fetchDeptMaps(selectedDeptId);
    }, [fetchDashboard, fetchAllMaps, selectedDeptId, fetchDeptMaps]),

    onDocumentNew: useCallback((data: any) => {
      setDocuments((prev) => {
        if (prev.some((d) => d.id === data.id)) return prev;
        return [data, ...prev];
      });
      fetchDashboard();
      fetchDocuments();
    }, [fetchDashboard, fetchDocuments]),

    onDocumentStatus: useCallback((data: any) => {
      setDocuments((prev) => prev.map((d) => (d.id === data.id ? data : d)));
      setBackendDocuments((prev) => prev.map((d) => (d.id === data.id ? data : d)));
      fetchAllMaps();
      fetchDashboard();
    }, [fetchDashboard, fetchAllMaps]),
  });

  // Initial Bootup trigger
  useEffect(() => {
    fetchDashboard();
    fetchAllMaps();
    fetchScraper();
    fetchIntakeStatus();
    fetchDocuments();
    fetchBackendDocuments();

    // Automatically select the first department if available
    api.getDepartments().then((data: any) => {
      if (data && data.length > 0) {
        setSelectedDeptId(data[0].id);
      }
    }).catch((e: any) => console.warn("No departments seeded yet:", e.message));
  }, [fetchDashboard, fetchAllMaps, fetchScraper, fetchIntakeStatus, fetchDocuments, fetchBackendDocuments]);

  useEffect(() => {
    if (selectedDeptId) {
      fetchDeptMaps(selectedDeptId);
    }
  }, [selectedDeptId, fetchDeptMaps]);

  // Poll scraper and intake status when running
  useEffect(() => {
    let interval: any;
    const isRunning = (scraperStatus && scraperStatus.status === 'RUNNING') || (intakeStatus && intakeStatus.status === 'RUNNING');
    if (isRunning) {
      interval = setInterval(() => {
        fetchScraper();
        fetchIntakeStatus();
        fetchDocuments();
      }, 1500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [scraperStatus?.status, intakeStatus?.status, fetchScraper, fetchIntakeStatus, fetchDocuments]);

  // Auto-save helper — useCallback so callers can safely list it as a dependency
  const autoSaveDraft = useCallback(async (maps: any[], summary: string, status: string, riskScoreVal?: number, conflictsVal?: string[], scriptsVal?: any[]) => {
    if (!activePipelineDocId) return;
    try {
      const draftData = {
        generated_maps: maps,
        analysis: { executive_summary: summary },
        risk_assessment: { system_risk_score: riskScoreVal ?? riskScore, conflicts: conflictsVal ?? conflictAlerts },
        scripts: scriptsVal ?? generatedScripts
      };
      await api.savePipelineDraft(activePipelineDocId, {
        draftData: JSON.stringify(draftData),
        status
      });
      fetchDocuments();
      fetchBackendDocuments();
    } catch (err) {
      console.warn('Auto-save failed:', err);
    }
  }, [activePipelineDocId, riskScore, conflictAlerts, generatedScripts, fetchDocuments, fetchBackendDocuments]);

  const handleSelectActiveDoc = async (docId: string | null) => {
    if (!docId) {
      setActivePipelineDocId(null);
      setDraftMapsList([]);
      setExecutiveSummary('');
      setRiskScore(0);
      setConflictAlerts([]);
      setGeneratedScripts([]);
      setPendingMapsData([]);
      setMapsLoading(false);
      return;
    }
    setActivePipelineDocId(docId);
    setPendingMapsData([]);
    setMapsLoading(false);

    try {
      // Fetch Prisma document directly — it carries draftData and pipeline statuses
      const doc = await api.getBackendDocumentById(docId);

      if (doc && doc.draftData) {
        // Restore saved session — no re-running the agent
        const draft = JSON.parse(doc.draftData);
        setExecutiveSummary(draft.analysis?.executive_summary || '');
        setRiskScore(draft.risk_assessment?.system_risk_score || 0);
        setConflictAlerts(draft.risk_assessment?.conflicts || []);
        setGeneratedScripts(draft.scripts || []);
        
        // Restore to correct step (5-step system)
        if (doc.status === 'PROCESSED') {
          setDraftMapsList(draft.generated_maps || []);
          setWorkbenchStep(5);
        } else if (doc.status === 'DRAFT_PIPELINE_FINALIZED') {
          setDraftMapsList(draft.generated_maps || []);
          setWorkbenchStep(5);
        } else if (doc.status === 'DRAFT_MAPS_ROUTED' || doc.status === 'PROCESSING_STAGE2' || doc.status === 'PROCESSING_STAGE3') {
          setDraftMapsList(draft.generated_maps || []);
          setWorkbenchStep(4);
        } else if (doc.status === 'DRAFT_MAPS_GENERATED') {
          setDraftMapsList(draft.generated_maps || []);
          setWorkbenchStep(3);
        } else if (doc.status === 'SUMMARY_GENERATED') {
          setDraftMapsList([]);
          setPendingMapsData(draft.generated_maps || []);
          setWorkbenchStep(2);
        } else {
          // Has draftData but unknown status — show summary
          setDraftMapsList([]);
          setPendingMapsData(draft.generated_maps || []);
          setWorkbenchStep(2);
        }
      } else {
        // No saved draft → fresh start, invoke the pipeline agent
        setWorkbenchStep(1);
        setDraftMapsList([]);
        setExecutiveSummary('');
        const startRes = await api.startPipeline(docId);
        if (startRes.success && startRes.document.draftData) {
          const draft = JSON.parse(startRes.document.draftData);
          setExecutiveSummary(draft.analysis?.executive_summary || '');
          // Store maps as pending — don't show yet
          setPendingMapsData(draft.generated_maps || []);
          setWorkbenchStep(2);
          // Auto-save summary state
          await autoSaveDraft(draft.generated_maps || [], draft.analysis?.executive_summary || '', 'SUMMARY_GENERATED');
        }
      }
    } catch (err) {
      showToast('Failed to resume pipeline: ' + err, 'error');
      setWorkbenchStep(1);
    }
  };

  // User clicks "Generate MAPs" — reveal the maps that were already computed
  // Capture values at call time so the closure inside setTimeout doesn't go stale
  const handleCreateMaps = useCallback(() => {
    if (!activePipelineDocId) return;
    setMapsLoading(true);
    const capturedMaps = pendingMapsData;
    const capturedSummary = executiveSummary;
    setTimeout(() => {
      setDraftMapsList(capturedMaps);
      setPendingMapsData([]);
      setMapsLoading(false);
      setWorkbenchStep(3);
      showToast('MAPs generated successfully.', 'success');
      autoSaveDraft(capturedMaps, capturedSummary, 'DRAFT_MAPS_GENERATED').catch(console.warn);
    }, 3000);
  }, [activePipelineDocId, pendingMapsData, executiveSummary, autoSaveDraft, showToast]);

  const handleConfirmMaps = async () => {
    if (!activePipelineDocId) return;
    setConfirmingMaps(true);
    try {
      const res = await api.confirmMaps(activePipelineDocId, draftMapsList);
      if (res.success && res.document.draftData) {
        const draft = JSON.parse(res.document.draftData);
        setDraftMapsList(draft.generated_maps || []);
        setWorkbenchStep(4);
        showToast('MAP candidates confirmed. AI department routing triggered.', 'success');
      } else {
        showToast('Failed to route MAPs. Draft data empty.', 'error');
      }
    } catch (err) {
      showToast('Failed to route MAPs: ' + err, 'error');
    } finally {
      setConfirmingMaps(false);
    }
  };

  const handleConfirmRouting = async () => {
    if (!activePipelineDocId) return;
    setConfirmingRouting(true);
    try {
      const res = await api.finalizePipeline(activePipelineDocId, draftMapsList);
      setRiskScore(res.risk_assessment?.system_risk_score || 0);
      setConflictAlerts(res.risk_assessment?.conflicts || []);
      setGeneratedScripts(res.scripts || []);
      setWorkbenchStep(5);
      showToast('Department routing confirmed. Systemic risk analysis complete.', 'success');
    } catch (err) {
      showToast('Failed to finalize routing: ' + err, 'error');
    } finally {
      setConfirmingRouting(false);
    }
  };

  const handlePublishPipeline = async () => {
    if (!activePipelineDocId) return;
    try {
      await api.publishPipeline(activePipelineDocId);
      showToast('Compliance circular successfully published! Operational controls populated.', 'success');
      setActivePipelineDocId(null);
      setDraftMapsList([]);
      setPendingMapsData([]);
      setWorkbenchStep(1);
      setActiveTab('sessions');
      fetchDashboard();
      fetchAllMaps();
      fetchDocuments();
      fetchBackendDocuments();
    } catch (err) {
      showToast('Failed to publish pipeline: ' + err, 'error');
    }
  };

  const handleSaveSession = async () => {
    if (!activePipelineDocId) return;
    try {
      const draftData = {
        generated_maps: draftMapsList.length > 0 ? draftMapsList : pendingMapsData,
        analysis: { executive_summary: executiveSummary },
        risk_assessment: { system_risk_score: riskScore, conflicts: conflictAlerts },
        scripts: generatedScripts
      };
      
      let statusToSave = 'PROCESSING_STAGE1';
      if (workbenchStep === 2) statusToSave = 'SUMMARY_GENERATED';
      if (workbenchStep === 3) statusToSave = 'DRAFT_MAPS_GENERATED';
      if (workbenchStep === 4) statusToSave = 'DRAFT_MAPS_ROUTED';
      if (workbenchStep === 5) statusToSave = 'DRAFT_PIPELINE_FINALIZED';

      await api.savePipelineDraft(activePipelineDocId, {
        draftData: JSON.stringify(draftData),
        status: statusToSave
      });
      
      showToast('Session saved successfully.', 'success');
      fetchDocuments();
      fetchBackendDocuments();
    } catch (err) {
      showToast('Failed to save session: ' + err, 'error');
    }
  };

  // Manual Trigger Pipeline
  const handleTriggerPipeline = async (docId: string) => {
    setActivePipelineDocId(docId);
    setWorkbenchStep(1);
    setActiveTab('workbench');
    try {
      const res = await api.startPipeline(docId);
      if (res.success && res.document.draftData) {
        const draft = JSON.parse(res.document.draftData);
        setExecutiveSummary(draft.analysis?.executive_summary || '');
        setPendingMapsData(draft.generated_maps || []);
        setWorkbenchStep(2); // Show summary first, not maps
        showToast('Extraction complete. Executive summary generated.', 'success');
        await autoSaveDraft(draft.generated_maps || [], draft.analysis?.executive_summary || '', 'SUMMARY_GENERATED');
      } else {
        showToast('Pipeline started, but draft maps failed to generate.', 'error');
      }
      fetchDocuments();
      fetchBackendDocuments();
    } catch (err) {
      showToast('Failed to trigger pipeline: ' + err, 'error');
    }
  };

  // Delete Document and clear memory
  const handleDeleteDocument = async (docId: string) => {
    try {
      await api.deleteDocument(docId);
      showToast('Document and its memory successfully deleted.', 'success');
      if (activePipelineDocId === docId) {
        setActivePipelineDocId(null);
        setDraftMapsList([]);
        setExecutiveSummary('');
        setWorkbenchStep(1);
      }
      fetchDocuments();
      fetchBackendDocuments();
      fetchDashboard();
      fetchAllMaps();
    } catch (err) {
      showToast('Failed to delete document: ' + err, 'error');
    }
  };

  const handleResetSession = async (docId: string) => {
    try {
      await api.resetPipelineSession(docId);
      showToast('Pipeline session reset. Document preserved in library.', 'success');
      if (activePipelineDocId === docId) {
        setActivePipelineDocId(null);
        setDraftMapsList([]);
        setExecutiveSummary('');
        setRiskScore(0);
        setConflictAlerts([]);
        setGeneratedScripts([]);
        setPendingMapsData([]);
        setWorkbenchStep(1);
      }
      fetchBackendDocuments();
      fetchDashboard();
      fetchAllMaps();
    } catch (err) {
      showToast('Failed to reset session: ' + err, 'error');
    }
  };

  // Handle manual/cron Deadlines escalations
  const handleAlertScan = async () => {
    try {
      await api.scanAlerts();
      fetchDashboard();
      fetchAllMaps();
      showToast('Alert escalation scanning sequence executed successfully.', 'success');
    } catch (err) {
      showToast('Failed to trigger scan: ' + err, 'error');
    }
  };

  // Mark an alert as read
  const handleMarkAlertRead = async (id: string) => {
    try {
      await api.markAlertRead(id);
      fetchDashboard();
    } catch (err) {
      console.error(err);
    }
  };

  // Approval flow handler
  const handleApproveMap = async (id: string) => {
    try {
      await api.approveMap(id, 'officer-1', 'Checked and confirmed perfect regulatory fit.');
      fetchDashboard();
      fetchAllMaps();
    } catch (err) {
      showToast('Approval failed: ' + err, 'error');
    }
  };

  // Reject flow handler
  const handleRejectMap = async (id: string) => {
    const reason = prompt('Please enter the rejection reason justification:');
    if (!reason) return;
    try {
      await api.rejectMap(id, 'officer-1', reason);
      fetchDashboard();
      fetchAllMaps();
    } catch (err) {
      showToast('Rejection failed: ' + err, 'error');
    }
  };

  // Open Edit modal
  const openEditModal = (map: MAP) => {
    setActiveMap(map);
    setEditFields({
      title: map.title,
      description: map.description,
      deliverable: map.deliverable,
      deadline: map.deadline ? map.deadline.split('T')[0] : '',
      priority: map.priority,
      departmentId: map.departmentId || '',
      editReason: 'Manual parameter adjustments based on CISO compliance review',
    });
    setIsEditModalOpen(true);
  };

  // Submit Edit & Approve
  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMap) return;
    try {
      await api.editMap(activeMap.id, {
        fieldsToUpdate: {
          title: editFields.title,
          description: editFields.description,
          deliverable: editFields.deliverable,
          deadline: editFields.deadline,
          priority: editFields.priority,
          departmentId: editFields.departmentId || null,
        },
        editReason: editFields.editReason,
        editedBy: 'officer-1',
      });
      setIsEditModalOpen(false);
      fetchDashboard();
      fetchAllMaps();
    } catch (err) {
      showToast('Edit failed: ' + err, 'error');
    }
  };

  // Handle evidence modal open
  const openEvidenceModal = (map: MAP) => {
    setActiveMap(map);
    setEvidenceNotes('');
    setEvidenceFiles(null);
    setEvidenceType('other');
    setIsEvidenceModalOpen(true);
  };

  // Submit evidence upload to backend
  const handleSubmitEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMap || !evidenceFiles || evidenceFiles.length === 0) {
      showToast('At least one evidence file is mandatory!', 'error');
      return;
    }

    const formData = new FormData();
    for (let i = 0; i < evidenceFiles.length; i++) {
      formData.append('files', evidenceFiles[i]);
    }
    formData.append('notes', evidenceNotes);
    formData.append('evidenceType', evidenceType);
    formData.append('uploadedBy', 'dept-security-officer');

    try {
      setIsEvidenceModalOpen(false);
      await api.uploadEvidence(activeMap.id, formData);
      fetchAllMaps();
      if (selectedDeptId) fetchDeptMaps(selectedDeptId);
      showToast('Evidence submitted. Autonomous AI validation checks triggered.', 'success');
    } catch (err) {
      showToast('Failed to upload evidence: ' + err, 'error');
    }
  };

  // Get details (script, timeline, result)
  const openDetailModal = async (map: MAP) => {
    setActiveMap(map);
    setIsDetailModalOpen(true);
    setValidationScript('Loading sandboxed script configuration...');
    setMapAuditLogs([]);

    try {
      // 1. Fetch AI technical script
      const scriptData = await api.getValidationScript(map.id);
      setValidationScript(scriptData.script);

      // 2. Fetch immutable audit timeline
      const auditData = await api.getAuditTrail(map.id);
      setMapAuditLogs(auditData);
    } catch (err) {
      console.warn('Details fetching experienced offline limits:', err);
    }
  };

  // Submit Officer validation override
  const handleOverrideValidation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMap) return;
    if (!overrideReason.trim()) {
      showToast('An override justification is strictly mandatory!', 'error');
      return;
    }
    try {
      await api.overrideValidation(activeMap.id, {
        overrideVerdict,
        overrideReason,
        officerId: 'officer-1',
      });
      setIsDetailModalOpen(false);
      fetchDashboard();
      fetchAllMaps();
      if (selectedDeptId) fetchDeptMaps(selectedDeptId);
    } catch (err) {
      showToast('Override failed: ' + err, 'error');
    }
  };

  // Manual document upload
  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      showToast('Please select a regulatory circular PDF first.', 'error');
      return;
    }
    setUploadProgress('Analyzing document structure using multi-agent layout engines...');

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('regulator', manualRegulator);
    formData.append('documentType', manualType);

    try {
      const res = await api.uploadDocument(formData);
      setUploadProgress('');
      setSelectedFile(null);
      showToast(
        `Circular "${res.title}" successfully ingested. Autonomous pipeline launched in background.`,
        'success'
      );
      fetchDashboard();
      fetchAllMaps();
    } catch (err) {
      setUploadProgress('');
      showToast('Ingestion failed: ' + err, 'error');
    }
  };

  // Trigger automated crawlers
  const handleTriggerScraper = async () => {
    try {
      await api.triggerScraper();
      fetchScraper();
      showToast('Playwright-BeautifulSoup regulatory scraping crawlers triaged in background.', 'success');
    } catch (err) {
      showToast('Scraper failed to launch: ' + err, 'error');
    }
  };

  // Bulk Approvals list toggle
  const toggleBulk = (id: string) => {
    setBulkList((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleBulkApprove = async () => {
    if (bulkList.length === 0) return;
    try {
      await api.approveBulk(bulkList);
      setBulkList([]);
      fetchDashboard();
      fetchAllMaps();
      showToast('Bulk dispatch successfully triaged.', 'success');
    } catch (err) {
      showToast('Bulk approval failed: ' + err, 'error');
    }
  };

  const pendingMaps = allMaps.filter((m) => m.status === 'PENDING_REVIEW');
  const activeDispatches = allMaps.filter((m) => m.status !== 'PENDING_REVIEW');

  // Helper: score color
  const scoreColor = (s: number) => (s >= 85 ? '#228B22' : s >= 70 ? '#EAB308' : '#DC2626');

  return {
    activeTab,
    setActiveTab,
    overallScore,
    totalActive,
    totalOverdue,
    totalAtRisk,
    departments,
    alerts,
    recentLogs,
    allMaps,
    bulkList,
    selectedDeptId,
    setSelectedDeptId,
    deptMaps,
    evidenceFiles,
    setEvidenceFiles,
    evidenceNotes,
    setEvidenceNotes,
    evidenceType,
    setEvidenceType,
    selectedFile,
    setSelectedFile,
    uploadProgress,
    scraperStatus,
    intakeStatus,
    manualRegulator,
    setManualRegulator,
    manualType,
    setManualType,
    documents,
    backendDocuments,
    allDocsModalOpen,
    setAllDocsModalOpen,
    pipelineProgress,
    activeMap,
    isDetailModalOpen,
    setIsDetailModalOpen,
    isEvidenceModalOpen,
    setIsEvidenceModalOpen,
    isEditModalOpen,
    setIsEditModalOpen,
    editFields,
    setEditFields,
    overrideVerdict,
    setOverrideVerdict,
    overrideReason,
    setOverrideReason,
    validationScript,
    mapAuditLogs,
    isConnected,
    wsLogs,
    toast,
    setToast,
    pendingMaps,
    activeDispatches,
    scoreColor,
    handleTriggerPipeline,
    handleDeleteDocument,
    handleResetSession,
    handleAlertScan,
    handleMarkAlertRead,
    handleApproveMap,
    handleRejectMap,
    openEditModal,
    handleSubmitEdit,
    openEvidenceModal,
    handleSubmitEvidence,
    openDetailModal,
    handleOverrideValidation,
    handleUploadDocument,
    handleTriggerScraper,
    toggleBulk,
    handleBulkApprove,
    activePipelineDocId,
    setActivePipelineDocId,
    workbenchStep,
    setWorkbenchStep,
    draftMapsList,
    setDraftMapsList,
    executiveSummary,
    riskScore,
    conflictAlerts,
    generatedScripts,
    handleSelectActiveDoc,
    handleConfirmMaps,
    handleConfirmRouting,
    handlePublishPipeline,
    handleSaveSession,
    handleCreateMaps,
    mapsLoading,
    confirmingMaps,
    confirmingRouting,
  };
}
