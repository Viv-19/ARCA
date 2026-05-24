import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { 
  Shield, 
  CheckSquare, 
  Activity, 
  AlertTriangle, 
  Clock, 
  Upload, 
  RefreshCw, 
  UserCheck, 
  Users, 
  Cpu, 
  Code,
  Layers,
  Info,
  X,
  FileCheck,
  Send
} from 'lucide-react';
import './App.css';

// Base API URL config
const BACKEND_URL = 'http://127.0.0.1:3001';
const AI_URL = 'http://127.0.0.1:8000';

axios.defaults.baseURL = BACKEND_URL;

interface Department {
  id: string;
  name: string;
  email: string;
  score: number;
  riskLevel: string;
  overdueCount: number;
  atRiskCount: number;
}

interface Alert {
  id: string;
  alertType: string;
  severity: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface AuditLog {
  id: string;
  eventType: string;
  actor: string;
  description: string;
  createdAt: string;
}

interface MAP {
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

function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'review' | 'tracker' | 'portal' | 'ingestion'>('dashboard');
  
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
  const [scraperStatus, setScraperStatus] = useState<any>({ status: 'IDLE' });
  const [manualRegulator, setManualRegulator] = useState<string>('RBI');
  const [manualType, setManualType] = useState<string>('circular');
  
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
    editReason: 'Manual parameter calibration for Demo circular requirements'
  });
  
  // Override Form fields
  const [overrideVerdict, setOverrideVerdict] = useState<string>('PASSED');
  const [overrideReason, setOverrideReason] = useState<string>('');
  
  // Technical script and audit trail cache
  const [validationScript, setValidationScript] = useState<string>('');
  const [mapAuditLogs, setMapAuditLogs] = useState<AuditLog[]>([]);
  
  // WebSockets and Notification Logs
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [wsLogs, setWsLogs] = useState<string[]>([]);

  // Fetch Master Dashboard metrics
  const fetchDashboard = useCallback(async () => {
    try {
      const res = await axios.get('/api/risk/dashboard');
      setOverallScore(res.data.overallScore);
      setTotalActive(res.data.totalActiveMAPs);
      setTotalOverdue(res.data.totalOverdueMAPs);
      setTotalAtRisk(res.data.totalAtRiskMAPs);
      setDepartments(res.data.departments || []);
      setAlerts(res.data.activeAlerts || []);
      setRecentLogs(res.data.recentActivity || []);
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    }
  }, []);

  // Fetch all maps list
  const fetchAllMaps = useCallback(async () => {
    try {
      const res = await axios.get('/api/maps?limit=100');
      setAllMaps(res.data.maps || []);
    } catch (err) {
      console.error('Failed to load all maps:', err);
    }
  }, []);

  // Fetch maps assigned to selected Department
  const fetchDeptMaps = useCallback(async (deptId: string) => {
    if (!deptId) return;
    try {
      const res = await axios.get(`/api/departments/${deptId}/maps`);
      setDeptMaps(res.data);
    } catch (err) {
      console.error('Failed to load department maps:', err);
    }
  }, []);

  // Fetch scraper status
  const fetchScraper = useCallback(async () => {
    try {
      const res = await axios.get(`${AI_URL}/api/scraper/status`);
      setScraperStatus(res.data);
    } catch (err) {
      console.error('Failed to load scraper status:', err);
    }
  }, []);

  // Initial Bootup trigger
  useEffect(() => {
    fetchDashboard();
    fetchAllMaps();
    fetchScraper();
    
    // Automatically select the first department if available
    axios.get('/api/departments').then((res: any) => {
      if (res.data && res.data.length > 0) {
        setSelectedDeptId(res.data[0].id);
      }
    }).catch((e: any) => console.warn("No departments seeded yet:", e.message));
    
    // Wire Socket.io connection for live event streaming
    const clientSocket = io(BACKEND_URL);
    
    clientSocket.on('connect', () => {
      console.log('Dashboard Socket.io channel connected:', clientSocket.id);
      setIsConnected(true);
      clientSocket.emit('join:dashboard');
    });
    
    clientSocket.on('disconnect', () => {
      setIsConnected(false);
    });
    
    clientSocket.on('map:new', (data: any) => {
      setWsLogs(prev => [`[${new Date().toLocaleTimeString()}] 🆕 New MAP generated by AI: ${data.mapCode} - ${data.title}`, ...prev]);
      fetchDashboard();
      fetchAllMaps();
    });

    clientSocket.on('map:approved', (data: any) => {
      setWsLogs(prev => [`[${new Date().toLocaleTimeString()}] ✅ MAP approved & dispatched: ${data.mapCode}`, ...prev]);
      fetchDashboard();
      fetchAllMaps();
    });

    clientSocket.on('evidence:submitted', (data: any) => {
      setWsLogs(prev => [`[${new Date().toLocaleTimeString()}] 📤 Evidence submitted for MAP ID: ${data.mapId}`, ...prev]);
      fetchDashboard();
      fetchAllMaps();
      if (selectedDeptId) fetchDeptMaps(selectedDeptId);
    });

    clientSocket.on('validation:complete', (data: any) => {
      setWsLogs(prev => [`[${new Date().toLocaleTimeString()}] 🤖 Autonomous Validation Complete for MAP ID: ${data.mapId}. Verdict: ${data.verdict}`, ...prev]);
      fetchDashboard();
      fetchAllMaps();
      if (selectedDeptId) fetchDeptMaps(selectedDeptId);
    });
    
    return () => {
      clientSocket.disconnect();
    };
  }, [fetchDashboard, fetchAllMaps, fetchScraper, selectedDeptId, fetchDeptMaps]);

  useEffect(() => {
    if (selectedDeptId) {
      fetchDeptMaps(selectedDeptId);
    }
  }, [selectedDeptId, fetchDeptMaps]);

  // Handle manual/cron Deadlines escalations
  const handleAlertScan = async () => {
    try {
      await axios.post('/api/alerts/scan');
      fetchDashboard();
      fetchAllMaps();
      alert('Alert escalation scanning sequence executed successfully.');
    } catch (err) {
      alert('Failed to trigger scan: ' + err);
    }
  };

  // Mark an alert as read
  const handleMarkAlertRead = async (id: string) => {
    try {
      await axios.put(`/api/alerts/${id}/read`);
      fetchDashboard();
    } catch (err) {
      console.error(err);
    }
  };

  // Approval flow handler
  const handleApproveMap = async (id: string) => {
    try {
      await axios.put(`/api/maps/${id}/approve`, { approvedBy: 'officer-1', notes: 'Checked and confirmed perfect regulatory fit.' });
      fetchDashboard();
      fetchAllMaps();
    } catch (err) {
      alert('Approval failed: ' + err);
    }
  };

  // Reject flow handler
  const handleRejectMap = async (id: string) => {
    const reason = prompt('Please enter the rejection reason justification:');
    if (!reason) return;
    try {
      await axios.put(`/api/maps/${id}/reject`, { rejectedBy: 'officer-1', reason });
      fetchDashboard();
      fetchAllMaps();
    } catch (err) {
      alert('Rejection failed: ' + err);
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
      editReason: 'Manual parameter adjustments based on CISO compliance review'
    });
    setIsEditModalOpen(true);
  };

  // Submit Edit & Approve
  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMap) return;
    try {
      await axios.put(`/api/maps/${activeMap.id}/edit`, {
        fieldsToUpdate: {
          title: editFields.title,
          description: editFields.description,
          deliverable: editFields.deliverable,
          deadline: editFields.deadline,
          priority: editFields.priority,
          departmentId: editFields.departmentId || null
        },
        editReason: editFields.editReason,
        editedBy: 'officer-1'
      });
      setIsEditModalOpen(false);
      fetchDashboard();
      fetchAllMaps();
    } catch (err) {
      alert('Edit failed: ' + err);
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
      alert('At least one evidence file is mandatory!');
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
      await axios.post(`/api/maps/${activeMap.id}/evidence`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      fetchAllMaps();
      if (selectedDeptId) fetchDeptMaps(selectedDeptId);
      alert('Evidence submitted. Autonomous AI validation checks triggered.');
    } catch (err) {
      alert('Failed to upload evidence: ' + err);
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
      const scriptRes = await axios.get(`/api/maps/${map.id}/validation-script`);
      setValidationScript(scriptRes.data.script);
      
      // 2. Fetch immutable audit timeline
      const auditRes = await axios.get(`/api/maps/${map.id}/audit-trail`);
      setMapAuditLogs(auditRes.data);
    } catch (err) {
      console.warn("Details fetching experienced offline limits:", err);
    }
  };

  // Submit Officer validation override
  const handleOverrideValidation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMap) return;
    if (!overrideReason.trim()) {
      alert('An override justification is strictly mandatory!');
      return;
    }
    try {
      await axios.post(`/api/maps/${activeMap.id}/override`, {
        overrideVerdict,
        overrideReason,
        officerId: 'officer-1'
      });
      setIsDetailModalOpen(false);
      fetchDashboard();
      fetchAllMaps();
      if (selectedDeptId) fetchDeptMaps(selectedDeptId);
    } catch (err) {
      alert('Override failed: ' + err);
    }
  };

  // Manual document upload
  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      alert('Please select a regulatory circular PDF first.');
      return;
    }
    setUploadProgress('Analyzing document structure using multi-agent layout engines...');
    
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('regulator', manualRegulator);
    formData.append('documentType', manualType);

    try {
      const res = await axios.post('/api/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadProgress('');
      setSelectedFile(null);
      alert(`Circular "${res.data.title}" successfully ingested. Autonomous pipeline launched in background.`);
      fetchDashboard();
      fetchAllMaps();
    } catch (err) {
      setUploadProgress('');
      alert('Ingestion failed: ' + err);
    }
  };

  // Trigger automated crawlers
  const handleTriggerScraper = async () => {
    try {
      await axios.post(`${AI_URL}/api/scraper/trigger`);
      fetchScraper();
      alert('Playwright- BeautifulSoup regulatory scraping crawlers triaged in background.');
    } catch (err) {
      alert('Scraper failed to launch: ' + err);
    }
  };

  // Bulk Approvals list toggle
  const toggleBulk = (id: string) => {
    setBulkList(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleBulkApprove = async () => {
    if (bulkList.length === 0) return;
    try {
      await axios.post('/api/maps/approve-bulk', { mapIds: bulkList });
      setBulkList([]);
      fetchDashboard();
      fetchAllMaps();
      alert('Bulk dispatch successfully triaged.');
    } catch (err) {
      alert('Bulk approval failed: ' + err);
    }
  };

  const pendingMaps = allMaps.filter(m => m.status === 'PENDING_REVIEW');
  const activeDispatches = allMaps.filter(m => m.status !== 'PENDING_REVIEW');

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <div className="sidebar">
        <div className="logo-container">
          <Shield className="logo-icon" size={26} color="#3b82f6" />
          <div>
            <div className="logo-text">ARCA</div>
            <div style={{fontSize: '10px', color: '#64748b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px', marginTop: '1px'}}>
              COMPLIANCE HUB
              <span className="animate-pulse-slow" style={{width: '6px', height: '6px', borderRadius: '50%', background: isConnected ? '#10b981' : '#ef4444'}} title={isConnected ? "WebSocket Connected" : "WebSocket Offline"} />
            </div>
          </div>
        </div>
        
        <div className="nav-menu">
          <div className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            <Activity size={16} />
            Executive Panel
          </div>
          <div className={`nav-item ${activeTab === 'review' ? 'active' : ''}`} onClick={() => setActiveTab('review')}>
            <Layers size={16} />
            Officer Review Queue
            {pendingMaps.length > 0 && <span className="badge badge-warning" style={{marginLeft: 'auto'}}>{pendingMaps.length}</span>}
          </div>
          <div className={`nav-item ${activeTab === 'tracker' ? 'active' : ''}`} onClick={() => setActiveTab('tracker')}>
            <Send size={16} />
            Dispatch Tracker
            {activeDispatches.length > 0 && <span className="badge badge-info" style={{marginLeft: 'auto'}}>{activeDispatches.length}</span>}
          </div>
          <div className={`nav-item ${activeTab === 'portal' ? 'active' : ''}`} onClick={() => setActiveTab('portal')}>
            <Users size={16} />
            Department Board
          </div>
          <div className={`nav-item ${activeTab === 'ingestion' ? 'active' : ''}`} onClick={() => setActiveTab('ingestion')}>
            <Upload size={16} />
            Circular Ingest
          </div>
        </div>

        {/* Real-time Socket.io Notification Log widget */}
        <div style={{marginTop: 'auto', padding: '12px 0', fontSize: '11px'}}>
          <div style={{fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: '#94a3b8', letterSpacing: '0.5px'}}>
            <Cpu size={12} color="#10b981" />
            LIVE PIPELINE STREAM
          </div>
          <div className="terminal-screen" style={{maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px'}}>
            {wsLogs.length === 0 ? (
              <span style={{color: '#64748b', fontStyle: 'italic'}}>Awaiting real-time compliance updates from pipeline agents...</span>
            ) : (
              wsLogs.map((log, idx) => <div key={idx}>{log}</div>)
            )}
          </div>
        </div>
      </div>

      {/* Main Panel Content */}
      <div className="main-content">
        
        {/* Unified Command Center Welcome Header */}
        <div style={{ background: '#ffffff', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '20px 28px', marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif", color: 'var(--text-main)', letterSpacing: '-0.5px' }}>ARCA Command Center</h1>
            <p style={{ color: 'var(--text-light)', margin: '4px 0 0 0', fontSize: '13px', fontWeight: 500 }}>Autonomous Compliance Tracking, Mapping & Routing Engine • Canara Bank Edition</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--text-main)' }}>Compliance Officer</div>
              <div style={{ fontSize: '11px', color: 'var(--text-light)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', marginTop: '1px' }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10b981' }} />
                System Active
              </div>
            </div>
            <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: 'white', fontSize: '14px', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.1)' }}>CO</div>
          </div>
        </div>

        {/* TAB 1: EXECUTIVE PANEL (COMPLIANCE POSTURE) */}
        {activeTab === 'dashboard' && (
          <div>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
              <div>
                <h2 style={{margin: 0, fontSize: '20px', fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif"}}>Executive Scorecard</h2>
                <p style={{color: 'var(--text-light)', margin: '4px 0 0 0', fontSize: '12.5px'}}>Real-time audit aggregations, overdue counts, and systemic risk posture</p>
              </div>
              <div style={{display: 'flex', gap: '10px'}}>
                <button className="btn-secondary" onClick={handleAlertScan}>
                  <RefreshCw size={12} />
                  Run Alert Check
                </button>
              </div>
            </div>

            {/* Metrics cards */}
            <div className="metrics-grid">
              <div className="glass-panel metric-card" style={{display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
                <div>
                  <div className="metric-title">Compliance Index</div>
                  <div className="metric-value" style={{color: overallScore >= 85 ? '#059669' : overallScore >= 70 ? '#d97706' : '#dc2626'}}>{overallScore}%</div>
                </div>
                <div className="progress-ring-container">
                  <div className="progress-text" style={{color: 'var(--text-main)'}}>{overallScore}%</div>
                  <svg width="80" height="80">
                    <circle cx="40" cy="40" r="32" fill="transparent" stroke="#cbd5e1" strokeWidth="5" />
                    <circle cx="40" cy="40" r="32" fill="transparent" stroke={overallScore >= 85 ? '#10b981' : overallScore >= 70 ? '#f59e0b' : '#ef4444'} strokeWidth="5" 
                      strokeDasharray={`${2 * Math.PI * 32}`} 
                      strokeDashoffset={`${2 * Math.PI * 32 * (1 - overallScore/100)}`} 
                      strokeLinecap="round"
                      transform="rotate(-90 40 40)"
                    />
                  </svg>
                </div>
              </div>

              <div className="glass-panel metric-card">
                <div className="metric-title">Active Assigned MAPs</div>
                <div className="metric-value">{totalActive}</div>
                <div className="badge badge-info" style={{marginTop: '4px'}}><CheckSquare size={11} /> Active compliance pipelines</div>
              </div>

              <div className="glass-panel metric-card warning-border">
                <div className="metric-title">At Risk Items</div>
                <div className="metric-value" style={{color: 'var(--color-warning)'}}>{totalAtRisk}</div>
                <div className="badge badge-warning" style={{marginTop: '4px'}}><Clock size={11} /> Near deadline (7 days)</div>
              </div>

              <div className="glass-panel metric-card danger-border">
                <div className="metric-title">Overdue Penalties</div>
                <div className="metric-value" style={{color: 'var(--color-danger)'}}>{totalOverdue}</div>
                <div className="badge badge-danger" style={{marginTop: '4px'}}><AlertTriangle size={11} /> Escalated past limit</div>
              </div>
            </div>

            {/* Alerts Panel */}
            {alerts.length > 0 && (
              <div className="glass-panel" style={{padding: '20px', marginBottom: '28px', borderLeft: '4px solid var(--color-danger)', background: 'var(--color-danger-bg)'}}>
                <h3 style={{margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-danger)', fontSize: '15px', fontWeight: 700}}>
                  <AlertTriangle size={16} />
                  System Risk Escalation Warnings
                </h3>
                <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                  {alerts.map((al) => (
                    <div key={al.id} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#ffffff', borderRadius: '8px', border: '1px solid var(--color-danger-border)'}}>
                      <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
                        <span className={`badge ${al.severity === 'CRITICAL' ? 'badge-danger' : 'badge-warning'}`}>{al.severity}</span>
                        <div>
                          <div style={{fontWeight: 600, color: 'var(--text-main)'}}>{al.message}</div>
                          <div style={{fontSize: '11px', color: 'var(--text-light)', marginTop: '2px'}}>{new Date(al.createdAt).toLocaleString()}</div>
                        </div>
                      </div>
                      <button className="btn-secondary" style={{padding: '6px 12px', fontSize: '11.5px'}} onClick={() => handleMarkAlertRead(al.id)}>Resolve</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Columns split: Departments scorecards vs activity stream */}
            <div style={{display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: '28px'}}>
              {/* Departments breakdown */}
              <div className="glass-panel" style={{padding: '24px'}}>
                <h3 style={{margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif"}}>
                  <Users size={16} color="var(--primary-accent)" />
                  Department Scorecards Breakdown
                </h3>
                <div style={{display: 'flex', flexDirection: 'column', gap: '14px'}}>
                  {departments.map((dept) => (
                    <div key={dept.id} style={{padding: '14px', background: '#f8fafc', border: '1px solid var(--border-subtle)', borderRadius: '10px'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
                        <div>
                          <div style={{fontWeight: 700, fontSize: '14px', color: 'var(--text-main)'}}>{dept.name}</div>
                          <div style={{fontSize: '11.5px', color: 'var(--text-light)'}}>{dept.email}</div>
                        </div>
                        <div style={{textAlign: 'right'}}>
                          <div style={{fontSize: '15px', fontWeight: 700, color: dept.score >= 85 ? '#059669' : dept.score >= 70 ? '#d97706' : '#dc2626'}}>{dept.score}%</div>
                          <span className={`badge ${dept.riskLevel === 'LOW' ? 'badge-success' : dept.riskLevel === 'MEDIUM' ? 'badge-warning' : 'badge-danger'}`} style={{marginTop: '2px', padding: '2px 6px', fontSize: '9px'}}>{dept.riskLevel} Risk</span>
                        </div>
                      </div>
                      
                      {/* Bar graph */}
                      <div style={{width: '100%', height: '5px', background: '#cbd5e1', borderRadius: '3px', overflow: 'hidden', marginBottom: '8px'}}>
                        <div style={{width: `${dept.score}%`, height: '100%', background: dept.score >= 85 ? '#10b981' : dept.score >= 70 ? '#f59e0b' : '#ef4444', borderRadius: '3px'}} />
                      </div>
                      
                      {/* Counts */}
                      <div style={{display: 'flex', gap: '14px', fontSize: '11.5px', color: 'var(--text-light)'}}>
                        <div>Tasks Overdue: <span style={{fontWeight: 700, color: dept.overdueCount > 0 ? '#ef4444' : '#64748b'}}>{dept.overdueCount}</span></div>
                        <div>At Risk: <span style={{fontWeight: 700, color: dept.atRiskCount > 0 ? '#f59e0b' : '#64748b'}}>{dept.atRiskCount}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Activity log */}
              <div className="glass-panel" style={{padding: '24px'}}>
                <h3 style={{margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif"}}>
                  <Activity size={16} color="var(--primary-accent)" />
                  Immutable System Audit Logs
                </h3>
                <div className="timeline">
                  {recentLogs.map((log) => (
                    <div key={log.id} className="timeline-item">
                      <div className="timeline-dot" style={{ background: log.eventType === 'DOCUMENT_INGESTED' ? '#3b82f6' : log.eventType === 'MAP_APPROVED' ? '#10b981' : '#6366f1' }} />
                      <div className="timeline-header">
                        <span className={`badge ${log.eventType === 'DOCUMENT_INGESTED' ? 'badge-info' : log.eventType === 'MAP_APPROVED' ? 'badge-success' : 'badge-purple'}`} style={{fontSize: '9px', padding: '2px 6px'}}>{log.eventType}</span>
                        <span className="timeline-time">{new Date(log.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <div style={{fontWeight: 600, fontSize: '12.5px', margin: '4px 0', color: 'var(--text-main)'}}>{log.description}</div>
                      <div style={{fontSize: '11px', color: 'var(--text-light)'}}>Actor: {log.actor}</div>
                    </div>
                  ))}
                  {recentLogs.length === 0 && <p style={{color: 'var(--text-light)', fontSize: '12px', textAlign: 'center', padding: '20px 0'}}>No audit log items generated yet.</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: OFFICER REVIEW QUEUE */}
        {activeTab === 'review' && (
          <div>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
              <div>
                <h2 style={{margin: 0, fontSize: '20px', fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif"}}>Officer Review Gate</h2>
                <p style={{color: 'var(--text-light)', margin: '4px 0 0 0', fontSize: '12.5px'}}>Approve, edit, or reject AI-extracted provisions and Action Points prior to routing dispatch</p>
              </div>
              {bulkList.length > 0 && (
                <button className="btn-primary" onClick={handleBulkApprove}>
                  <CheckSquare size={14} />
                  Bulk Dispatch {bulkList.length} Items
                </button>
              )}
            </div>

            <div className="glass-panel" style={{padding: '24px'}}>
              {pendingMaps.length === 0 ? (
                <div style={{textAlign: 'center', padding: '48px 0', color: 'var(--text-light)'}}>
                  <FileCheck size={40} style={{opacity: 0.4, marginBottom: '12px', color: '#10b981'}} />
                  <div style={{fontSize: '15px', fontWeight: 700, color: 'var(--text-main)'}}>Review Queue Clear</div>
                  <p style={{fontSize: '13px', maxWidth: '380px', margin: '6px auto 0 auto'}}>All compliance provisions have been triaged, approved, and dispatched to their respective departments.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th style={{width: '40px'}}><input type="checkbox" onChange={(e) => {
                          if (e.target.checked) setBulkList(pendingMaps.map(m => m.id));
                          else setBulkList([]);
                        }} /></th>
                        <th>Map Code</th>
                        <th>Compliance Objective</th>
                        <th>Source Circular</th>
                        <th>Classification</th>
                        <th>Priority</th>
                        <th>AI Confidence</th>
                        <th style={{textAlign: 'right'}}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingMaps.map((map) => (
                        <tr key={map.id} style={{ borderLeft: map.flaggedForReview ? '3px solid #d97706' : 'none' }}>
                          <td>
                            <input type="checkbox" checked={bulkList.includes(map.id)} onChange={() => toggleBulk(map.id)} />
                          </td>
                          <td><span style={{fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary-accent)'}}>{map.mapCode}</span></td>
                          <td>
                            <div>
                              <div style={{fontWeight: 700, color: 'var(--text-main)'}}>{map.title}</div>
                              <div style={{fontSize: '11.5px', color: 'var(--text-light)', marginTop: '2px'}}>{map.sectionReference || 'General Obligations'}</div>
                            </div>
                          </td>
                          <td>
                            <div style={{fontSize: '12.5px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500}}>{map.document?.title}</div>
                            <span className="badge badge-info" style={{fontSize: '9px', marginTop: '2px', padding: '1px 4px'}}>{map.document?.documentId || 'RBI'}</span>
                          </td>
                          <td>
                            <span className={`badge ${map.classification === 'TECHNICAL' ? 'badge-info' : 'badge-purple'}`}>
                              {map.classification}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${map.priority === 'CRITICAL' || map.priority === 'HIGH' ? 'badge-danger' : map.priority === 'MEDIUM' ? 'badge-warning' : 'badge-success'}`}>
                              {map.priority}
                            </span>
                          </td>
                          <td>
                            <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                              <div style={{width: '40px', height: '4px', background: '#cbd5e1', borderRadius: '2px', overflow: 'hidden'}}>
                                <div style={{width: `${map.confidenceScore * 100}%`, height: '100%', background: 'var(--primary-accent)'}} />
                              </div>
                              <span style={{fontSize: '11.5px', fontWeight: 700}}>{Math.round(map.confidenceScore * 100)}%</span>
                            </div>
                          </td>
                          <td>
                            <div style={{display: 'flex', gap: '6px', justifyContent: 'flex-end'}}>
                              <button className="btn-secondary" style={{padding: '5px 10px', fontSize: '11.5px'}} onClick={() => openDetailModal(map)}>View</button>
                              <button className="btn-secondary" style={{padding: '5px 10px', fontSize: '11.5px', color: 'var(--primary-accent)'}} onClick={() => openEditModal(map)}>Edit</button>
                              <button className="btn-primary" style={{padding: '5px 12px', fontSize: '11.5px', background: '#059669', boxShadow: 'none'}} onClick={() => handleApproveMap(map.id)}>Approve</button>
                              <button className="btn-secondary" style={{padding: '5px 10px', fontSize: '11.5px', color: '#dc2626'}} onClick={() => handleRejectMap(map.id)}>Reject</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: DISPATCH & ROUTING TRACKER */}
        {activeTab === 'tracker' && (
          <div>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
              <div>
                <h2 style={{margin: 0, fontSize: '20px', fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif"}}>Dispatch & Routing Tracker</h2>
                <p style={{color: 'var(--text-light)', margin: '4px 0 0 0', fontSize: '12.5px'}}>Live audit trail tracking automated assignments, email notifications, and JIRA board synchronization</p>
              </div>
            </div>

            <div className="glass-panel" style={{padding: '24px'}}>
              {activeDispatches.length === 0 ? (
                <div style={{textAlign: 'center', padding: '48px 0', color: 'var(--text-light)'}}>
                  <Send size={40} style={{opacity: 0.4, marginBottom: '12px', color: 'var(--primary-accent)'}} />
                  <div style={{fontSize: '15px', fontWeight: 700, color: 'var(--text-main)'}}>No Active Dispatches</div>
                  <p style={{fontSize: '13px', maxWidth: '380px', margin: '6px auto 0 auto'}}>Approve MAP tasks from the Review Gate to trigger automated routing dispatches to banking departments.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>MAP Code</th>
                        <th>Compliance Objective</th>
                        <th>Routed Department</th>
                        <th>Email Delivery</th>
                        <th>JIRA Integration</th>
                        <th>Work Progress Stage</th>
                        <th style={{textAlign: 'right'}}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeDispatches.map((map) => {
                        const deptName = map.department?.name || "Unassigned Dept";
                        const deptEmail = map.department?.email || "N/A";
                        const isTech = map.classification === 'TECHNICAL';

                        return (
                          <tr key={map.id}>
                            <td><span style={{fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary-accent)'}}>{map.mapCode}</span></td>
                            <td>
                              <div>
                                <div style={{fontWeight: 700, color: 'var(--text-main)'}}>{map.title}</div>
                                <div style={{fontSize: '11.5px', color: 'var(--text-light)', marginTop: '2px', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{map.description}</div>
                              </div>
                            </td>
                            <td>
                              <div>
                                <div style={{fontWeight: 600, color: 'var(--text-main)'}}>{deptName}</div>
                                <div style={{fontSize: '11px', color: 'var(--text-light)', marginTop: '1px'}}>{deptEmail}</div>
                              </div>
                            </td>
                            <td>
                              <div style={{display: 'flex', alignItems: 'center', gap: '6px', color: '#059669'}}>
                                <span style={{width: '6px', height: '6px', borderRadius: '50%', background: '#10b981'}} />
                                <span style={{fontSize: '12.5px', fontWeight: 600}}>Sent & Logged</span>
                              </div>
                            </td>
                            <td>
                              {map.jiraTicketId ? (
                                <span className="badge badge-info" style={{background: 'var(--color-info-bg)', border: '1px solid var(--color-info-border)', color: 'var(--color-info)'}}>
                                  <Code size={11} /> {map.jiraTicketId}
                                </span>
                              ) : isTech ? (
                                <span className="badge badge-warning" style={{fontSize: '10px'}}>Sync Pending</span>
                              ) : (
                                <span className="badge badge-success" style={{background: '#f8fafc', border: '1px solid var(--border-subtle)', color: 'var(--text-light)', fontSize: '10px'}}>Policy Only</span>
                              )}
                            </td>
                            <td>
                              <span className={`badge ${
                                map.status === 'PASSED' ? 'badge-success' :
                                map.status === 'FAILED' ? 'badge-danger' :
                                ['EVIDENCE_SUBMITTED', 'VALIDATION_IN_PROGRESS', 'NEEDS_REVIEW'].includes(map.status) ? 'badge-warning animate-pulse-slow' : 'badge-info'
                              }`}>
                                {map.status === 'DISPATCHED' ? 'Awaiting Action' :
                                 map.status === 'FAILED' ? 'Validation Failed' :
                                 map.status === 'PASSED' ? 'Closed' :
                                 map.status === 'EVIDENCE_SUBMITTED' ? 'Evidence Submitted' :
                                 map.status === 'VALIDATION_IN_PROGRESS' ? 'AI Reviewing' :
                                 map.status === 'NEEDS_REVIEW' ? 'Audit Escalated' : map.status}
                              </span>
                            </td>
                            <td style={{textAlign: 'right'}}>
                              <button className="btn-secondary" style={{padding: '5px 10px', fontSize: '11.5px'}} onClick={() => openDetailModal(map)}>Audit Log</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: DEPARTMENT KANBAN BOARD */}
        {activeTab === 'portal' && (
          <div>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
              <div>
                <h2 style={{margin: 0, fontSize: '20px', fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif"}}>Department Board</h2>
                <p style={{color: 'var(--text-light)', margin: '4px 0 0 0', fontSize: '12.5px'}}>Track active compliance operations, review validation script runs, and submit files proof</p>
              </div>
              <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                <label style={{margin: 0, fontSize: '12px', fontWeight: 700, color: 'var(--text-light)'}}>Active Department:</label>
                <select style={{width: '260px', padding: '8px 12px', borderRadius: '8px'}} value={selectedDeptId} onChange={(e) => setSelectedDeptId(e.target.value)}>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>

            {/* Kanban layout columns */}
            <div className="kanban-grid">
              
              {/* Column 1: DISPATCHED */}
              <div className="kanban-column">
                <div className="column-header">
                  <span>DISPATCHED / NEW</span>
                  <span className="badge badge-info">{deptMaps.filter(m => m.status === 'DISPATCHED').length}</span>
                </div>
                <div className="kanban-cards">
                  {deptMaps.filter(m => m.status === 'DISPATCHED').map(map => (
                    <div key={map.id} className="kanban-card" onClick={() => openDetailModal(map)}>
                      <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px'}}>
                        <span style={{fontFamily: 'monospace', fontSize: '11px', fontWeight: 700, color: 'var(--primary-accent)'}}>{map.mapCode}</span>
                        <span className={`badge ${map.priority === 'CRITICAL' ? 'badge-danger' : 'badge-warning'}`} style={{fontSize: '9px', padding: '1px 4px'}}>{map.priority}</span>
                      </div>
                      <div style={{fontWeight: 700, fontSize: '13.5px', marginBottom: '6px', color: 'var(--text-main)'}}>{map.title}</div>
                      <div style={{fontSize: '12px', color: 'var(--text-light)', marginBottom: '14px', lineHeight: '1.4'}}>{map.description.slice(0, 90)}...</div>
                      <button className="btn-primary" style={{width: '100%', padding: '6px 0', fontSize: '11.5px', justifyContent: 'center', borderRadius: '6px'}} onClick={(e) => {
                        e.stopPropagation();
                        openEvidenceModal(map);
                      }}>
                        <Upload size={11} /> Submit Proofs
                      </button>
                    </div>
                  ))}
                  {deptMaps.filter(m => m.status === 'DISPATCHED').length === 0 && (
                    <div className="kanban-empty-state">
                      <CheckCircleIcon size={20} />
                      <div>No pending dispatches</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Column 2: VALIDATION FAILED */}
              <div className="kanban-column" style={{ background: '#fef2f2', borderColor: '#fca5a5' }}>
                <div className="column-header" style={{ borderBottomColor: '#fca5a5' }}>
                  <span style={{ color: 'var(--color-danger)' }}>VALIDATION FAILED</span>
                  <span className="badge badge-danger">{deptMaps.filter(m => m.status === 'FAILED').length}</span>
                </div>
                <div className="kanban-cards">
                  {deptMaps.filter(m => m.status === 'FAILED').map(map => (
                    <div key={map.id} className="kanban-card" onClick={() => openDetailModal(map)} style={{borderLeft: '3px solid var(--color-danger)'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px'}}>
                        <span style={{fontFamily: 'monospace', fontSize: '11px', fontWeight: 700, color: 'var(--color-danger)'}}>{map.mapCode}</span>
                        <span className="badge badge-danger" style={{fontSize: '9px', padding: '1px 4px'}}>FAILED</span>
                      </div>
                      <div style={{fontWeight: 700, fontSize: '13.5px', marginBottom: '6px', color: 'var(--text-main)'}}>{map.title}</div>
                      <div style={{fontSize: '11.5px', color: 'var(--color-danger)', marginBottom: '14px', fontWeight: 600}}>AI Audit Rejected Evidence. Review required.</div>
                      <button className="btn-secondary" style={{width: '100%', padding: '6px 0', fontSize: '11.5px', justifyContent: 'center', color: 'var(--color-danger)', borderColor: 'var(--color-danger-border)', background: 'var(--color-danger-bg)', borderRadius: '6px'}} onClick={(e) => {
                        e.stopPropagation();
                        openEvidenceModal(map);
                      }}>
                        <Upload size={11} /> Re-upload Proof
                      </button>
                    </div>
                  ))}
                  {deptMaps.filter(m => m.status === 'FAILED').length === 0 && (
                    <div className="kanban-empty-state">
                      <CheckCircleIcon size={20} />
                      <div>No failed tasks</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Column 3: PENDING VALIDATION */}
              <div className="kanban-column" style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
                <div className="column-header" style={{ borderBottomColor: '#fde68a' }}>
                  <span style={{ color: 'var(--color-warning)' }}>UNDER AI AUDIT</span>
                  <span className="badge badge-warning">{deptMaps.filter(m => ['EVIDENCE_SUBMITTED', 'VALIDATION_IN_PROGRESS', 'NEEDS_REVIEW'].includes(m.status)).length}</span>
                </div>
                <div className="kanban-cards">
                  {deptMaps.filter(m => ['EVIDENCE_SUBMITTED', 'VALIDATION_IN_PROGRESS', 'NEEDS_REVIEW'].includes(m.status)).map(map => (
                    <div key={map.id} className="kanban-card" onClick={() => openDetailModal(map)} style={{borderLeft: '3px solid var(--color-warning)'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px'}}>
                        <span style={{fontFamily: 'monospace', fontSize: '11px', fontWeight: 700, color: 'var(--color-warning)'}}>{map.mapCode}</span>
                        <span className="badge badge-warning" style={{fontSize: '9px', padding: '1px 4px'}}>{map.status === 'NEEDS_REVIEW' ? 'ESC' : 'REVIEW'}</span>
                      </div>
                      <div style={{fontWeight: 700, fontSize: '13.5px', marginBottom: '6px', color: 'var(--text-main)'}}>{map.title}</div>
                      <div style={{fontSize: '11.5px', color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0'}}>
                        <RefreshCw size={11} className="animate-spin" color="var(--color-warning)" />
                        Running audit checklist...
                      </div>
                    </div>
                  ))}
                  {deptMaps.filter(m => ['EVIDENCE_SUBMITTED', 'VALIDATION_IN_PROGRESS', 'NEEDS_REVIEW'].includes(m.status)).length === 0 && (
                    <div className="kanban-empty-state">
                      <CheckCircleIcon size={20} />
                      <div>No tasks pending validation</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Column 4: PASSED */}
              <div className="kanban-column" style={{ background: '#ecfdf5', borderColor: '#a7f3d0' }}>
                <div className="column-header" style={{ borderBottomColor: '#a7f3d0' }}>
                  <span style={{ color: 'var(--color-success)' }}>VALIDATION PASSED</span>
                  <span className="badge badge-success">{deptMaps.filter(m => ['PASSED', 'PARTIALLY_COMPLIANT'].includes(m.status)).length}</span>
                </div>
                <div className="kanban-cards">
                  {deptMaps.filter(m => ['PASSED', 'PARTIALLY_COMPLIANT'].includes(m.status)).map(map => (
                    <div key={map.id} className="kanban-card" onClick={() => openDetailModal(map)} style={{borderLeft: '3px solid var(--color-success)'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px'}}>
                        <span style={{fontFamily: 'monospace', fontSize: '11px', fontWeight: 700, color: 'var(--color-success)'}}>{map.mapCode}</span>
                        <span className="badge badge-success" style={{fontSize: '9px', padding: '1px 4px'}}>CLOSED</span>
                      </div>
                      <div style={{fontWeight: 700, fontSize: '13.5px', marginBottom: '6px', color: 'var(--text-main)'}}>{map.title}</div>
                      <div style={{fontSize: '11.5px', color: 'var(--color-success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px'}}>
                        <UserCheck size={12} />
                        Validation passed.
                      </div>
                    </div>
                  ))}
                  {deptMaps.filter(m => ['PASSED', 'PARTIALLY_COMPLIANT'].includes(m.status)).length === 0 && (
                    <div className="kanban-empty-state">
                      <CheckCircleIcon size={20} />
                      <div>No closed tasks</div>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 5: CIRCULAR INGESTION HUB */}
        {activeTab === 'ingestion' && (
          <div>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
              <div>
                <h2 style={{margin: 0, fontSize: '20px', fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif"}}>Circular Ingest Hub</h2>
                <p style={{color: 'var(--text-light)', margin: '4px 0 0 0', fontSize: '12.5px'}}>Manually upload banking circulars or trigger automated website monitoring agents</p>
              </div>
            </div>

            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px'}}>
              
              {/* Manual Upload Section */}
              <div className="glass-panel" style={{padding: '24px'}}>
                <h3 style={{margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: 700}}>
                  <Upload size={18} color="var(--primary-accent)" />
                  Manual Document Upload
                </h3>
                <form onSubmit={handleUploadDocument}>
                  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px'}}>
                    <div>
                      <label>Authority Regulator</label>
                      <select value={manualRegulator} onChange={(e) => setManualRegulator(e.target.value)}>
                        <option value="RBI">Reserve Bank of India (RBI)</option>
                        <option value="SEBI">SEBI</option>
                        <option value="CERT-IN">CERT-In Cybersecurity</option>
                        <option value="FIU-IND">FIU-IND Finance</option>
                      </select>
                    </div>
                    <div>
                      <label>Document Classification</label>
                      <select value={manualType} onChange={(e) => setManualType(e.target.value)}>
                        <option value="circular">Circular Directive</option>
                        <option value="master_direction">Master Direction Update</option>
                        <option value="notification">Statutory Notification</option>
                      </select>
                    </div>
                  </div>

                  <div className="upload-zone" onClick={() => document.getElementById('manual-upload-input')?.click()}>
                    <input type="file" id="manual-upload-input" style={{display: 'none'}} accept=".pdf" onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)} />
                    <Upload size={28} style={{color: 'var(--primary-accent)', marginBottom: '8px'}} />
                    {selectedFile ? (
                      <div style={{fontWeight: 700, color: 'var(--text-main)'}}>{selectedFile.name}</div>
                    ) : (
                      <div>
                        <div style={{fontWeight: 700, fontSize: '13.5px', color: 'var(--text-main)'}}>Click or drag PDF circular file to upload</div>
                        <p style={{fontSize: '11px', color: 'var(--text-light)', margin: '4px 0 0 0'}}>Maximum upload size: 15MB PDF</p>
                      </div>
                    )}
                  </div>

                  {uploadProgress && (
                    <div style={{marginTop: '14px', padding: '10px', background: 'var(--color-info-bg)', borderRadius: '6px', border: '1px solid var(--color-info-border)', display: 'flex', alignItems: 'center', gap: '6px'}}>
                      <RefreshCw size={12} className="animate-spin" color="var(--primary-accent)" />
                      <span style={{fontSize: '12px', color: 'var(--color-info)'}}>{uploadProgress}</span>
                    </div>
                  )}

                  <button type="submit" className="btn-primary" style={{width: '100%', marginTop: '20px', justifyContent: 'center'}} disabled={!selectedFile || !!uploadProgress}>
                    Trigger Ingestion Pipeline
                  </button>
                </form>
              </div>

              {/* Scraper Section */}
              <div className="glass-panel" style={{padding: '24px'}}>
                <h3 style={{margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: 700}}>
                  <Cpu size={18} color="var(--primary-accent)" />
                  Automated Scraper Controller
                </h3>
                <div style={{padding: '16px', background: '#f8fafc', border: '1px solid var(--border-subtle)', borderRadius: '10px', marginBottom: '20px'}}>
                  <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '12px'}}>
                    <span style={{fontWeight: 600, color: 'var(--text-light)', fontSize: '12.5px'}}>Scraper Engine Status:</span>
                    <span className={`badge ${scraperStatus.status === 'RUNNING' ? 'badge-warning' : 'badge-success'}`} style={{padding: '1px 6px', fontSize: '9.5px'}}>
                      {scraperStatus.status}
                    </span>
                  </div>
                  <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '12px'}}>
                    <span style={{fontWeight: 600, color: 'var(--text-light)', fontSize: '12.5px'}}>Last Crawl Run:</span>
                    <span style={{fontSize: '12.5px', color: 'var(--text-main)', fontWeight: 500}}>{scraperStatus.last_run ? new Date(scraperStatus.last_run).toLocaleString() : 'Never'}</span>
                  </div>
                  <div style={{display: 'flex', justifyContent: 'space-between'}}>
                    <span style={{fontWeight: 600, color: 'var(--text-light)', fontSize: '12.5px'}}>Documents Discovered:</span>
                    <span style={{fontWeight: 700, color: 'var(--text-main)'}}>{scraperStatus.last_results_count || 0} documents</span>
                  </div>
                </div>

                <div style={{display: 'flex', gap: '10px'}}>
                  <button className="btn-primary" style={{flex: 1, justifyContent: 'center'}} onClick={handleTriggerScraper} disabled={scraperStatus.status === 'RUNNING'}>
                    <RefreshCw size={12} />
                    Trigger Scraper Crawl
                  </button>
                </div>
                
                <div style={{marginTop: '20px', fontSize: '12px', color: 'var(--text-light)', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', display: 'flex', gap: '6px'}}>
                  <Info size={14} style={{flexShrink: 0, color: 'var(--primary-accent)', marginTop: '1px'}} />
                  <span>The scraper launches background Playwright crawling processes to parse RBI compliance registers. Any newly parsed circular triggers real-time LangGraph multi-agent assessments.</span>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>

      {/* DETAIL MODAL */}
      {isDetailModalOpen && activeMap && (
        <div className="modal-overlay" onClick={() => setIsDetailModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth: '820px'}}>
            <button className="modal-close" onClick={() => setIsDetailModalOpen(false)}>
              <X size={16} />
            </button>
            
            <span className="badge badge-info" style={{marginBottom: '8px', fontSize: '9.5px'}}>{activeMap.mapCode}</span>
            <h2 style={{margin: '0 0 10px 0', color: 'var(--text-main)', fontSize: '20px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800}}>{activeMap.title}</h2>
            
            {/* Meta badges grid */}
            <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px'}}>
              <span className="badge badge-info">{activeMap.classification}</span>
              <span className="badge badge-warning">{activeMap.priority} Priority</span>
              <span className="badge badge-success">Confidence: {Math.round(activeMap.confidenceScore * 100)}%</span>
              {activeMap.jiraTicketId && <span className="badge badge-info" style={{background: 'var(--color-info-bg)', color: 'var(--color-info)', border: '1px solid var(--color-info-border)'}}><Code size={11} /> JIRA: {activeMap.jiraTicketId}</span>}
            </div>

            {/* Content Tabs */}
            <div style={{display: 'flex', flexDirection: 'column', gap: '18px'}}>
              
              <div>
                <h4 style={{margin: '0 0 6px 0', color: 'var(--text-main)', fontWeight: 700, fontSize: '13.5px'}}>Compliance Objective Description</h4>
                <p style={{margin: '0 0 10px 0', lineHeight: 1.5, color: 'var(--text-muted)', fontSize: '13.5px'}}>{activeMap.description}</p>
                <div style={{padding: '12px', background: 'var(--color-info-bg)', border: '1px solid var(--color-info-border)', borderRadius: '8px'}}>
                  <div style={{fontWeight: 700, fontSize: '11px', color: 'var(--color-info)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px'}}>Mandated Deliverable Proof Checklist</div>
                  <span style={{fontSize: '12.5px', color: 'var(--text-main)', fontWeight: 500}}>{activeMap.deliverable}</span>
                </div>
              </div>

              {activeMap.reasoningChain && (
                <div>
                  <h4 style={{margin: '0 0 6px 0', color: 'var(--text-main)', fontWeight: 700, fontSize: '13.5px'}}>Multi-Agent CoT Reasoning Path</h4>
                  <pre style={{whiteSpace: 'pre-wrap', maxHeight: '180px', overflowY: 'auto'}}>{activeMap.reasoningChain}</pre>
                </div>
              )}

              {/* AI Auto-validation verdict result */}
              {activeMap.autoValidationResult && (
                <div className="glass-panel" style={{padding: '16px', borderLeft: '4px solid ' + (activeMap.autoValidationResult === 'PASSED' ? '#10b981' : '#f59e0b'), background: '#f8fafc'}}>
                  <h4 style={{margin: '0 0 8px 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 700}}>
                    <Cpu size={14} color={activeMap.autoValidationResult === 'PASSED' ? '#10b981' : '#f59e0b'} />
                    AI Autonomous Verification Audit
                  </h4>
                  <div dangerouslySetInnerHTML={{__html: activeMap.autoValidationReason || ''}} style={{fontSize: '12.5px', lineHeight: 1.5, color: 'var(--text-main)'}} />
                </div>
              )}

              {/* Validation script block for Technical classifications */}
              {activeMap.classification === 'TECHNICAL' && validationScript && (
                <div>
                  <h4 style={{margin: '0 0 6px 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '13.5px'}}>
                    <Code size={14} color="var(--primary-accent)" /> Generated Verification Script
                  </h4>
                  <pre style={{fontSize: '10.5px', maxHeight: '150px', overflowY: 'auto'}}>{validationScript}</pre>
                </div>
              )}

              {/* Timeline Audits */}
              {mapAuditLogs.length > 0 && (
                <div>
                  <h4 style={{margin: '0 0 10px 0', color: 'var(--text-main)', fontWeight: 700, fontSize: '13.5px'}}>Immutable Action Audit Trail</h4>
                  <div className="timeline" style={{paddingLeft: '16px'}}>
                    {mapAuditLogs.map(log => (
                      <div key={log.id} className="timeline-item">
                        <div className="timeline-dot" style={{width: '6px', height: '6px', left: '-21px', top: '4px'}} />
                        <div className="timeline-header">
                          <span className="badge badge-success" style={{fontSize: '9px', padding: '1px 4px'}}>{log.eventType}</span>
                          <span className="timeline-time">{new Date(log.createdAt).toLocaleString()}</span>
                        </div>
                        <div style={{fontSize: '12.5px', margin: '2px 0', color: 'var(--text-main)'}}>{log.description}</div>
                        <div style={{fontSize: '10.5px', color: 'var(--text-light)'}}>{log.actor}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Human-in-the-loop override panel */}
              {['VALIDATION_IN_PROGRESS', 'EVIDENCE_SUBMITTED', 'NEEDS_REVIEW', 'FAILED'].includes(activeMap.status) ? (
                <div style={{borderTop: '1px solid var(--border-subtle)', paddingTop: '20px', marginTop: '10px'}}>
                  <h4 style={{margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-warning)', fontWeight: 700, fontSize: '13.5px', letterSpacing: '0.5px'}}>
                    <UserCheck size={16} />
                    OFFICER VALIDATION OVERRIDE PANEL
                  </h4>
                  <form onSubmit={handleOverrideValidation}>
                    <div style={{display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '14px', marginBottom: '14px'}}>
                      <div>
                        <label style={{marginTop: 0}}>Override Verdict</label>
                        <select value={overrideVerdict} onChange={(e) => setOverrideVerdict(e.target.value)} style={{padding: '10px 12px'}}>
                          <option value="PASSED">FORCE PASSED (Compliant)</option>
                          <option value="FAILED">FORCE FAILED (Non-Compliant)</option>
                        </select>
                      </div>
                      <div>
                        <label style={{marginTop: 0}}>Override Justification (Audit Log mandatory)</label>
                        <input type="text" placeholder="Explain the business/compliance reason for manual override verification..." value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} required />
                      </div>
                    </div>
                    <button type="submit" className="btn-primary" style={{width: '100%', background: 'linear-gradient(135deg, var(--color-warning), var(--color-danger))', border: 'none', color: '#ffffff', boxShadow: 'none', justifyContent: 'center'}}>
                      Commit Manual Override Verdict
                    </button>
                  </form>
                </div>
              ) : null}

            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {isEditModalOpen && activeMap && (
        <div className="modal-overlay" onClick={() => setIsEditModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth: '680px'}}>
            <button className="modal-close" onClick={() => setIsEditModalOpen(false)}>
              <X size={16} />
            </button>
            <h2 style={{margin: '0 0 6px 0', color: 'var(--text-main)', fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800}}>Edit Compliance Parameters</h2>
            <p style={{color: 'var(--text-light)', fontSize: '12.5px', margin: '0 0 20px 0'}}>Calibrate actionable parameters for MAP {activeMap.mapCode}</p>

            <form onSubmit={handleSubmitEdit}>
              <label>Objective Title</label>
              <input type="text" value={editFields.title} onChange={(e) => setEditFields(prev => ({...prev, title: e.target.value}))} required />
              
              <label>Detailed Description</label>
              <textarea rows={3} value={editFields.description} onChange={(e) => setEditFields(prev => ({...prev, description: e.target.value}))} required />
              
              <label>Expected Deliverable Requirement</label>
              <input type="text" value={editFields.deliverable} onChange={(e) => setEditFields(prev => ({...prev, deliverable: e.target.value}))} required />

              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px'}}>
                <div>
                  <label>Compliance Deadline</label>
                  <input type="date" value={editFields.deadline} onChange={(e) => setEditFields(prev => ({...prev, deadline: e.target.value}))} required />
                </div>
                <div>
                  <label>Priority Level</label>
                  <select value={editFields.priority} onChange={(e) => setEditFields(prev => ({...prev, priority: e.target.value}))}>
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>
              </div>

              <label>Re-Route Department Assignment</label>
              <select value={editFields.departmentId} onChange={(e) => setEditFields(prev => ({...prev, departmentId: e.target.value}))} required>
                <option value="">-- Choose target department --</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>

              <label>Edit Justification Notes</label>
              <input type="text" value={editFields.editReason} onChange={(e) => setEditFields(prev => ({...prev, editReason: e.target.value}))} required />

              <button type="submit" className="btn-primary" style={{width: '100%', marginTop: '20px', justifyContent: 'center'}}>
                Approve and Dispatch MAP
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EVIDENCE UPLOAD MODAL */}
      {isEvidenceModalOpen && activeMap && (
        <div className="modal-overlay" onClick={() => setIsEvidenceModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth: '620px'}}>
            <button className="modal-close" onClick={() => setIsEvidenceModalOpen(false)}>
              <X size={16} />
            </button>
            <h2 style={{margin: '0 0 6px 0', color: 'var(--text-main)', fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800}}>Submit Compliance Evidence</h2>
            <p style={{color: 'var(--text-light)', fontSize: '12.5px', margin: '0 0 20px 0'}}>Upload proof documents (screenshots, configuration logs, reports) to resolve assigned actions</p>

            <div style={{padding: '12px', background: 'var(--color-info-bg)', border: '1px solid var(--color-info-border)', borderRadius: '8px', marginBottom: '20px'}}>
              <div style={{fontWeight: 700, fontSize: '13.5px', color: 'var(--text-main)', marginBottom: '4px'}}>{activeMap.title}</div>
              <div style={{fontSize: '12.5px', color: 'var(--text-main)', fontWeight: 500}}><span style={{fontWeight: 700, color: 'var(--primary-accent)'}}>EXPECTED PROOFS: </span>{activeMap.evidenceRequired.join(', ')}</div>
            </div>

            <form onSubmit={handleSubmitEvidence}>
              <label>Evidence Type</label>
              <select value={evidenceType} onChange={(e) => setEvidenceType(e.target.value)}>
                <option value="screenshot">Interface Screenshot (PNG/JPG)</option>
                <option value="deployment_log">System Security / API logs (TXT/JSON/LOG)</option>
                <option value="report">CISO / Penetration testing reports (PDF)</option>
                <option value="policy_doc">Legal Customer Consent policy drafts (PDF)</option>
                <option value="other">Other supportive logs / materials</option>
              </select>

              <label>Select Evidence Files</label>
              <div className="upload-zone" onClick={() => document.getElementById('evidence-upload-input')?.click()}>
                <input type="file" id="evidence-upload-input" style={{display: 'none'}} multiple onChange={(e) => setEvidenceFiles(e.target.files)} />
                <Upload size={28} style={{color: 'var(--primary-accent)', marginBottom: '8px'}} />
                {evidenceFiles && evidenceFiles.length > 0 ? (
                  <div style={{fontWeight: 700, color: 'var(--text-main)', fontSize: '13px'}}>{evidenceFiles.length} file(s) selected: {Array.from(evidenceFiles).map(f => f.name).join(', ')}</div>
                ) : (
                  <div>
                    <div style={{fontWeight: 700, fontSize: '13.5px', color: 'var(--text-main)'}}>Select evidence file proofs</div>
                    <p style={{fontSize: '11px', color: 'var(--text-light)', margin: '4px 0 0 0'}}>PDF, PNG, JPG, TXT, LOG formats are verified autonomously</p>
                  </div>
                )}
              </div>

              <label>Compliance Submission Notes</label>
              <textarea rows={3} placeholder="Add officer explanations, build version information, or configuration logs details..." value={evidenceNotes} onChange={(e) => setEvidenceNotes(e.target.value)} required />

              <button type="submit" className="btn-primary" style={{width: '100%', marginTop: '20px', justifyContent: 'center'}}>
                Submit Evidence Proofs
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

// Simple internal icon component helper
function CheckCircleIcon({ size = 20 }: { size?: number }) {
  return <CheckSquare size={size} color="var(--text-light)" style={{ opacity: 0.3 }} />;
}

export default App;
