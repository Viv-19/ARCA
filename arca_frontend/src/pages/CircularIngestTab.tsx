import React from 'react';
import { Upload, RefreshCw, Cpu, Info, ExternalLink, FileText, Trash2 } from 'lucide-react';
import type { Document } from '../types';

interface CircularIngestTabProps {
  manualRegulator: string;
  setManualRegulator: (val: string) => void;
  manualType: string;
  setManualType: (val: string) => void;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  uploadProgress: string;
  scraperStatus: any;
  intakeStatus: any;
  onTriggerScraper: () => void;
  onUploadDocument: (e: React.FormEvent) => void;
  documents: Document[];
  pipelineProgress: Record<string, string>;
  onTriggerPipeline: (docId: string) => void;
  onDeleteDocument: (docId: string) => void;
  BACKEND_URL: string;
}

export const CircularIngestTab: React.FC<CircularIngestTabProps> = ({
  manualRegulator,
  setManualRegulator,
  manualType,
  setManualType,
  selectedFile,
  setSelectedFile,
  uploadProgress,
  scraperStatus,
  intakeStatus,
  onTriggerScraper,
  onUploadDocument,
  documents,
  pipelineProgress,
  onTriggerPipeline,
  onDeleteDocument,
  BACKEND_URL
}) => {
  return (
    <div>
      <div style={{marginBottom: '16px'}}>
        <h2 style={{margin: 0, fontSize: '16px', fontWeight: 800}}>Circular Ingest Hub</h2>
        <p style={{color: 'var(--text-tertiary)', margin: '2px 0 0 0', fontSize: '11px'}}>Manually upload banking circulars or trigger automated website monitoring agents</p>
      </div>

      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
        
        {/* Manual Upload Section */}
        <div className="glass-panel" style={{padding: '18px'}}>
          <h3 style={{
            margin: '0 0 14px 0', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px', 
            fontSize: '12px', 
            fontWeight: 700, 
            textTransform: 'uppercase', 
            letterSpacing: '0.5px', 
            color: 'var(--text-secondary)'
          }}>
            <Upload size={13} />
            Manual Document Upload
          </h3>
          <form onSubmit={onUploadDocument}>
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px'}}>
              <div>
                <label>Authority Regulator</label>
                <select value={manualRegulator} onChange={(e) => setManualRegulator(e.target.value)}>
                  <option value="RBI">Reserve Bank of India (RBI)</option>
                  <option value="SEBI">SEBI</option>
                  <option value="CERT-IN">CERT-In Cybersecurity</option>
                  <option value="FIU-IND">FIU-IND Finance</option>
                </select>
              </div>
              <div>
                <label>Document Classification</label>
                <select value={manualType} onChange={(e) => setManualType(e.target.value)}>
                  <option value="circular">Circular Directive</option>
                  <option value="master_direction">Master Direction Update</option>
                  <option value="notification">Statutory Notification</option>
                </select>
              </div>
            </div>

            <div className="upload-zone" onClick={() => document.getElementById('manual-upload-input')?.click()}>
              <input 
                type="file" 
                id="manual-upload-input" 
                style={{display: 'none'}} 
                accept=".pdf" 
                onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)} 
              />
              <Upload size={24} style={{color: 'var(--primary)', marginBottom: '6px'}} />
              {selectedFile ? (
                <div style={{fontWeight: 700, color: 'var(--text)', fontSize: '12px'}}>{selectedFile.name}</div>
              ) : (
                <div>
                  <div style={{fontWeight: 700, fontSize: '12px', color: 'var(--text)'}}>Click or drag PDF circular to upload</div>
                  <p style={{fontSize: '10px', color: 'var(--text-disabled)', margin: '2px 0 0 0'}}>Maximum upload size: 15MB PDF</p>
                </div>
              )}
            </div>

            {uploadProgress && (
              <div style={{
                marginTop: '10px', 
                padding: '8px 10px', 
                background: 'var(--status-info-bg)', 
                borderRadius: '4px', 
                border: '1px solid var(--status-info-border)', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px'
              }}>
                <RefreshCw size={10} className="animate-spin" color="var(--status-info-text)" />
                <span style={{fontSize: '11px', color: 'var(--status-info-text)'}}>{uploadProgress}</span>
              </div>
            )}

            <button 
              type="submit" 
              className="btn-primary" 
              style={{width: '100%', marginTop: '14px', justifyContent: 'center'}} 
              disabled={!selectedFile || !!uploadProgress}
            >
              Trigger Ingestion Pipeline
            </button>
          </form>
        </div>

        {/* Scraper Section */}
        <div className="glass-panel" style={{padding: '18px'}}>
          <h3 style={{
            margin: '0 0 14px 0', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px', 
            fontSize: '12px', 
            fontWeight: 700, 
            textTransform: 'uppercase', 
            letterSpacing: '0.5px', 
            color: 'var(--text-secondary)'
          }}>
            <Cpu size={13} />
            Automated Scraper Controller
          </h3>
          <div style={{
            padding: '12px', 
            background: 'var(--surface-raised)', 
            border: '1px solid var(--border)', 
            borderRadius: '4px', 
            marginBottom: '14px'
          }}>
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
              <span style={{fontWeight: 600, color: 'var(--text-tertiary)', fontSize: '11px'}}>Engine Status:</span>
              <span className={`badge ${scraperStatus.status === 'RUNNING' ? 'badge-warning' : 'badge-success'}`} style={{fontSize: '8px', padding: '0px 4px'}}>
                {scraperStatus.status}
              </span>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
              <span style={{fontWeight: 600, color: 'var(--text-tertiary)', fontSize: '11px'}}>Last Run:</span>
              <span className="mono" style={{fontSize: '11px', color: 'var(--text)', fontWeight: 500}}>
                {scraperStatus.last_run ? new Date(scraperStatus.last_run).toLocaleString() : 'Never'}
              </span>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <span style={{fontWeight: 600, color: 'var(--text-tertiary)', fontSize: '11px'}}>Documents Discovered:</span>
              <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                {scraperStatus.status === 'COMPLETED' && scraperStatus.new_documents_count === 0 && scraperStatus.existing_documents_count > 0 ? (
                  <span className="badge badge-success" style={{fontSize: '9px', padding: '2px 6px', background: 'rgba(34, 139, 34, 0.1)', color: '#228B22', border: '1px solid #228B22'}}>
                    Documents up to date till today's date
                  </span>
                ) : (
                  <span className="mono" style={{fontWeight: 700, color: 'var(--text)'}}>{scraperStatus.last_results_count || 0}</span>
                )}
              </div>
            </div>
          </div>

          <div style={{display: 'flex', gap: '10px'}}>
            <button 
              className="btn-primary" 
              style={{flex: 1, justifyContent: 'center'}} 
              onClick={onTriggerScraper} 
              disabled={scraperStatus.status === 'RUNNING'}
            >
              <RefreshCw size={11} />
              Trigger Scraper Crawl
            </button>
            <a 
              href="https://rbi.org.in/Scripts/BS_CircularIndexDisplay.aspx" 
              target="_blank" 
              rel="noreferrer"
              className="btn-secondary" 
              style={{
                flex: 1, 
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center', 
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 600,
                border: '1px solid var(--border)',
                background: 'var(--surface-raised)',
                color: 'var(--text)',
                cursor: 'pointer',
                textDecoration: 'none'
              }}
            >
              <ExternalLink size={11} />
              Visit RBI Circular Website
            </a>
          </div>
          
          {/* Scraper Log Console */}
          {scraperStatus.logs && scraperStatus.logs.length > 0 && (
            <div style={{marginTop: '14px'}}>
              <div style={{
                fontWeight: 700, 
                fontSize: '10.5px', 
                color: 'var(--text-secondary)', 
                marginBottom: '6px', 
                textTransform: 'uppercase', 
                letterSpacing: '0.5px'
              }}>Scraper Crawl Logs</div>
              <div style={{
                background: 'black',
                color: '#00FF00',
                padding: '10px',
                borderRadius: '4px',
                fontFamily: 'monospace',
                fontSize: '10px',
                maxHeight: '180px',
                overflowY: 'auto',
                border: '1px solid #333',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                textAlign: 'left'
              }}>
                {scraperStatus.logs.map((log: string, idx: number) => (
                  <div key={idx} style={{whiteSpace: 'pre-wrap'}}>{log}</div>
                ))}
              </div>
            </div>
          )}

          {/* Intake Pipeline Visual Checklist */}
          {intakeStatus && intakeStatus.logs && intakeStatus.logs.length > 0 && (
            <div style={{marginTop: '16px', background: 'var(--surface-raised)', borderRadius: '6px', border: '1px solid var(--border)', overflow: 'hidden'}}>
              <div style={{
                background: 'rgba(139, 180, 208, 0.1)', 
                padding: '10px 12px', 
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Cpu size={14} color="#8BB4D0" />
                <span style={{fontWeight: 700, fontSize: '11px', color: '#8BB4D0', textTransform: 'uppercase', letterSpacing: '0.5px'}}>
                  Intelligent Intake Pipeline Activity
                </span>
                {intakeStatus.status === 'RUNNING' && <RefreshCw size={12} className="animate-spin" color="#8BB4D0" style={{marginLeft: 'auto'}} />}
              </div>
              <div style={{padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto'}}>
                {intakeStatus.logs.map((log: string, idx: number) => {
                  let icon = <Info size={12} color="var(--text-tertiary)" />;
                  let color = "var(--text)";
                  const logText = log.replace(/\[.*?\] /, ''); // strip timestamp

                  if (logText.includes("Processing") || logText.includes("Evaluating")) {
                    icon = <RefreshCw size={12} color="var(--primary)" className="animate-spin" />;
                    color = "var(--primary)";
                  } else if (logText.includes("Classification") || logText.includes("Fetching")) {
                    icon = <Cpu size={12} color="#8BB4D0" />;
                  } else if (logText.includes("Confidence") || logText.includes("confidence")) {
                    icon = <Info size={12} color="#EAB308" />;
                    color = "var(--text-secondary)";
                  } else if (logText.includes("Decision")) {
                    icon = (logText.includes("relevant=True") || logText.includes("True")) ? <Info size={12} color="#228B22" /> : <Info size={12} color="#EF4444" />;
                    color = (logText.includes("relevant=True") || logText.includes("True")) ? "#228B22" : "#EF4444";
                  } else if (logText.includes("Complete") || logText.includes("successfully")) {
                    icon = <Info size={12} color="#228B22" />;
                    color = "#228B22";
                  } else if (logText.includes("FAILED") || logText.includes("ERROR")) {
                    icon = <Info size={12} color="#EF4444" />;
                    color = "#EF4444";
                  }

                  return (
                    <div key={idx} style={{display: 'flex', gap: '8px', alignItems: 'flex-start'}}>
                      <div style={{marginTop: '2px'}}>{icon}</div>
                      <div style={{fontSize: '11px', color, lineHeight: '1.4', fontWeight: 500}}>
                        {logText}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          <div style={{
            marginTop: '14px', 
            fontSize: '10.5px', 
            color: 'var(--text-disabled)', 
            borderTop: '1px solid var(--border)', 
            paddingTop: '12px', 
            display: 'flex', 
            gap: '6px'
          }}>
            <Info size={12} style={{flexShrink: 0, color: 'var(--text-tertiary)', marginTop: '1px'}} />
            <span>The scraper launches background Playwright crawling processes to parse RBI compliance registers. Newly parsed circulars trigger real-time LangGraph multi-agent assessments.</span>
          </div>
        </div>

      </div>

      {/* Latest Scraped Documents Panel */}
      <div className="glass-panel" style={{padding: '18px', marginTop: '16px'}}>
        <h3 style={{
          margin: '0 0 14px 0', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '6px', 
          fontSize: '12px', 
          fontWeight: 700, 
          textTransform: 'uppercase', 
          letterSpacing: '0.5px', 
          color: 'var(--text-secondary)'
        }}>
          <FileText size={13} style={{color: '#8BB4D0'}} />
          Latest Scraped Documents
        </h3>
        
        <div style={{
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
          gap: '12px'
        }}>
          {documents.map((doc) => (
            <div 
              key={doc.id} 
              style={{
                background: 'var(--surface-raised)', 
                padding: '12px', 
                borderRadius: '6px', 
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px'}}>
                  <a 
                    href={doc.pdfUrl || `${BACKEND_URL}/api/documents/${doc.id}/file`} 
                    target="_blank" 
                    rel="noreferrer" 
                    style={{
                      fontWeight: 700, 
                      fontSize: '12px', 
                      color: 'var(--primary)', 
                      textDecoration: 'none',
                      display: 'block',
                      marginBottom: '6px',
                      lineHeight: '1.4',
                      flex: 1
                    }}
                    title="Click to view PDF"
                    onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                    onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                  >
                    {doc.title}
                  </a>
                  
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
                      transition: 'background 0.2s',
                      flexShrink: 0
                    }}
                    title="Delete document and memory"
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                
                <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '4px'}}>
                  <span>Regulator: <strong>{doc.regulator}</strong></span>
                  <span>Type: <strong>{doc.documentType}</strong></span>
                </div>
                
                <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '4px'}}>
                  <span>Status: <strong style={{
                    color: doc.status === 'PROCESSED' ? '#228B22' : doc.status === 'PROCESSING' ? '#EAB308' : 'var(--text-secondary)'
                  }}>{doc.status}</strong></span>
                  <span>Date: <strong>{doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : 'N/A'}</strong></span>
                </div>
              </div>
              
              <button
                className="btn-primary"
                style={{
                  width: '100%',
                  marginTop: '12px',
                  padding: '6px 12px',
                  fontSize: '11px',
                  justifyContent: 'center',
                  background: doc.status === 'PROCESSED' ? '#228B22' : 'var(--primary)',
                  borderColor: doc.status === 'PROCESSED' ? '#228B22' : 'var(--primary)',
                  cursor: (doc.status === 'PROCESSING' || pipelineProgress[doc.id] === 'PROCESSING' || doc.status === 'PROCESSED') ? 'not-allowed' : 'pointer'
                }}
                onClick={() => onTriggerPipeline(doc.id)}
                disabled={doc.status === 'PROCESSING' || pipelineProgress[doc.id] === 'PROCESSING' || doc.status === 'PROCESSED'}
              >
                {doc.status === 'PROCESSING' || pipelineProgress[doc.id] === 'PROCESSING' ? (
                  <>
                    <RefreshCw size={11} className="animate-spin" style={{marginRight: '6px'}} />
                    Processing Circular...
                  </>
                ) : doc.status === 'PROCESSED' ? (
                  'Successfully Processed & Routed'
                ) : (
                  'Send to Injection Pipeline'
                )}
              </button>
            </div>
          ))}
          
          {documents.length === 0 && (
            <div style={{gridColumn: '1 / -1', padding: '24px', textAlign: 'center', color: 'var(--text-disabled)', fontStyle: 'italic', fontSize: '11px'}}>
              No circular documents available.
            </div>
          )}
        </div>
      </div>

    </div>
  );
};
