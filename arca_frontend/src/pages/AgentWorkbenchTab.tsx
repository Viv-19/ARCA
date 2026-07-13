import React, { useState, useEffect, useRef } from 'react';
import { 
  Cpu, 
  Settings, 
  Users, 
  BookOpen, 
  Trash2, 
  Plus, 
  AlertTriangle, 
  CheckCircle, 
  Code, 
  Play, 
  FileCode,
  RefreshCw
} from 'lucide-react';
import type { Department, MAP, Document } from '../types';

interface AgentWorkbenchTabProps {
  activePipelineDocId: string | null;
  workbenchStep: number;
  setWorkbenchStep: (step: number) => void;
  draftMapsList: any[];
  setDraftMapsList: React.Dispatch<React.SetStateAction<any[]>>;
  executiveSummary: string;
  riskScore: number;
  conflictAlerts: string[];
  generatedScripts: any[];
  departments: Department[];
  documents: Document[];
  handleSelectActiveDoc: (docId: string | null) => void;
  handleConfirmMaps: () => void;
  handleConfirmRouting: () => void;
  handlePublishPipeline: () => void;
  handleSaveSession: () => void;
  handleDeleteDocument: (docId: string) => void;
  handleResetSession: (docId: string) => void;
  handleCreateMaps: () => void;
  mapsLoading: boolean;
  confirmingMaps: boolean;
  confirmingRouting: boolean;
}

