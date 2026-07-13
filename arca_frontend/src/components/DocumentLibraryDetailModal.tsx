import React from 'react';
import type { Document } from '../types';
import { ProcessingProgress } from './ProcessingProgress';
import './DocumentLibraryDetailModal.css';

interface Props {
  document: Document;
  pipelineProgress?: any;
  onClose: () => void;
  BACKEND_URL: string;
}

export const DocumentLibraryDetailModal: React.FC<Props> = ({ 
  document, 
  pipelineProgress,
  onClose,
  BACKEND_URL 
}) => {
  
  const getPdfUrl = (doc: Document) => {
    // Some documents have an absolute URL in doc.detail_url, some have local relative URLs.
    if (doc.detail_url && doc.detail_url.startsWith('http')) return doc.detail_url;
    if (doc.detail_url && doc.detail_url.startsWith('/api')) return `${BACKEND_URL}${doc.detail_url}`;
    return `${BACKEND_URL}/api/documents/${doc.id}/pdf`; 
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content doc-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Document Details</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        
        <div className="modal-body doc-detail-body">
          <div className="detail-grid">
            
            {/* Left Column: Metadata */}
            <div className="detail-column">
              <h3>Metadata</h3>
              <table className="metadata-table">
                <tbody>
                  <tr>
                    <td><strong>RBI Number</strong></td>
                    <td>{document.circular_number || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td><strong>Title</strong></td>
                    <td>{document.title}</td>
                  </tr>
                  <tr>
                    <td><strong>Department</strong></td>
                    <td><span className="badge badge-domain">{document.department || 'N/A'}</span></td>
                  </tr>
                  <tr>
                    <td><strong>Publication Date</strong></td>
                    <td>{document.publication_date ? new Date(document.publication_date).toLocaleDateString() : 'N/A'}</td>
                  </tr>
                  <tr>
                    <td><strong>Status</strong></td>
                    <td><span className={`badge status-${document.status.toLowerCase()}`}>{document.status}</span></td>
                  </tr>
                </tbody>
              </table>

              <h3 className="section-title">Artifacts</h3>
              <div className="artifact-links">
                <a href={getPdfUrl(document)} target="_blank" rel="noreferrer" className="artifact-btn">
                  📄 View Original PDF
                </a>
                <button className="artifact-btn secondary-btn" disabled={!document.metadata_path}>
                  {'{ }'} metadata.json
                </button>
                <button className="artifact-btn secondary-btn" disabled={!document.markdown_path}>
                  📝 document.md
                </button>
              </div>
            </div>

            {/* Right Column: Processing Progress & Logs */}
            <div className="detail-column right-col">
              <h3>Processing Progress</h3>
              <div className="progress-box">
                <ProcessingProgress 
                  status={document.status} 
                  pipelineProgress={pipelineProgress} 
                />
              </div>

              <h3 className="section-title">Processing Logs</h3>
              <div className="logs-box">
                {document.pdf_path ? (
                  <pre>
                    Document ingested via Playwright.
                    Status: {document.status}
                    {document.pdf_path && `\nPDF Path: ${document.pdf_path}`}
                  </pre>
                ) : (
                  <div className="empty-logs">No processing logs available.</div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
