import React, { useState } from 'react';
import './DeleteConfirmModal.css';

interface Props {
  docId: string;
  docTitle: string;
  onConfirm: (id: string) => void;
  onCancel: () => void;
}

export const DeleteConfirmModal: React.FC<Props> = ({ docId, docTitle, onConfirm, onCancel }) => {
  const [inputValue, setInputValue] = useState('');

  const isMatch = inputValue === 'DELETE';

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content delete-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Permanently Delete Document</h2>
          <button className="close-btn" onClick={onCancel}>&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="warning-banner">
            <span className="warning-icon">⚠️</span>
            <p>
              This action permanently deletes the document <strong>{docTitle}</strong>, 
              its processed artifacts, and all associated metadata.
            </p>
          </div>
          
          <p className="consequence-text">This action <strong>cannot be undone</strong>.</p>
          
          <div className="input-group">
            <label>Please type <strong>DELETE</strong> to confirm:</label>
            <input 
              type="text" 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="DELETE"
              className="delete-input"
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onCancel}>Cancel</button>
          <button 
            className="btn-danger" 
            disabled={!isMatch}
            onClick={() => onConfirm(docId)}
          >
            Delete Permanently
          </button>
        </div>
      </div>
    </div>
  );
};
