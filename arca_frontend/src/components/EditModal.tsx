import React from 'react';
import { X } from 'lucide-react';
import type { MAP, Department } from '../types';

interface EditModalProps {
  activeMap: MAP;
  onClose: () => void;
  editFields: {
    title: string;
    description: string;
    deliverable: string;
    deadline: string;
    priority: string;
    departmentId: string;
    editReason: string;
  };
  setEditFields: React.Dispatch<React.SetStateAction<{
    title: string;
    description: string;
    deliverable: string;
    deadline: string;
    priority: string;
    departmentId: string;
    editReason: string;
  }>>;
  departments: Department[];
  onSubmitEdit: (e: React.FormEvent) => void;
}

export const EditModal: React.FC<EditModalProps> = ({
  activeMap,
  onClose,
  editFields,
  setEditFields,
  departments,
  onSubmitEdit
}) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth: '580px'}}>
        <button className="modal-close" onClick={onClose}>
          <X size={14} />
        </button>
        
        <span className="badge badge-info" style={{marginBottom: '6px'}}>CALIBRATING PARAMETERS</span>
        <h2 style={{margin: '0 0 4px 0', color: 'var(--text)', fontSize: '15px', fontWeight: 800}}>Calibrate Operational Directives</h2>
        <p style={{color: 'var(--text-tertiary)', fontSize: '11px', margin: '0 0 14px 0'}}>Calibrate extracted text obligations, deliverables, routed division, and target compliance deadlines</p>
        
        <form onSubmit={onSubmitEdit}>
          <label>Compliance Title Requirement</label>
          <input 
            type="text" 
            value={editFields.title} 
            onChange={(e) => setEditFields(prev => ({ ...prev, title: e.target.value }))} 
            required 
          />

          <label>Detailed Description Context</label>
          <textarea 
            rows={3} 
            value={editFields.description} 
            onChange={(e) => setEditFields(prev => ({ ...prev, description: e.target.value }))} 
            required 
          />

          <label>Mandated Compliance Deliverable</label>
          <input 
            type="text" 
            value={editFields.deliverable} 
            onChange={(e) => setEditFields(prev => ({ ...prev, deliverable: e.target.value }))} 
            required 
          />

          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginTop: '10px'}}>
            <div>
              <label>Target Deadline</label>
              <input 
                type="date" 
                value={editFields.deadline} 
                onChange={(e) => setEditFields(prev => ({ ...prev, deadline: e.target.value }))} 
              />
            </div>
            <div>
              <label>Priority Rating</label>
              <select 
                value={editFields.priority} 
                onChange={(e) => setEditFields(prev => ({ ...prev, priority: e.target.value }))}
              >
                <option value="CRITICAL">CRITICAL</option>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>
            </div>
            <div>
              <label>Route to Division</label>
              <select 
                value={editFields.departmentId} 
                onChange={(e) => setEditFields(prev => ({ ...prev, departmentId: e.target.value }))}
              >
                <option value="">Unassigned / Triage Pending</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>

          <label style={{marginTop: '10px'}}>Parameter Alteration Reason</label>
          <input 
            type="text" 
            placeholder="Reason for changing compliance rules..." 
            value={editFields.editReason} 
            onChange={(e) => setEditFields(prev => ({ ...prev, editReason: e.target.value }))} 
            required 
          />

          <div style={{display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px'}}>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">Apply parameters & Dispatch</button>
          </div>
        </form>
      </div>
    </div>
  );
};
