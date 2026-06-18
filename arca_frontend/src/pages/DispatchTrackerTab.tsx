import React from 'react';
import { Send, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import type { MAP } from '../types';

interface DispatchTrackerTabProps {
  activeDispatches: MAP[];
  openDetailModal: (map: MAP) => void;
  scoreColor: (s: number) => string;
}

export const DispatchTrackerTab: React.FC<DispatchTrackerTabProps> = ({
  activeDispatches,
  openDetailModal,
  scoreColor
}) => {
  return (
    <div>
      <div style={{marginBottom: '16px'}}>
        <h2 style={{margin: 0, fontSize: '16px', fontWeight: 800}}>Compliance Dispatch Tracker</h2>
        <p style={{color: 'var(--text-tertiary)', margin: '2px 0 0 0', fontSize: '11px'}}>Audit live status, automated verification scripts, and final override decisions</p>
      </div>

      {activeDispatches.length === 0 ? (
        <div className="glass-panel" style={{padding: '40px', textAlign: 'center'}}>
          <Send size={36} style={{color: 'var(--text-disabled)', opacity: 0.3, marginBottom: '10px'}} />
          <h3 style={{margin: '0 0 4px 0', color: 'var(--text)'}}>No active dispatches</h3>
          <p style={{margin: 0, fontSize: '12px', color: 'var(--text-tertiary)'}}>Approve compliance MAP tasks from the Review Queue to route them to the relevant departments.</p>
        </div>
      ) : (
        <div className="glass-panel" style={{padding: 0, overflow: 'hidden'}}>
          <table className="table-full">
            <thead>
              <tr>
                <th>MAP Code</th>
                <th>Triage Title</th>
                <th>Routed Division</th>
                <th>Target Deadline</th>
                <th>Audit Status</th>
                <th style={{textAlign: 'right'}}>Action</th>
              </tr>
            </thead>
            <tbody>
              {activeDispatches.map((map) => {
                return (
                  <tr key={map.id}>
                    <td className="mono" style={{fontWeight: 700}}>{map.mapCode}</td>
                    <td style={{maxWidth: '300px'}}>
                      <div style={{fontWeight: 700, color: 'var(--text)', fontSize: '12px'}}>{map.title}</div>
                      <div style={{fontSize: '10.5px', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px'}}>{map.description}</div>
                    </td>
                    <td>
                      {map.department ? (
                        <span className="badge badge-info">{map.department.name}</span>
                      ) : (
                        <span className="badge badge-danger">Unassigned</span>
                      )}
                    </td>
                    <td className="mono" style={{fontSize: '11px', color: 'var(--text-secondary)'}}>
                      {map.deadline ? new Date(map.deadline).toLocaleDateString() : 'No deadline'}
                    </td>
                    <td>
                      <span style={{
                        fontWeight: 700, 
                        fontSize: '10px', 
                        color: map.status === 'PASSED' ? '#228B22' : map.status === 'FAILED' ? '#DC2626' : map.status === 'UNDER_AI_AUDIT' ? '#EAB308' : '#2563EB'
                      }}>
                        {map.status}
                      </span>
                    </td>
                    <td style={{textAlign: 'right'}}>
                      <button className="btn-secondary" style={{padding: '4px 8px', fontSize: '10px'}} onClick={() => openDetailModal(map)}>Audit</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
