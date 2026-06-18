import React from 'react';
import { Layers, Send, UserCheck, AlertTriangle } from 'lucide-react';
import type { MAP } from '../types';

interface ReviewQueueTabProps {
  pendingMaps: MAP[];
  bulkList: string[];
  toggleBulk: (id: string) => void;
  onApproveMap: (id: string) => void;
  onRejectMap: (id: string) => void;
  onBulkApprove: () => void;
  openDetailModal: (map: MAP) => void;
  openEditModal: (map: MAP) => void;
}

export const ReviewQueueTab: React.FC<ReviewQueueTabProps> = ({
  pendingMaps,
  bulkList,
  toggleBulk,
  onApproveMap,
  onRejectMap,
  onBulkApprove,
  openDetailModal,
  openEditModal
}) => {
  return (
    <div>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
        <div>
          <h2 style={{margin: 0, fontSize: '16px', fontWeight: 800}}>Compliance Review Queue</h2>
          <p style={{color: 'var(--text-tertiary)', margin: '2px 0 0 0', fontSize: '11px'}}>Approve, calibrate operational parameters, or reroute extracted compliance requirements</p>
        </div>
        {bulkList.length > 0 && (
          <button className="btn-primary" onClick={onBulkApprove}>
            <UserCheck size={12} />
            Bulk Dispatch ({bulkList.length})
          </button>
        )}
      </div>

      {pendingMaps.length === 0 ? (
        <div className="glass-panel" style={{padding: '40px', textAlign: 'center'}}>
          <Layers size={36} style={{color: 'var(--text-disabled)', opacity: 0.3, marginBottom: '10px'}} />
          <h3 style={{margin: '0 0 4px 0', color: 'var(--text)'}}>Triage Queue Clear</h3>
          <p style={{margin: 0, fontSize: '12px', color: 'var(--text-tertiary)'}}>All extracted compliance MAP items have been approved and dispatched.</p>
        </div>
      ) : (
        <div className="glass-panel" style={{padding: 0, overflow: 'hidden'}}>
          <table className="table-full">
            <thead>
              <tr>
                <th style={{width: '40px', textAlign: 'center'}}>
                  <input type="checkbox" onChange={(e) => {
                    if (e.target.checked) {
                      pendingMaps.forEach(m => {
                        if (!bulkList.includes(m.id)) toggleBulk(m.id);
                      });
                    } else {
                      pendingMaps.forEach(m => {
                        if (bulkList.includes(m.id)) toggleBulk(m.id);
                      });
                    }
                  }} checked={bulkList.length === pendingMaps.length && pendingMaps.length > 0} />
                </th>
                <th>MAP Code</th>
                <th>Requirement Obligation</th>
                <th>Deliverable Evidence</th>
                <th>Department</th>
                <th>Priority</th>
                <th style={{textAlign: 'right'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingMaps.map((map) => {
                const isChecked = bulkList.includes(map.id);
                return (
                  <tr key={map.id} className={isChecked ? 'row-selected' : ''}>
                    <td style={{textAlign: 'center'}}>
                      <input type="checkbox" checked={isChecked} onChange={() => toggleBulk(map.id)} />
                    </td>
                    <td className="mono" style={{fontWeight: 700}} onClick={() => openDetailModal(map)}>{map.mapCode}</td>
                    <td style={{maxWidth: '260px'}} onClick={() => openDetailModal(map)}>
                      <div style={{fontWeight: 700, color: 'var(--text)', fontSize: '12px'}}>{map.title}</div>
                      <div style={{fontSize: '10.5px', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px'}}>{map.description}</div>
                    </td>
                    <td style={{fontSize: '11px', color: 'var(--text-secondary)'}} onClick={() => openDetailModal(map)}>{map.deliverable}</td>
                    <td onClick={() => openDetailModal(map)}>
                      {map.department ? (
                        <span className="badge badge-info">{map.department.name}</span>
                      ) : (
                        <span className="badge badge-danger">Unassigned</span>
                      )}
                    </td>
                    <td onClick={() => openDetailModal(map)}>
                      <span className={`badge ${
                        map.priority === 'CRITICAL' || map.priority === 'HIGH' ? 'badge-danger' : 'badge-warning'
                      }`} style={{fontSize: '8px', padding: '1px 4px'}}>{map.priority}</span>
                    </td>
                    <td style={{textAlign: 'right'}}>
                      <div style={{display: 'flex', gap: '6px', justifyContent: 'flex-end'}}>
                        <button className="btn-secondary" style={{padding: '4px 8px', fontSize: '10px'}} onClick={() => openEditModal(map)}>Calibrate</button>
                        <button className="btn-primary" style={{padding: '4px 10px', fontSize: '10px'}} onClick={() => onApproveMap(map.id)}>Dispatch</button>
                        <button className="btn-secondary" style={{padding: '4px 8px', fontSize: '10px', color: '#DC2626', borderColor: '#FCA5A5'}} onClick={() => onRejectMap(map.id)}>Reject</button>
                      </div>
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