export const AgentWorkbenchTab: React.FC<AgentWorkbenchTabProps> = ({
  activePipelineDocId,
  workbenchStep,
  setWorkbenchStep,
  draftMapsList,
  setDraftMapsList,
  executiveSummary,
  riskScore,
  conflictAlerts,
  generatedScripts,
  departments,
  documents,
  handleSelectActiveDoc,
  handleConfirmMaps,
  handleConfirmRouting,
  handlePublishPipeline,
  handleSaveSession,
  handleDeleteDocument,
  handleResetSession,
  handleCreateMaps,
  mapsLoading,
  confirmingMaps,
  confirmingRouting,
}) => {
  const [selectedScriptIdx, setSelectedScriptIdx] = useState<number>(0);
  const [deptAssigning, setDeptAssigning] = useState<boolean>(false);
  const deptSectionRef = useRef<HTMLDivElement>(null);
  const step5SectionRef = useRef<HTMLDivElement>(null);

  // Show "agent deciding" animation then scroll into dept panel when step 4 activates
  useEffect(() => {
    if (workbenchStep === 4) {
      setDeptAssigning(true);
      const timer = setTimeout(() => {
        setDeptAssigning(false);
        setTimeout(() => {
          deptSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 80);
      }, 1800);
      return () => clearTimeout(timer);
    }
  }, [workbenchStep]);

  // Smooth scroll into step 5 panel when it appears
  useEffect(() => {
    if (workbenchStep === 5) {
      setTimeout(() => {
        step5SectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    }
  }, [workbenchStep]);

  // Filter documents
  const activeDoc = documents.find(d => d.id === activePipelineDocId);

  // Handlers for modifying the editable draft maps list (Step 2)
  const handleMapChange = (idx: number, field: string, value: any) => {
    setDraftMapsList(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m));
  };

  const handleAddMapRow = () => {
    const newMap = {
      title: 'New Compliance Control Point',
      description: 'Define the detailed requirement here.',
      deliverable: 'Define the required proof or log file.',
      priority: 'MEDIUM',
      risk_level: 'MEDIUM',
      classification: 'NON_TECHNICAL',
      section_reference: 'Section A.1',
      regulatory_keywords: [],
    };
    setDraftMapsList(prev => [...prev, newMap]);
  };

  const handleDeleteMapRow = (idx: number) => {
    setDraftMapsList(prev => prev.filter((_, i) => i !== idx));
  };

  const [activeLogs, setActiveLogs] = useState<string[]>([]);
  
  useEffect(() => {
    if (workbenchStep === 1 && activePipelineDocId) {
      setActiveLogs([]);
      const stage = activeDoc?.status.includes('STAGE2') ? '2' : activeDoc?.status.includes('STAGE3') ? '3' : '1';
      const sequence = [
        { text: "[System Log] Bootstrapping pipeline thread...", delay: 500 },
        { text: "[System Log] Synchronizing with Document Registry...", delay: 1200 },
        { text: "[Extraction] Loading PDF into Docling Processing Engine... (This may take ~10 seconds)", delay: 2000 },
        { text: "[Extraction] Scanning layout, detecting tables, and extracting Markdown...", delay: 6000 },
        { text: "[System Log] PDF extraction completed successfully.", delay: 9000 },
        { text: `[System Log] Invoking FastAPI Stage ${stage} Agent...`, delay: 9500 },
        { text: "[AI Log] Agent connected to GPT LLM context window...", delay: 10500 },
        { text: "[AI Log] Analyzing document text and cross-referencing inventory...", delay: 12000 },
        { text: "[AI Log] Extracting clauses and structural requirements...", delay: 15000 },
        { text: "[AI Log] Generating Machine Actionable Provisions (MAPs)...", delay: 18000 },
        { text: "[AI Log] Please hold while agents complete execution.", delay: 20000 }
      ];

      const timeouts = sequence.map((item) => {
        return setTimeout(() => {
          setActiveLogs(prev => [...prev, item.text]);
        }, item.delay);
      });

      return () => {
        timeouts.forEach(clearTimeout);
      };
    }
  }, [workbenchStep, activePipelineDocId, activeDoc?.status]);

  return (
    <div>
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>Agent Pipeline Workbench</h2>
          <p style={{ color: 'var(--text-tertiary)', margin: '2px 0 0 0', fontSize: '11px' }}>
            Human-in-the-Loop review deck for validating, adjusting, and routing AI-generated actions
          </p>
        </div>
        {activePipelineDocId && activeDoc && (
          <span className="badge badge-info" style={{ fontSize: '10px', padding: '4px 8px' }}>
            Active: {activeDoc.title}
          </span>
        )}
      </div>

      {/* Stepper Header */}
      {activePipelineDocId && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--surface-raised)',
          padding: '12px 24px',
          borderRadius: '6px',
          border: '1px solid var(--border)',
          marginBottom: '16px',
          fontSize: '11px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: workbenchStep >= 1 ? 1 : 0.4 }}>
            <span style={{
              width: '18px', height: '18px', borderRadius: '50%', background: workbenchStep > 1 ? '#228B22' : 'var(--primary)',
              color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700
            }}>1</span>
            <span style={{ fontWeight: 600, color: workbenchStep === 1 ? 'var(--primary)' : 'var(--text)' }}>AI Parsing</span>
          </div>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)', margin: '0 12px' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: workbenchStep >= 2 ? 1 : 0.4 }}>
            <span style={{
              width: '18px', height: '18px', borderRadius: '50%', background: workbenchStep > 2 ? '#228B22' : workbenchStep === 2 ? 'var(--primary)' : 'var(--border)',
              color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700
            }}>2</span>
            <span style={{ fontWeight: 600, color: workbenchStep === 2 ? 'var(--primary)' : 'var(--text)' }}>Summary & Gen</span>
          </div>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)', margin: '0 12px' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: workbenchStep >= 3 ? 1 : 0.4 }}>
            <span style={{
              width: '18px', height: '18px', borderRadius: '50%', background: workbenchStep > 3 ? '#228B22' : workbenchStep === 3 ? 'var(--primary)' : 'var(--border)',
              color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700
            }}>3</span>
            <span style={{ fontWeight: 600, color: workbenchStep === 3 ? 'var(--primary)' : 'var(--text)' }}>Calibrate MAPs</span>
          </div>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)', margin: '0 12px' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: workbenchStep >= 4 ? 1 : 0.4 }}>
            <span style={{
              width: '18px', height: '18px', borderRadius: '50%', background: workbenchStep > 4 ? '#228B22' : workbenchStep === 4 ? 'var(--primary)' : 'var(--border)',
              color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700
            }}>4</span>
            <span style={{ fontWeight: 600, color: workbenchStep === 4 ? 'var(--primary)' : 'var(--text)' }}>Route Departments</span>
          </div>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)', margin: '0 12px' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: workbenchStep >= 5 ? 1 : 0.4 }}>
            <span style={{
              width: '18px', height: '18px', borderRadius: '50%', background: workbenchStep === 5 ? 'var(--primary)' : 'var(--border)',
              color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700
            }}>5</span>
            <span style={{ fontWeight: 600, color: workbenchStep === 5 ? 'var(--primary)' : 'var(--text)' }}>Final Review</span>
          </div>
        </div>
      )}

      {/* STEP 2: Executive Summary & Generate MAPs */}
      {activePipelineDocId && workbenchStep === 2 && executiveSummary && (
        <div className="glass-panel" style={{ padding: '18px', borderLeft: '4px solid var(--primary)', textAlign: 'left' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <BookOpen size={16} />
            Autonomous Executive Summary
          </h4>
          <div style={{ 
            fontSize: '12px', 
            lineHeight: '1.6', 
            color: 'var(--text)', 
            whiteSpace: 'pre-wrap',
            background: 'var(--surface-raised)',
            padding: '16px',
            borderRadius: '6px',
            border: '1px solid var(--border)',
            marginBottom: '20px'
          }}>
            {executiveSummary}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-secondary" style={{ padding: '8px 16px', color: 'var(--primary)', borderColor: 'var(--primary)' }} onClick={handleSaveSession}>
                Save Draft
              </button>
              <button className="btn-secondary" style={{ padding: '8px 16px', color: '#DC2626', borderColor: '#DC2626', display: 'flex', alignItems: 'center' }} onClick={() => handleResetSession(activePipelineDocId!)}>
                <Trash2 size={13} style={{ marginRight: '6px' }} />
                Delete Session
              </button>
            </div>
            
            <button 
              className="btn-primary" 
              style={{ padding: '8px 24px', display: 'flex', alignItems: 'center', gap: '8px' }} 
              onClick={handleCreateMaps}
              disabled={mapsLoading}
            >
              {mapsLoading ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  Agent AI is crafting Action Points...
                </>
              ) : (
                <>
                  <Play size={13} />
                  Generate Mandatory Action Points (MAPs)
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Global Executive Summary Panel for Steps 3, 4, 5 */}
      {activePipelineDocId && workbenchStep > 2 && executiveSummary && (
        <div className="glass-panel" style={{ padding: '16px', marginBottom: '16px', borderLeft: '4px solid var(--primary)', textAlign: 'left' }}>
          <h4 style={{ margin: '0 0 6px 0', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary)', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <BookOpen size={12} />
            Autonomous Executive Summary
          </h4>
          <p style={{ margin: 0, fontSize: '11.5px', lineHeight: '1.6', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
            {executiveSummary}
          </p>
        </div>
      )}

      {/* Idle / No Active Session */}
      {!activePipelineDocId && (
        <div className="glass-panel" style={{ padding: '48px', textAlign: 'center' }}>
          <Cpu size={40} color="var(--primary)" style={{ marginBottom: '14px', opacity: 0.5 }} />
          <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 700 }}>No Active Workbench Session</h3>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '11.5px', margin: '0 0 20px 0', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto', lineHeight: '1.6' }}>
            Use the <strong>Sessions</strong> tab in the sidebar to select an active or completed session. 
            Your progress is automatically preserved — you'll resume exactly where you left off.
          </p>
        </div>
      )}

      {/* STEP 1: LOADING & AGENT TERMINAL LOGGER */}
      {activePipelineDocId && workbenchStep === 1 && (
        <div className="glass-panel" style={{ padding: '24px', textAlign: 'center' }}>
          <RefreshCw size={28} className="animate-spin" color="var(--primary)" style={{ marginBottom: '12px' }} />
          <h3 style={{ margin: '0 0 4px 0', fontSize: '12px', fontWeight: 700 }}>AI Agent In Progress</h3>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '11px', margin: '0 0 16px 0' }}>
            Running deep neural extraction, inventory deduplication, and code generation routines...
          </p>
          
          <div style={{
            background: 'black',
            color: '#00FF00',
            fontFamily: 'monospace',
            padding: '12px',
            borderRadius: '4px',
            fontSize: '10px',
            textAlign: 'left',
            maxHeight: '180px',
            overflowY: 'auto',
            border: '1px solid #333',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            {activeLogs.map((log, index) => (
              <div key={index} style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
                {log}
              </div>
            ))}
            <style>{`
              @keyframes fadeIn {
                from { opacity: 0; transform: translateY(4px); }
                to { opacity: 1; transform: translateY(0); }
              }
              @keyframes slideInUp {
                from { opacity: 0; transform: translateY(16px); }
                to { opacity: 1; transform: translateY(0); }
              }
            `}</style>
          </div>
        </div>
      )}

      {/* STEP 3: EDITABLE MAPS LIST TABLE */}
      {activePipelineDocId && workbenchStep === 3 && (
        <div className="glass-panel" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ margin: 0, fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Settings size={13} color="var(--primary)" />
              Calibrate Action Points (MAPs)
            </h3>
            <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '10.5px' }} onClick={handleAddMapRow}>
              <Plus size={10} style={{ marginRight: '4px' }} />
              Add Custom MAP
            </button>
          </div>

          <div style={{ overflowX: 'auto', marginBottom: '14px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '8px', textAlign: 'left', width: '22%' }}>Title</th>
                  <th style={{ padding: '8px', textAlign: 'left', width: '28%' }}>Description</th>
                  <th style={{ padding: '8px', textAlign: 'left', width: '20%' }}>Deliverable (Evidence Needed)</th>
                  <th style={{ padding: '8px', textAlign: 'left', width: '10%' }}>Priority</th>
                  <th style={{ padding: '8px', textAlign: 'left', width: '10%' }}>Class</th>
                  <th style={{ padding: '8px', textAlign: 'center', width: '8%' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {draftMapsList.map((map_obj, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '6px' }}>
                      <input 
                        type="text" 
                        value={map_obj.title || ''} 
                        onChange={(e) => handleMapChange(idx, 'title', e.target.value)} 
                        style={{ width: '100%', padding: '4px', fontSize: '11px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '3px' }}
                      />
                    </td>
                    <td style={{ padding: '6px' }}>
                      <textarea 
                        value={map_obj.description || ''} 
                        onChange={(e) => handleMapChange(idx, 'description', e.target.value)} 
                        style={{ width: '100%', padding: '4px', fontSize: '11px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '3px', height: '90px', resize: 'vertical' }}
                      />
                    </td>
                    <td style={{ padding: '6px' }}>
                      <textarea 
                        value={map_obj.deliverable || ''} 
                        onChange={(e) => handleMapChange(idx, 'deliverable', e.target.value)} 
                        style={{ width: '100%', padding: '4px', fontSize: '11px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '3px', height: '90px', resize: 'vertical' }}
                      />
                    </td>
                    <td style={{ padding: '6px' }}>
                      <select 
                        value={map_obj.priority || 'MEDIUM'} 
                        onChange={(e) => handleMapChange(idx, 'priority', e.target.value)}
                        style={{ width: '100%', padding: '4px', fontSize: '11px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '3px' }}
                      >
                        <option value="CRITICAL">CRITICAL</option>
                        <option value="HIGH">HIGH</option>
                        <option value="MEDIUM">MEDIUM</option>
                        <option value="LOW">LOW</option>
                      </select>
                    </td>
                    <td style={{ padding: '6px' }}>
                      <select 
                        value={map_obj.classification || 'NON_TECHNICAL'} 
                        onChange={(e) => handleMapChange(idx, 'classification', e.target.value)}
                        style={{ width: '100%', padding: '4px', fontSize: '11px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '3px' }}
                      >
                        <option value="TECHNICAL">TECHNICAL</option>
                        <option value="NON_TECHNICAL">NON-TECH</option>
                      </select>
                    </td>
                    <td style={{ padding: '6px', textAlign: 'center' }}>
                      <button 
                        style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', padding: '4px' }} 
                        onClick={() => handleDeleteMapRow(idx)}
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
                {draftMapsList.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-disabled)', fontStyle: 'italic' }}>
                      No MAPs generated. Click 'Add Custom MAP' to create one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-secondary" style={{ padding: '6px 12px' }} onClick={() => handleSelectActiveDoc(null)}>
                Close
              </button>
              <button className="btn-secondary" style={{ padding: '6px 12px', color: 'var(--primary)', borderColor: 'var(--primary)' }} onClick={handleSaveSession}>
                Save Draft
              </button>
              <button className="btn-secondary" style={{ padding: '6px 12px', color: '#DC2626', borderColor: '#DC2626', display: 'flex', alignItems: 'center' }} onClick={() => handleResetSession(activePipelineDocId!)}>
                <Trash2 size={11} style={{ marginRight: '6px' }} />
                Delete Session
              </button>
            </div>
            <button
              className="btn-primary"
              style={{ padding: '6px 16px', display: 'flex', alignItems: 'center', gap: '6px', minWidth: '220px', justifyContent: 'center' }}
              onClick={handleConfirmMaps}
              disabled={draftMapsList.length === 0 || confirmingMaps}
            >
              {confirmingMaps ? (
                <>
                  <RefreshCw size={11} className="animate-spin" />
                  Routing to Departments...
                </>
              ) : (
                <>
                  <Users size={11} />
                  Confirm & Route to Departments
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: MAPs READ-ONLY ABOVE + DEPARTMENT ASSIGNMENT BELOW */}
      {activePipelineDocId && workbenchStep === 4 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* ── Top panel: MAPs locked (read-only with description) ── */}
          <div className="glass-panel" style={{ padding: '18px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Settings size={13} color="var(--primary)" />
              Generated Action Points (MAPs)
              <span className="badge badge-success" style={{ fontSize: '8px', padding: '2px 6px', marginLeft: '4px' }}>
                {draftMapsList.length} MAPs confirmed
              </span>
            </h3>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-raised)', borderBottom: '2px solid var(--border)' }}>
                    <th style={{ padding: '10px 8px', textAlign: 'left', width: '22%', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-secondary)' }}>Title</th>
                    <th style={{ padding: '10px 8px', textAlign: 'left', width: '38%', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-secondary)' }}>Description</th>
                    <th style={{ padding: '10px 8px', textAlign: 'left', width: '24%', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-secondary)' }}>Deliverable</th>
                    <th style={{ padding: '10px 8px', textAlign: 'left', width: '8%', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-secondary)' }}>Priority</th>
                    <th style={{ padding: '10px 8px', textAlign: 'left', width: '8%', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-secondary)' }}>Class</th>
                  </tr>
                </thead>
                <tbody>
                  {draftMapsList.map((map_obj, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                      <td style={{ padding: '12px 8px', fontWeight: 700, color: 'var(--text)', fontSize: '11.5px', lineHeight: '1.4' }}>
                        {map_obj.title}
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <p style={{ margin: 0, fontSize: '11px', color: 'var(--text)', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                          {map_obj.description}
                        </p>
                      </td>
                      <td style={{ padding: '12px 8px', fontSize: '10.5px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                        {map_obj.deliverable}
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <span className={`badge ${map_obj.priority === 'CRITICAL' || map_obj.priority === 'HIGH' ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: '8px' }}>
                          {map_obj.priority}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <span className={`badge ${map_obj.classification === 'TECHNICAL' ? 'badge-info' : 'badge-success'}`} style={{ fontSize: '8px' }}>
                          {map_obj.classification === 'TECHNICAL' ? 'TECH' : 'NON-TECH'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Bottom panel: Department assignment (auto-scrolled into view) ── */}
          <div
            ref={deptSectionRef}
            className="glass-panel"
            style={{ padding: '18px', borderTop: '3px solid var(--primary)' }}
          >
            {deptAssigning ? (
              /* Agent deciding animation */
              <div style={{ padding: '32px 0', textAlign: 'center' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', padding: '16px 28px', background: 'var(--surface-raised)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div className="animate-spin" style={{ width: '16px', height: '16px', border: '2px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', flexShrink: 0 }} />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text)' }}>AI Agent is assigning departments...</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                      Running semantic RAG search across Canara Bank department profiles
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ animation: 'slideInUp 0.35s ease-out' }}>
                <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={13} color="var(--primary)" />
                  <h3 style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: 'var(--text)' }}>
                    Department Assignments
                  </h3>
                  <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginLeft: '4px' }}>
                    — AI-suggested. Adjust using the dropdowns if needed.
                  </span>
                </div>

                <div style={{ overflowX: 'auto', marginBottom: '14px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-raised)', borderBottom: '2px solid var(--border)' }}>
                        <th style={{ padding: '10px 8px', textAlign: 'left', width: '20%', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-secondary)' }}>MAP Name</th>
                        <th style={{ padding: '10px 8px', textAlign: 'left', width: '37%', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-secondary)' }}>Description</th>
                        <th style={{ padding: '10px 8px', textAlign: 'left', width: '10%', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-secondary)' }}>Class</th>
                        <th style={{ padding: '10px 8px', textAlign: 'left', width: '33%', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-secondary)' }}>Assigned Department</th>
                      </tr>
                    </thead>
                    <tbody>
                      {draftMapsList.map((map_obj, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                          <td style={{ padding: '12px 8px', fontWeight: 700, color: 'var(--text)', fontSize: '11.5px', lineHeight: '1.4' }}>
                            {map_obj.title}
                          </td>
                          <td style={{ padding: '12px 8px' }}>
                            <p style={{ margin: 0, fontSize: '11px', color: 'var(--text)', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                              {map_obj.description}
                            </p>
                          </td>
                          <td style={{ padding: '12px 8px' }}>
                            <span className={`badge ${map_obj.classification === 'TECHNICAL' ? 'badge-info' : 'badge-success'}`} style={{ fontSize: '8px' }}>
                              {map_obj.classification === 'TECHNICAL' ? 'TECH' : 'NON-TECH'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 6px' }}>
                            <select
                              value={map_obj.departmentId || ''}
                              onChange={(e) => handleMapChange(idx, 'departmentId', e.target.value)}
                              style={{ width: '100%', padding: '6px 8px', fontSize: '11px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '3px', fontWeight: 600 }}
                            >
                              <option value="" disabled>-- Select Department --</option>
                              {departments.map(dept => (
                                <option key={dept.id} value={dept.id}>{dept.name}</option>
                              ))}
                            </select>
                            {map_obj.routingJustification && (
                              <div style={{ fontSize: '9px', color: 'var(--text-tertiary)', marginTop: '4px', fontStyle: 'italic', lineHeight: '1.5' }}>
                                {map_obj.routingJustification}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn-secondary" style={{ padding: '6px 12px' }} onClick={() => setWorkbenchStep(3)}>
                      Back to MAPs Edit
                    </button>
                    <button className="btn-secondary" style={{ padding: '6px 12px', color: 'var(--primary)', borderColor: 'var(--primary)' }} onClick={handleSaveSession}>
                      Save Draft
                    </button>
                    <button className="btn-secondary" style={{ padding: '6px 12px', color: '#DC2626', borderColor: '#DC2626', display: 'flex', alignItems: 'center' }} onClick={() => handleResetSession(activePipelineDocId!)}>
                      <Trash2 size={11} style={{ marginRight: '6px' }} />
                      Delete Session
                    </button>
                  </div>
                  <button
                    className="btn-primary"
                    style={{ padding: '6px 16px', display: 'flex', alignItems: 'center', gap: '6px', minWidth: '230px', justifyContent: 'center' }}
                    onClick={handleConfirmRouting}
                    disabled={confirmingRouting}
                  >
                    {confirmingRouting ? (
                      <>
                        <RefreshCw size={11} className="animate-spin" />
                        Running AI Scripts...
                      </>
                    ) : (
                      <>
                        <Cpu size={11} />
                        Confirm Routing & Run AI Scripts
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* STEP 5: RISK & TECHNICAL SCRIPT VALIDATION PREVIEW */}
      {activePipelineDocId && workbenchStep === 5 && (
        <div ref={step5SectionRef} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', animation: 'slideInUp 0.4s ease-out' }}>
          
          {/* Risk assessment and conflicts summary (left) */}
          <div className="glass-panel" style={{ padding: '18px' }}>
            <h3 style={{
              margin: '0 0 12px 0', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px',
              textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)'
            }}>
              <AlertTriangle size={13} color="#EAB308" />
              Pipeline Analysis
            </h3>
            
            <div style={{ textAlign: 'center', padding: '14px', background: 'var(--surface-raised)', borderRadius: '6px', border: '1px solid var(--border)', marginBottom: '14px' }}>
              <div style={{ fontSize: '24px', fontWeight: 800, color: riskScore >= 75 ? '#DC2626' : riskScore >= 40 ? '#EAB308' : '#228B22' }}>
                {riskScore}%
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 600, marginTop: '2px', textTransform: 'uppercase' }}>
                System Risk Contribution
              </div>
            </div>

            <h4 style={{ margin: '0 0 6px 0', fontSize: '11px', fontWeight: 700, color: 'var(--text)' }}>Cross-MAP Conflicts</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {conflictAlerts.map((conflict, idx) => (
                <div key={idx} style={{
                  padding: '8px 10px', background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A',
                  borderRadius: '4px', fontSize: '10px', lineHeight: '1.4'
                }}>
                  {conflict}
                </div>
              ))}
              {conflictAlerts.length === 0 && (
                <span style={{ fontStyle: 'italic', fontSize: '10px', color: 'var(--text-disabled)' }}>No active policy conflicts detected.</span>
              )}
            </div>
          </div>

          {/* Validation scripts preview tab list (right) */}
          <div className="glass-panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{
              margin: '0 0 12px 0', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px',
              textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)'
            }}>
              <Code size={13} color="var(--primary)" />
              AI Technical Scripts Validation Preview
            </h3>

            {generatedScripts.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '12px', flex: 1, minHeight: '280px' }}>
                {/* Script selector menu */}
                <div style={{ borderRight: '1px solid var(--border)', paddingRight: '8px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '300px' }}>
                  {generatedScripts.map((scr, idx) => (
                    <div 
                      key={idx}
                      style={{
                        padding: '6px 8px', borderRadius: '4px', fontSize: '10.5px', cursor: 'pointer',
                        background: selectedScriptIdx === idx ? 'var(--surface-raised)' : 'transparent',
                        fontWeight: selectedScriptIdx === idx ? 700 : 500,
                        color: selectedScriptIdx === idx ? 'var(--primary)' : 'var(--text-secondary)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        border: selectedScriptIdx === idx ? '1px solid var(--border)' : '1px solid transparent'
                      }}
                      onClick={() => setSelectedScriptIdx(idx)}
                      title={scr.map_title}
                    >
                      {scr.map_title}
                    </div>
                  ))}
                </div>

                {/* Script content block */}
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10.5px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    <FileCode size={12} color="var(--primary)" />
                    <strong>{generatedScripts[selectedScriptIdx].map_title}</strong> (Validation Sandbox Script)
                  </div>
                  <pre style={{
                    background: 'black', color: '#ECECF1', padding: '12px', borderRadius: '4px',
                    fontFamily: 'monospace', fontSize: '10px', overflow: 'auto', margin: 0, flex: 1, maxHeight: '250px',
                    textAlign: 'left'
                  }}>
                    <code>{generatedScripts[selectedScriptIdx].script}</code>
                  </pre>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border)', borderRadius: '4px', padding: '24px' }}>
                <span style={{ fontStyle: 'italic', fontSize: '11px', color: 'var(--text-disabled)' }}>
                  No technical controls identified. No validation scripts generated.
                </span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '12px', marginTop: '14px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-secondary" style={{ padding: '6px 12px' }} onClick={() => setWorkbenchStep(4)}>
                  Back to Routing
                </button>
                <button className="btn-secondary" style={{ padding: '6px 12px', color: 'var(--primary)', borderColor: 'var(--primary)' }} onClick={handleSaveSession}>
                  Save Draft
                </button>
                <button className="btn-secondary" style={{ padding: '6px 12px', color: '#DC2626', borderColor: '#DC2626', display: 'flex', alignItems: 'center' }} onClick={() => handleResetSession(activePipelineDocId!)}>
                  <Trash2 size={11} style={{ marginRight: '6px' }} />
                  Delete Session
                </button>
              </div>
              <button className="btn-primary" style={{ padding: '6px 20px', background: '#228B22', borderColor: '#228B22' }} onClick={handlePublishPipeline}>
                <CheckCircle size={11} style={{ marginRight: '6px' }} />
                Publish MAPs to Department Boards
              </button>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
