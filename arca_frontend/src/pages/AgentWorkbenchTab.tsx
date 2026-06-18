import React, { useState } from 'react';
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
}

export const AgentWorkbenchTab: React.FC<AgentWorkbenchTabProps> = ({
  activePipelineDocId,
  workbenchStep,
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
}) => {
  const [selectedScriptIdx, setSelectedScriptIdx] = useState<number>(0);

  // Filter documents that are in draft state or not yet processed
  const pendingDocs = documents.filter(d => d.status !== 'PROCESSED');
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
            <span style={{ fontWeight: 600, color: workbenchStep === 2 ? 'var(--primary)' : 'var(--text)' }}>Calibrate MAPs</span>
          </div>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)', margin: '0 12px' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: workbenchStep >= 3 ? 1 : 0.4 }}>
            <span style={{
              width: '18px', height: '18px', borderRadius: '50%', background: workbenchStep > 3 ? '#228B22' : workbenchStep === 3 ? 'var(--primary)' : 'var(--border)',
              color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700
            }}>3</span>
            <span style={{ fontWeight: 600, color: workbenchStep === 3 ? 'var(--primary)' : 'var(--text)' }}>Route Departments</span>
          </div>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)', margin: '0 12px' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: workbenchStep >= 4 ? 1 : 0.4 }}>
            <span style={{
              width: '18px', height: '18px', borderRadius: '50%', background: workbenchStep === 4 ? 'var(--primary)' : 'var(--border)',
              color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700
            }}>4</span>
            <span style={{ fontWeight: 600, color: workbenchStep === 4 ? 'var(--primary)' : 'var(--text)' }}>Final Review</span>
          </div>
        </div>
      )}

      {/* Executive Summary Panel */}
      {activePipelineDocId && workbenchStep > 1 && executiveSummary && (
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

      {/* Idle / Document Selector Screen */}
      {!activePipelineDocId && (
        <div className="glass-panel" style={{ padding: '36px', textAlign: 'center' }}>
          <Cpu size={36} color="var(--primary)" style={{ marginBottom: '12px' }} />
          <h3 style={{ margin: '0 0 6px 0', fontSize: '13px', fontWeight: 700 }}>No Active Workbench Session</h3>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '11px', margin: '0 0 16px 0' }}>
            Select a document in draft stage or ingestion state to launch the interactive review workbench.
          </p>
          <div style={{ maxWidth: '360px', margin: '0 auto' }}>
            <select 
              defaultValue="" 
              onChange={(e) => handleSelectActiveDoc(e.target.value || null)}
              style={{ padding: '8px', width: '100%', borderRadius: '4px', fontSize: '11px', background: 'var(--surface-raised)', color: 'var(--text)' }}
            >
              <option value="" disabled>-- Select a document to start / resume --</option>
              {pendingDocs.map(d => (
                <option key={d.id} value={d.id}>
                  {d.title} ({d.status.replace(/_/g, ' ')})
                </option>
              ))}
            </select>
          </div>
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
            border: '1px solid #333'
          }}>
            <div>[System Log] Bootstrapping pipeline thread...</div>
            <div>[System Log] Invoking FastAPI Stage {activeDoc?.status.includes('STAGE2') ? '2' : activeDoc?.status.includes('STAGE3') ? '3' : '1'} Agent...</div>
            <div>[AI Log] Analyzing document text using GPT LLM context windows...</div>
            <div>[AI Log] Extracting clauses and structural requirements...</div>
            <div>[AI Log] Please hold while agents complete execution.</div>
          </div>
        </div>
      )}

      {/* STEP 2: EDITABLE MAPS LIST TABLE */}
      {activePipelineDocId && workbenchStep === 2 && (
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
            <button className="btn-secondary" style={{ padding: '6px 12px' }} onClick={() => handleSelectActiveDoc(null)}>
              Cancel Session
            </button>
            <button className="btn-primary" style={{ padding: '6px 16px' }} onClick={handleConfirmMaps} disabled={draftMapsList.length === 0}>
              <Users size={11} style={{ marginRight: '6px' }} />
              Confirm & Route to Departments
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: ROUTING & DEPARTMENT ASSIGNMENTS */}
      {activePipelineDocId && workbenchStep === 3 && (
        <div className="glass-panel" style={{ padding: '18px' }}>
          <div style={{ marginBottom: '14px' }}>
            <h3 style={{ margin: 0, fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Users size={13} color="var(--primary)" />
              Calibrate Department Assignments
            </h3>
            <p style={{ fontSize: '10.5px', color: 'var(--text-tertiary)', margin: '2px 0 0 0' }}>
              The AI has matched requirements semantically to Canara Bank departments. Re-assign rows using the dropdowns if required.
            </p>
          </div>

          <div style={{ overflowX: 'auto', marginBottom: '14px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '8px', textAlign: 'left', width: '25%' }}>MAP Title</th>
                  <th style={{ padding: '8px', textAlign: 'left', width: '30%' }}>Description</th>
                  <th style={{ padding: '8px', textAlign: 'left', width: '15%' }}>Classification</th>
                  <th style={{ padding: '8px', textAlign: 'left', width: '30%' }}>Assigned Department</th>
                </tr>
              </thead>
              <tbody>
                {draftMapsList.map((map_obj, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px', fontWeight: 600, color: 'var(--text)' }}>{map_obj.title}</td>
                    <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{map_obj.description}</td>
                    <td style={{ padding: '8px' }}>
                      <span className={`badge ${map_obj.classification === 'TECHNICAL' ? 'badge-info' : 'badge-success'}`} style={{ fontSize: '8px' }}>
                        {map_obj.classification}
                      </span>
                    </td>
                    <td style={{ padding: '6px' }}>
                      <select 
                        value={map_obj.departmentId || ''} 
                        onChange={(e) => handleMapChange(idx, 'departmentId', e.target.value)}
                        style={{ width: '100%', padding: '6px', fontSize: '11px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '3px', fontWeight: 600 }}
                      >
                        <option value="" disabled>-- Select Department --</option>
                        {departments.map(dept => (
                          <option key={dept.id} value={dept.id}>{dept.name}</option>
                        ))}
                      </select>
                      {map_obj.routingJustification && (
                        <div style={{ fontSize: '9px', color: 'var(--text-tertiary)', marginTop: '3px', fontStyle: 'italic' }}>
                          Justification: {map_obj.routingJustification}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
            <button className="btn-secondary" style={{ padding: '6px 12px' }} onClick={() => setWorkbenchStep(2)}>
              Back to MAPs Edit
            </button>
            <button className="btn-primary" style={{ padding: '6px 16px' }} onClick={handleConfirmRouting}>
              <Cpu size={11} style={{ marginRight: '6px' }} />
              Confirm Routing & Run AI Scripts
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: RISK & TECHNICAL SCRIPT VALIDATION PREVIEW */}
      {activePipelineDocId && workbenchStep === 4 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
          
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
              <button className="btn-secondary" style={{ padding: '6px 12px' }} onClick={() => setWorkbenchStep(3)}>
                Back to Routing
              </button>
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
