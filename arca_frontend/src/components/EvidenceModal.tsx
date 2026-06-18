import React from 'react';
import { X, Upload } from 'lucide-react';
import type { MAP } from '../types';

interface EvidenceModalProps {
  activeMap: MAP;
  onClose: () => void;
  evidenceType: string;
  setEvidenceType: (val: string) => void;
  evidenceFiles: FileList | null;
  setEvidenceFiles: (files: FileList | null) => void;
  evidenceNotes: string;
  setEvidenceNotes: (val: string) => void;
  onSubmitEvidence: (e: React.FormEvent) => void;
}

export const EvidenceModal: React.FC<EvidenceModalProps> = ({
  activeMap,
  onClose,
  evidenceType,
  setEvidenceType,
  evidenceFiles,
  setEvidenceFiles,
  evidenceNotes,
  setEvidenceNotes,
  onSubmitEvidence
}) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth: '520px'}}>
        <button className="modal-close" onClick={onClose}>
          <X size={14} />
        </button>
        
        <h2 style={{margin: '0 0 4px 0', color: 'var(--text)', fontSize: '15px', fontWeight: 800}}>Submit Evidence Proof</h2>
        <p style={{color: 'var(--text-tertiary)', fontSize: '11px', margin: '0 0 14px 0'}}>Upload proof documents to resolve assigned compliance actions</p>
        
        <div style={{background: 'var(--surface-raised)', border: '1px solid var(--border)', padding: '12px', borderRadius: '4px', marginBottom: '14px'}}>
          <div style={{fontWeight: 700, fontSize: '11px', color: 'var(--text)', marginBottom: '4px'}}>{activeMap.title}</div>
          <div style={{fontSize: '10.5px', color: 'var(--text-tertiary)', lineHeight: '1.4', marginBottom: '8px'}}>{activeMap.description}</div>
          <div style={{fontSize: '11px', color: 'var(--primary)', fontWeight: 600}}>
            Mandated deliverable: <span style={{color: 'var(--text-secondary)'}}>{activeMap.deliverable}</span>
          </div>
          <div style={{fontSize: '10.5px', color: 'var(--text-tertiary)', marginTop: '4px'}}>
            Required proof category: <span style={{fontFamily: 'var(--font-mono)', fontSize: '9.5px', background: 'var(--border)', padding: '2px 4px', borderRadius: '3px'}}>{activeMap.evidenceRequired.join(', ')}</span>
          </div>
        </div>

        <form onSubmit={onSubmitEvidence}>
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
            <input 
              type="file" 
              id="evidence-upload-input" 
              style={{display: 'none'}} 
              multiple 
              onChange={(e) => setEvidenceFiles(e.target.files)} 
            />
            <Upload size={22} style={{color: 'var(--primary)', marginBottom: '6px'}} />
            {evidenceFiles && evidenceFiles.length > 0 ? (
              <div style={{fontWeight: 700, color: 'var(--text)', fontSize: '11.5px'}}>
                {evidenceFiles.length} file(s): {Array.from(evidenceFiles).map(f => f.name).join(', ')}
              </div>
            ) : (
              <div>
                <div style={{fontWeight: 700, fontSize: '12px', color: 'var(--text)'}}>Select evidence files</div>
                <p style={{fontSize: '10px', color: 'var(--text-disabled)', margin: '2px 0 0 0'}}>PDF, PNG, JPG, TXT, LOG formats supported</p>
              </div>
            )}
          </div>

          <label>Submission Notes</label>
          <textarea 
            rows={3} 
            placeholder="Add explanations, build version, or configuration log details..." 
            value={evidenceNotes} 
            onChange={(e) => setEvidenceNotes(e.target.value)} 
            required 
          />

          <button type="submit" className="btn-primary" style={{width: '100%', marginTop: '14px', justifyContent: 'center'}}>
            Submit Evidence
          </button>
        </form>
      </div>
    </div>
  );
};
