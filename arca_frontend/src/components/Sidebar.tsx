import React from 'react';
import { 
  Shield, 
  Activity, 
  Layers, 
  Send, 
  Users, 
  Upload, 
  FileText, 
  ExternalLink, 
  Play, 
  RefreshCw, 
  Cpu,
  Database,
  Clock
} from 'lucide-react';
import type { Document } from '../types';

interface SidebarProps {
  activeTab: 'dashboard' | 'review' | 'tracker' | 'portal' | 'ingestion' | 'workbench' | 'library' | 'sessions';
  setActiveTab: (tab: 'dashboard' | 'review' | 'tracker' | 'portal' | 'ingestion' | 'workbench' | 'library' | 'sessions') => void;
  pendingMapsCount: number;
  activeDispatchesCount: number;
  isConnected: boolean;
  documents: Document[];
  pipelineProgress: Record<string, string>;
  onTriggerPipeline: (docId: string) => void;
  onOpenAllDocs: () => void;
  wsLogs: string[];
  BACKEND_URL: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  pendingMapsCount,
  activeDispatchesCount,
  isConnected,
  documents,
  pipelineProgress,
  onTriggerPipeline,
  onOpenAllDocs,
  wsLogs,
  BACKEND_URL
}) => {
  return (
    <div className="sidebar">
      <div className="logo-container">
        <Shield size={20} color="#EAB308" />
        <div>
          <div className="logo-text">ARCA</div>
          <div style={{
            fontSize: '9px', 
            color: '#A0A8B4', 
            fontWeight: 700, 
            display: 'flex', 
            alignItems: 'center', 
            gap: '5px', 
            marginTop: '1px', 
            letterSpacing: '0.5px', 
            textTransform: 'uppercase'
          }}>
            COMPLIANCE HUB
            <span className="animate-pulse-slow" style={{
              width: '5px', 
              height: '5px', 
              borderRadius: '50%', 
              background: isConnected ? '#228B22' : '#DC2626'
            }} title={isConnected ? "WebSocket Connected" : "WebSocket Offline"} />
          </div>
        </div>
      </div>
      
      <div className="nav-menu">
        <div className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
          <Activity size={14} />
          Executive Panel
        </div>
        <div className={`nav-item ${activeTab === 'review' ? 'active' : ''}`} onClick={() => setActiveTab('review')}>
          <Layers size={14} />
          Review Queue
          {pendingMapsCount > 0 && <span className="badge badge-warning" style={{marginLeft: 'auto', fontSize: '9px', padding: '1px 5px'}}>{pendingMapsCount}</span>}
        </div>
        <div className={`nav-item ${activeTab === 'tracker' ? 'active' : ''}`} onClick={() => setActiveTab('tracker')}>
          <Send size={14} />
          Dispatch Tracker
          {activeDispatchesCount > 0 && <span className="badge badge-info" style={{marginLeft: 'auto', fontSize: '9px', padding: '1px 5px'}}>{activeDispatchesCount}</span>}
        </div>
        <div className={`nav-item ${activeTab === 'portal' ? 'active' : ''}`} onClick={() => setActiveTab('portal')}>
          <Users size={14} />
          Department Board
        </div>
        <div className={`nav-item ${activeTab === 'ingestion' ? 'active' : ''}`} onClick={() => setActiveTab('ingestion')}>
          <Upload size={14} />
          Circular Ingest
        </div>
        <div className={`nav-item ${activeTab === 'library' ? 'active' : ''}`} onClick={() => setActiveTab('library')}>
          <Database size={14} />
          Document Library
        </div>
        <div className={`nav-item ${activeTab === 'sessions' ? 'active' : ''}`} onClick={() => setActiveTab('sessions')}>
          <Clock size={14} />
          Sessions
        </div>
        <div className={`nav-item ${activeTab === 'workbench' ? 'active' : ''}`} onClick={() => setActiveTab('workbench')}>
          <Cpu size={14} />
          Agent Workbench
        </div>
      </div>

      {/* Latest Ingested Circulars Widget */}
      <div style={{marginTop: '15px', borderTop: '1px solid #2C3540', paddingTop: '12px', fontSize: '10px', display: 'flex', flexDirection: 'column'}}>
        <div style={{
          fontWeight: 700, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          marginBottom: '8px', 
          color: '#A0A8B4', 
          letterSpacing: '0.5px', 
          textTransform: 'uppercase', 
          fontSize: '9px'
        }}>
          <span style={{display: 'flex', alignItems: 'center', gap: '5px'}}>
            <FileText size={10} color="#8BB4D0" />
            LATEST CIRCULARS
          </span>
          <span className="badge" style={{
            fontSize: '8px', 
            cursor: 'pointer', 
            padding: '1px 4px', 
            background: '#2C3540', 
            color: '#E2E8F0', 
            border: '1px solid #4A5568', 
            borderRadius: '3px'
          }} onClick={onOpenAllDocs}>
            All PDFs
          </span>
        </div>
        
        <div style={{display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '150px', overflowY: 'auto'}}>
          {documents.slice(0, 5).map((doc) => (
            <div key={doc.id} style={{background: '#1F2630', padding: '6px 8px', borderRadius: '4px', border: '1px solid #2C3540'}}>
              <div style={{
                fontWeight: 600, 
                color: '#E2E8F0', 
                whiteSpace: 'nowrap', 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                maxWidth: '170px'
              }} title={doc.title}>
                {doc.title}
              </div>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px'}}>
                <span style={{
                  fontSize: '8px', 
                  color: doc.status === 'PROCESSED' ? '#228B22' : doc.status === 'PROCESSING' ? '#EAB308' : '#A0A8B4', 
                  fontWeight: 700
                }}>
                  {doc.status}
                </span>
                <div style={{display: 'flex', gap: '6px', alignItems: 'center'}}>
                  {(doc.pdfUrl || doc.detail_url) && (
                    <a href={doc.pdfUrl || doc.detail_url} target="_blank" rel="noreferrer" title="Open RBI website link" style={{color: '#60A5FA', display: 'inline-flex'}}>
                      <ExternalLink size={10} />
                    </a>
                  )}
                  <a href={`${BACKEND_URL}/api/documents/${doc.id}/file`} target="_blank" rel="noreferrer" title="Open local PDF" style={{color: '#EAB308', display: 'inline-flex'}}>
                    <FileText size={10} />
                  </a>
                  {['NEW', 'DOWNLOADED', 'FAILED'].includes(doc.status) && (
                    <button 
                      style={{background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#34D399', display: 'inline-flex'}}
                      onClick={() => onTriggerPipeline(doc.id)}
                      disabled={pipelineProgress[doc.id] === 'PROCESSING'}
                      title="Trigger Compliance Pipeline"
                    >
                      {pipelineProgress[doc.id] === 'PROCESSING' ? (
                        <RefreshCw size={10} className="animate-spin" />
                      ) : (
                        <Play size={10} />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {documents.length === 0 && (
            <span style={{color: '#64748B', fontStyle: 'italic', fontSize: '9px'}}>No circulars loaded yet.</span>
          )}
        </div>
      </div>

      {/* Live Pipeline Stream */}
      <div style={{marginTop: 'auto', padding: '10px 0', fontSize: '10px'}}>
        <div style={{
          fontWeight: 700, 
          display: 'flex', 
          alignItems: 'center', 
          gap: '5px', 
          marginBottom: '6px', 
          color: '#A0A8B4', 
          letterSpacing: '0.5px', 
          textTransform: 'uppercase', 
          fontSize: '9px'
        }}>
          <Cpu size={10} color="#8BB4D0" />
          LIVE PIPELINE
        </div>
        <div className="terminal-screen" style={{maxHeight: '140px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px'}}>
          {wsLogs.length === 0 ? (
            <span style={{color: '#64748B', fontStyle: 'italic'}}>Awaiting pipeline events...</span>
          ) : (
            wsLogs.map((log, idx) => <div key={idx}>{log}</div>)
          )}
        </div>
      </div>
    </div>
  );
};
