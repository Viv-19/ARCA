import React from 'react';
import { Upload, CheckSquare } from 'lucide-react';
import type { Department, MAP } from '../types';

interface DepartmentBoardTabProps {
  selectedDeptId: string;
  setSelectedDeptId: (id: string) => void;
  departments: Department[];
  deptMaps: MAP[];
  openDetailModal: (map: MAP) => void;
  openEvidenceModal: (map: MAP) => void;
}

export const DepartmentBoardTab: React.FC<DepartmentBoardTabProps> = ({
  selectedDeptId,
  setSelectedDeptId,
  departments,
  deptMaps,
  openDetailModal,
  openEvidenceModal
}) => {
  return (
    <div>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
        <div>
          <h2 style={{margin: 0, fontSize: '16px', fontWeight: 800}}>Department Board</h2>
          <p style={{color: 'var(--text-tertiary)', margin: '2px 0 0 0', fontSize: '11px'}}>Track active compliance operations, review validation runs, and submit evidence</p>
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
          <label style={{margin: 0, fontSize: '10px', fontWeight: 700, color: 'var(--text-tertiary)'}}>Department:</label>
          <select style={{width: '220px', padding: '6px 10px'}} value={selectedDeptId} onChange={(e) => setSelectedDeptId(e.target.value)}>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </div>

      {/* Kanban layout */}
      <div className="kanban-grid">
        
        {/* Column 1: DISPATCHED */}
        <div className="kanban-column">
          <div className="column-header">
            <span>DISPATCHED</span>
            <span className="badge badge-info" style={{fontSize: '8px', padding: '0px 4px'}}>{deptMaps.filter(m => m.status === 'DISPATCHED').length}</span>
          </div>
          <div className="kanban-cards">
            {deptMaps.filter(m => m.status === 'DISPATCHED').map(map => (
              <div key={map.id} className="kanban-card" onClick={() => openDetailModal(map)}>
                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '6px'}}>
                  <span className="mono" style={{fontSize: '10px', fontWeight: 700, color: 'var(--status-review-text)'}}>{map.mapCode}</span>
                  <span className={`badge ${map.priority === 'CRITICAL' ? 'badge-danger' : 'badge-warning'}`} style={{fontSize: '8px', padding: '0px 3px'}}>{map.priority}</span>
                </div>
                <div style={{fontWeight: 700, fontSize: '12px', marginBottom: '4px', color: 'var(--text)'}}>{map.title}</div>
                <div style={{fontSize: '10.5px', color: 'var(--text-tertiary)', marginBottom: '10px', lineHeight: '1.4'}}>{map.description.slice(0, 80)}...</div>
                <button className="btn-primary" style={{width: '100%', padding: '5px 0', fontSize: '10px', justifyContent: 'center'}} onClick={(e) => {
                  e.stopPropagation();
                  openEvidenceModal(map);
                }}>
                  <Upload size={10} /> Submit Proofs
                </button>
              </div>
            ))}
            {deptMaps.filter(m => m.status === 'DISPATCHED').length === 0 && (
              <div className="kanban-empty-state">
                <CheckCircleIcon size={16} />
                <div>No pending dispatches</div>
              </div>
            )}
          </div>
        </div>

        {/* Column 2: VALIDATION FAILED */}
        <div className="kanban-column" style={{ borderTopColor: '#DC2626', borderTopWidth: '2px' }}>
          <div className="column-header">
            <span style={{ color: '#7F1D1D' }}>FAILED</span>
            <span className="badge badge-danger" style={{fontSize: '8px', padding: '0px 4px'}}>{deptMaps.filter(m => m.status === 'FAILED').length}</span>
          </div>
          <div className="kanban-cards">
            {deptMaps.filter(m => m.status === 'FAILED').map(map => (
              <div key={map.id} className="kanban-card" onClick={() => openDetailModal(map)} style={{borderLeft: '3px solid #DC2626'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '6px'}}>
                  <span className="mono" style={{fontSize: '10px', fontWeight: 700, color: '#DC2626'}}>{map.mapCode}</span>
                  <span className="badge badge-danger" style={{fontSize: '8px', padding: '0px 3px'}}>FAILED</span>
                </div>
                <div style={{fontWeight: 700, fontSize: '12px', marginBottom: '4px', color: 'var(--text)'}}>{map.title}</div>
                <div style={{fontSize: '10.5px', color: '#DC2626', marginBottom: '10px', fontWeight: 600}}>AI audit rejected evidence. Review required.</div>
                <button className="btn-secondary" style={{width: '100%', padding: '5px 0', fontSize: '10px', justifyContent: 'center', color: '#DC2626', borderColor: 'var(--status-pending-border)'}} onClick={(e) => {
                  e.stopPropagation();
                  openEvidenceModal(map);
                }}>
                  <Upload size={10} /> Re-upload
                </button>
              </div>
            ))}
            {deptMaps.filter(m => m.status === 'FAILED').length === 0 && (
              <div className="kanban-empty-state">
                <CheckCircleIcon size={16} />
                <div>No failed tasks</div>
              </div>
            )}
          </div>
        </div>

        {/* Column 3: UNDER AI AUDIT */}
        <div className="kanban-column" style={{ borderTopColor: '#EAB308', borderTopWidth: '2px' }}>
          <div className="column-header">
            <span style={{ color: '#713F12' }}>IN REVIEW</span>
            <span className="badge badge-warning" style={{fontSize: '8px', padding: '0px 4px'}}>{deptMaps.filter(m => m.status === 'UNDER_AI_AUDIT').length}</span>
          </div>
          <div className="kanban-cards">
            {deptMaps.filter(m => m.status === 'UNDER_AI_AUDIT').map(map => (
              <div key={map.id} className="kanban-card" onClick={() => openDetailModal(map)} style={{borderLeft: '3px solid #EAB308'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '6px'}}>
                  <span className="mono" style={{fontSize: '10px', fontWeight: 700, color: '#EAB308'}}>{map.mapCode}</span>
                  <span className="badge badge-warning" style={{fontSize: '8px', padding: '0px 3px'}}>IN AUDIT</span>
                </div>
                <div style={{fontWeight: 700, fontSize: '12px', marginBottom: '10px', color: 'var(--text)'}}>{map.title}</div>
                <div style={{display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: 'var(--surface-raised)', borderRadius: '4px', border: '1px solid var(--border)'}}>
                  <div className="animate-spin" style={{width: '12px', height: '12px', border: '2px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%'}} />
                  <span style={{fontSize: '10.5px', color: 'var(--text-secondary)', fontWeight: 600}}>AI executing inspection sandbox...</span>
                </div>
              </div>
            ))}
            {deptMaps.filter(m => m.status === 'UNDER_AI_AUDIT').length === 0 && (
              <div className="kanban-empty-state">
                <CheckCircleIcon size={16} />
                <div>No tasks in audit</div>
              </div>
            )}
          </div>
        </div>

        {/* Column 4: PASSED */}
        <div className="kanban-column" style={{ borderTopColor: '#228B22', borderTopWidth: '2px' }}>
          <div className="column-header">
            <span style={{ color: '#14532D' }}>PASSED</span>
            <span className="badge badge-success" style={{fontSize: '8px', padding: '0px 4px'}}>{deptMaps.filter(m => m.status === 'PASSED').length}</span>
          </div>
          <div className="kanban-cards">
            {deptMaps.filter(m => m.status === 'PASSED').map(map => (
              <div key={map.id} className="kanban-card" onClick={() => openDetailModal(map)} style={{borderLeft: '3px solid #228B22'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '6px'}}>
                  <span className="mono" style={{fontSize: '10px', fontWeight: 700, color: '#228B22'}}>{map.mapCode}</span>
                  <span className="badge badge-success" style={{fontSize: '8px', padding: '0px 3px'}}>PASSED</span>
                </div>
                <div style={{fontWeight: 700, fontSize: '12px', marginBottom: '4px', color: 'var(--text)'}}>{map.title}</div>
                <div style={{fontSize: '10.5px', color: '#228B22', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px'}}>
                  <span style={{fontSize: '12px'}}>✓</span> Evidence verified & compliant
                </div>
              </div>
            ))}
            {deptMaps.filter(m => m.status === 'PASSED').length === 0 && (
              <div className="kanban-empty-state">
                <CheckCircleIcon size={16} />
                <div>No passed tasks</div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

// Simple internal icon helper
function CheckCircleIcon({ size = 20 }: { size?: number }) {
  return <div style={{ opacity: 0.3, width: size, height: size, border: '2px dashed var(--text-disabled)', borderRadius: '50%' }} />;
}
