import React from 'react';
import { X, ExternalLink, FileText, RefreshCw, Trash2 } from 'lucide-react';
import type { Document } from '../types';

interface AllDocsModalProps {
  onClose: () => void;
  documents: Document[];
  pipelineProgress: Record<string, string>;
  onTriggerPipeline: (docId: string) => void;
  onDeleteDocument: (docId: string) => void;
  BACKEND_URL: string;
}

export const AllDocsModal: React.FC<AllDocsModalProps> = ({
  onClose,
  documents,
  pipelineProgress,
  onTriggerPipeline,
  onDeleteDocument,
  BACKEND_URL
}) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth: '850px', maxHeight: '80vh', display: 'flex', flexDirection: 'column'}}>
        <button className="modal-close" onClick={onClose}>
          <X size={14} />
        </button>
        
        <h2 style={{margin: '0 0 14px 0', color: 'var(--text)', fontSize: '16px', fontWeight: 800}}>Ingested Regulatory Documents Library</h2>
        
        <div style={{overflowY: 'auto', flex: 1, maxHeight: '60vh'}}>
          <table className="table-full" style={{width: '100%', borderCollapse: 'collapse'}}>
            <thead>
              <tr style={{background: 'var(--surface-raised)', borderBottom: '1px solid var(--border)'}}>
                <th style={{padding: '10px', textAlign: 'left', fontSize: '10.5px', fontWeight: 700}}>Date</th>
                <th style={{padding: '10px', textAlign: 'left', fontSize: '10.5px', fontWeight: 700}}>Regulator</th>
                <th style={{padding: '10px', textAlign: 'left', fontSize: '10.5px', fontWeight: 700}}>Title</th>
                <th style={{padding: '10px', textAlign: 'left', fontSize: '10.5px', fontWeight: 700}}>Status</th>
                <th style={{padding: '10px', textAlign: 'center', fontSize: '10.5px', fontWeight: 700}}>Links</th>
                <th style={{padding: '10px', textAlign: 'right', fontSize: '10.5px', fontWeight: 700}}>Action</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id} style={{borderBottom: '1px solid var(--border)'}}>
                  <td style={{padding: '10px', fontSize: '11px', whiteSpace: 'nowrap'}} className="mono">
                    {doc.publicationDate ? new Date(doc.publicationDate).toLocaleDateString() : 'N/A'}
                  </td>
                  <td style={{padding: '10px', fontSize: '11px'}}>
                    <span className="badge badge-info" style={{fontSize: '9px'}}>{doc.regulator}</span>
                  </td>
                  <td style={{padding: '10px', fontSize: '11px', fontWeight: 600, color: 'var(--text)'}} title={doc.title}>
                    {doc.title.length > 70 ? doc.title.slice(0, 70) + '...' : doc.title}
                  </td>
                  <td style={{padding: '10px', fontSize: '11px'}}>
                    <span style={{
                      color: doc.status === 'PROCESSED' ? '#228B22' : doc.status === 'PROCESSING' ? '#EAB308' : 'var(--text-secondary)', 
                      fontWeight: 700, 
                      textTransform: 'uppercase', 
                      fontSize: '10px'
                    }}>
                      {doc.status}
                    </span>
                  </td>
                  <td style={{padding: '10px', textAlign: 'center'}}>
                    <div style={{display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center'}}>
                      {doc.pdfUrl && (
                        <a href={doc.pdfUrl} target="_blank" rel="noreferrer" title="Open RBI website link" style={{color: 'var(--primary)', display: 'inline-flex'}}>
                          <ExternalLink size={13} />
                        </a>
                      )}
                      <a href={`${BACKEND_URL}/api/documents/${doc.id}/file`} target="_blank" rel="noreferrer" title="Open local PDF" style={{color: '#EAB308', display: 'inline-flex'}}>
                        <FileText size={13} />
                      </a>
                    </div>
                  </td>
                  <td style={{padding: '10px', textAlign: 'right'}}>
                    <div style={{display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center'}}>
                      {(doc.status === 'INGESTED' || doc.status === 'FAILED') ? (
                        <button 
                          className="btn-primary" 
                          style={{padding: '4px 10px', fontSize: '10.5px'}}
                          onClick={() => onTriggerPipeline(doc.id)}
                          disabled={pipelineProgress[doc.id] === 'PROCESSING'}
                        >
                          {pipelineProgress[doc.id] === 'PROCESSING' ? (
                            <><RefreshCw size={10} className="animate-spin" style={{marginRight: '4px'}} /> Running...</>
                          ) : (
                            'Trigger Pipeline'
                          )}
                        </button>
                      ) : (
                        <span style={{color: 'var(--text-disabled)', fontSize: '10.5px'}}>Processed</span>
                      )}
                      
                      <button
                        onClick={() => onDeleteDocument(doc.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#EF4444',
                          cursor: 'pointer',
                          padding: '4px',
                          borderRadius: '4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background 0.2s'
                        }}
                        title="Delete document and memory"
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {documents.length === 0 && (
                <tr>
                  <td colSpan={6} style={{padding: '20px', textAlign: 'center', color: 'var(--text-disabled)', fontStyle: 'italic', fontSize: '11.5px'}}>
                    No documents loaded in database yet. Use the Scraper or Upload tools.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        <div style={{marginTop: '15px', borderTop: '1px solid var(--border)', paddingTop: '10px', display: 'flex', justifyContent: 'flex-end'}}>
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};
