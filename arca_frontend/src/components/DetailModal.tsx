import React from 'react';
import { X, Code, Cpu } from 'lucide-react';
import type { MAP, AuditLog } from '../types';

interface DetailModalProps {
  activeMap: MAP;
  onClose: () => void;
  validationScript: string;
  mapAuditLogs: AuditLog[];
  overrideVerdict: string;
  setOverrideVerdict: (val: string) => void;
  overrideReason: string;
  setOverrideReason: (val: string) => void;
  onOverrideValidation: (e: React.FormEvent) => void;
}

export const DetailModal: React.FC<DetailModalProps> = ({
  activeMap,
  onClose,
  validationScript,
  mapAuditLogs,
  overrideVerdict,
  setOverrideVerdict,
  overrideReason,
  setOverrideReason,
  onOverrideValidation
}) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth: '780px'}}>
        <button className="modal-close" onClick={onClose}>
          <X size={14} />
        </button>
        
        <span className="badge badge-info" style={{marginBottom: '6px'}}>{activeMap.mapCode}</span>
        <h2 style={{margin: '0 0 8px 0', color: 'var(--text)', fontSize: '16px', fontWeight: 800}}>{activeMap.title}</h2>
        
        {/* Meta badges */}
        <div style={{display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px'}}>
          <span className="badge badge-info">{activeMap.classification}</span>
          <span className={`badge ${activeMap.priority === 'CRITICAL' || activeMap.priority === 'HIGH' ? 'badge-danger' : 'badge-warning'}`}>{activeMap.priority}</span>
          <span className="badge badge-success">Confidence: <span className="mono">{Math.round(activeMap.confidenceScore * 100)}%</span></span>
          {activeMap.jiraTicketId && <span className="badge badge-info"><Code size={9} /> {activeMap.jiraTicketId}</span>}
        </div>

        <div style={{display: 'flex', flexDirection: 'column', gap: '14px'}}>
          
          <div>
            <h4 style={{margin: '0 0 4px 0', color: 'var(--text)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Description</h4>
            <p style={{margin: '0 0 8px 0', lineHeight: 1.5, color: 'var(--text-secondary)', fontSize: '12px'}}>{activeMap.description}</p>
            <div style={{padding: '10px', background: 'var(--status-info-bg)', border: '1px solid var(--status-info-border)', borderRadius: '4px'}}>
              <div style={{fontWeight: 700, fontSize: '9px', color: 'var(--status-info-text)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px'}}>Mandated Deliverable</div>
              <span style={{fontSize: '11.5px', color: 'var(--text)', fontWeight: 500}}>{activeMap.deliverable}</span>
            </div>
          </div>

          {activeMap.reasoningChain && (
            <div>
              <h4 style={{margin: '0 0 4px 0', color: 'var(--text)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px'}}>CoT Reasoning</h4>
              <pre style={{whiteSpace: 'pre-wrap', maxHeight: '140px', overflowY: 'auto'}}>{activeMap.reasoningChain}</pre>
            </div>
          )}

          {/* AI Auto-validation result */}
          {activeMap.autoValidationResult && (
            <div className="glass-panel" style={{padding: '12px', borderLeft: '3px solid ' + (activeMap.autoValidationResult === 'PASSED' ? '#228B22' : '#EAB308')}}>
              <h4 style={{margin: '0 0 6px 0', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px'}}>
                <Cpu size={12} color={activeMap.autoValidationResult === 'PASSED' ? '#228B22' : '#EAB308'} />
                AI Verification Audit
              </h4>
              <div dangerouslySetInnerHTML={{__html: activeMap.autoValidationReason || ''}} style={{fontSize: '11.5px', lineHeight: 1.5, color: 'var(--text)'}} />
            </div>
          )}

          {/* Validation script */}
          {activeMap.classification === 'TECHNICAL' && validationScript && (
            <div>
              <h4 style={{margin: '0 0 4px 0', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px'}}>
                <Code size={12} /> Verification Script
              </h4>
              <pre style={{fontSize: '10px', maxHeight: '140px', overflowY: 'auto'}}>{validationScript}</pre>
            </div>
          )}

          {/* Timeline Audits */}
          {mapAuditLogs.length > 0 && (
            <div>
              <h4 style={{margin: '0 0 8px 0', color: 'var(--text)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Audit Trail</h4>
              <div className="timeline" style={{paddingLeft: '14px'}}>
                {mapAuditLogs.map(log => (
                  <div key={log.id} className="timeline-item">
                    <div className="timeline-dot" style={{width: '5px', height: '5px', left: '-18px', top: '3px'}} />
                    <div className="timeline-header">
                      <span className="badge badge-success" style={{fontSize: '8px', padding: '0px 3px'}}>{log.eventType}</span>
                      <span className="timeline-time">{new Date(log.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="timeline-desc">{log.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Compliance Officer Validation Override Form */}
          {activeMap.status !== 'PENDING_REVIEW' && (
            <div className="glass-panel" style={{padding: '16px', background: 'var(--surface-raised)', marginTop: '8px'}}>
              <h3 style={{margin: '0 0 10px 0', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)'}}>
                Compliance Officer Sign-Off & Verification Override
              </h3>
              
              <form onSubmit={onOverrideValidation} style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                <div style={{display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px'}}>
                  <div>
                    <label style={{fontSize: '10.5px'}}>Override Verdict</label>
                    <select value={overrideVerdict} onChange={(e) => setOverrideVerdict(e.target.value)}>
                      <option value="PASSED">Approve (PASSED)</option>
                      <option value="FAILED">Reject (FAILED)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{fontSize: '10.5px'}}>Override Justification Reasoning</label>
                    <input 
                      type="text" 
                      placeholder="Specify reasoning (e.g. Reviewed CISO evidence logs, audit trail manually confirmed)" 
                      value={overrideReason} 
                      onChange={(e) => setOverrideReason(e.target.value)} 
                      required 
                    />
                  </div>
                </div>
                
                <button type="submit" className="btn-primary" style={{alignSelf: 'flex-end', padding: '6px 14px', fontSize: '11px'}}>
                  Submit Sign-off Override
                </button>
              </form>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
