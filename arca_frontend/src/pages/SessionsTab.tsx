import React, { useState } from 'react';
import { 
  Cpu, 
  Clock, 
  CheckCircle, 
  Trash2, 
  ArrowRight,
  FileText,
  AlertTriangle
} from 'lucide-react';
import type { Document } from '../types';

interface SessionsTabProps {
  documents: Document[];
  handleSelectActiveDoc: (docId: string | null) => void;
  handleResetSession: (docId: string) => void;
  handleDeleteDocument: (docId: string) => void;
  setActiveTab: (tab: any) => void;
}

const PIPELINE_STEPS = [
  { key: 'INGESTED', label: 'Ingested' },
  { key: 'PROCESSING_STAGE1', label: 'AI Parsing' },
  { key: 'DRAFT_MAPS_GENERATED', label: 'MAPs Generated' },
  { key: 'PROCESSING_STAGE2', label: 'Routing' },
  { key: 'DRAFT_MAPS_ROUTED', label: 'Routed' },
  { key: 'DRAFT_PIPELINE_FINALIZED', label: 'Finalized' },
  { key: 'PROCESSED', label: 'Published' },
];

const getStepIndex = (status: string) => {
  const idx = PIPELINE_STEPS.findIndex(s => s.key === status);
  return idx === -1 ? 0 : idx;
};

const getProgressPercent = (status: string) => {
  const idx = getStepIndex(status);
  return Math.round((idx / (PIPELINE_STEPS.length - 1)) * 100);
};

export const SessionsTab: React.FC<SessionsTabProps> = ({
  documents,
  handleSelectActiveDoc,
  handleResetSession,
  handleDeleteDocument,
  setActiveTab,
}) => {
  const [subTab, setSubTab] = useState<'active' | 'completed'>('active');

  // Active = not yet PROCESSED
  const activeSessions = documents.filter(d => d.status !== 'PROCESSED' && d.status !== 'FAILED');
  // Completed = PROCESSED
  const completedSessions = documents.filter(d => d.status === 'PROCESSED');

  const currentList = subTab === 'active' ? activeSessions : completedSessions;

  const handleOpenSession = (docId: string) => {
    handleSelectActiveDoc(docId);
    setActiveTab('workbench');
  };

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={18} color="var(--primary)" />
          Pipeline Sessions
        </h2>
        <p style={{ color: 'var(--text-tertiary)', margin: '4px 0 0 0', fontSize: '11.5px' }}>
          Resume in-progress work or review completed pipelines. Each session preserves your exact progress.
        </p>
      </div>

      {/* Sub-tab switcher */}
      <div style={{ 
        display: 'flex', 
        gap: '0', 
        marginBottom: '24px',
        background: 'var(--surface-raised)',
        borderRadius: '8px',
        padding: '4px',
        width: 'fit-content'
      }}>
        <button
          onClick={() => setSubTab('active')}
          style={{
            background: subTab === 'active' ? 'var(--primary)' : 'transparent',
            color: subTab === 'active' ? '#fff' : 'var(--text-secondary)',
            border: 'none',
            padding: '8px 20px',
            fontSize: '12px',
            fontWeight: 700,
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'all 0.25s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <AlertTriangle size={12} />
          Active Sessions
          {activeSessions.length > 0 && (
            <span style={{
              background: subTab === 'active' ? 'rgba(255,255,255,0.25)' : 'var(--primary)',
              color: '#fff',
              fontSize: '9px',
              padding: '1px 6px',
              borderRadius: '8px',
              fontWeight: 800
            }}>{activeSessions.length}</span>
          )}
        </button>
        <button
          onClick={() => setSubTab('completed')}
          style={{
            background: subTab === 'completed' ? '#228B22' : 'transparent',
            color: subTab === 'completed' ? '#fff' : 'var(--text-secondary)',
            border: 'none',
            padding: '8px 20px',
            fontSize: '12px',
            fontWeight: 700,
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'all 0.25s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <CheckCircle size={12} />
          Completed
          {completedSessions.length > 0 && (
            <span style={{
              background: subTab === 'completed' ? 'rgba(255,255,255,0.25)' : '#228B22',
              color: '#fff',
              fontSize: '9px',
              padding: '1px 6px',
              borderRadius: '8px',
              fontWeight: 800
            }}>{completedSessions.length}</span>
          )}
        </button>
      </div>

      {/* Empty state */}
      {currentList.length === 0 && (
        <div className="glass-panel" style={{ 
          padding: '48px', 
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px'
        }}>
          {subTab === 'active' ? (
            <Cpu size={40} color="var(--primary)" style={{ opacity: 0.4 }} />
          ) : (
            <CheckCircle size={40} color="#228B22" style={{ opacity: 0.4 }} />
          )}
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text-secondary)' }}>
            No {subTab === 'active' ? 'Active' : 'Completed'} Sessions
          </h3>
          <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-tertiary)', maxWidth: '320px' }}>
            {subTab === 'active' 
              ? 'Upload a circular and trigger the pipeline to create a new session.'
              : 'Sessions that complete the full pipeline will appear here.'}
          </p>
        </div>
      )}

      {/* Session cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
        {currentList.map(doc => {
          const progress = getProgressPercent(doc.status);
          const stepIdx = getStepIndex(doc.status);
          const isCompleted = doc.status === 'PROCESSED';
          const accentColor = isCompleted ? '#228B22' : 'var(--primary)';

          return (
            <div 
              key={doc.id}
              className="glass-panel"
              style={{
                padding: '0',
                borderRadius: '10px',
                overflow: 'hidden',
                border: '1px solid var(--border)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                cursor: 'pointer',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Colored top bar */}
              <div style={{ height: '3px', background: accentColor }} />

              <div style={{ padding: '16px 18px' }}>
                {/* Title row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                  <FileText size={16} color={accentColor} style={{ flexShrink: 0, marginTop: '1px' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{ 
                      margin: 0, fontSize: '13px', fontWeight: 700, color: 'var(--text)',
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                    }}>
                      {doc.title}
                    </h4>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px', fontSize: '10px', color: 'var(--text-tertiary)' }}>
                      <span>{doc.regulator}</span>
                      <span>•</span>
                      <span>{doc.documentType}</span>
                    </div>
                  </div>
                </div>

                {/* Pipeline step badges */}
                <div style={{ 
                  display: 'flex', 
                  gap: '4px', 
                  marginBottom: '12px',
                  flexWrap: 'wrap'
                }}>
                  {PIPELINE_STEPS.map((step, i) => (
                    <span
                      key={step.key}
                      style={{
                        fontSize: '8px',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: i <= stepIdx 
                          ? (isCompleted ? 'rgba(34,139,34,0.15)' : 'rgba(59,130,246,0.12)') 
                          : 'var(--surface-raised)',
                        color: i <= stepIdx 
                          ? accentColor 
                          : 'var(--text-disabled)',
                        border: i === stepIdx 
                          ? `1px solid ${accentColor}` 
                          : '1px solid transparent',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      {step.label}
                    </span>
                  ))}
                </div>

                {/* Progress bar */}
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                    <span>Pipeline Progress</span>
                    <span style={{ fontWeight: 700, color: accentColor }}>{progress}%</span>
                  </div>
                  <div style={{ 
                    background: 'var(--surface-raised)', 
                    height: '6px', 
                    borderRadius: '3px', 
                    overflow: 'hidden' 
                  }}>
                    <div style={{ 
                      width: `${progress}%`, 
                      background: `linear-gradient(90deg, ${accentColor}, ${isCompleted ? '#34D399' : '#60A5FA'})`,
                      height: '100%',
                      borderRadius: '3px',
                      transition: 'width 0.6s ease'
                    }} />
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleResetSession(doc.id); }}
                      className="btn-secondary"
                      style={{
                        padding: '5px 10px',
                        fontSize: '10px',
                        color: '#EAB308',
                        borderColor: '#EAB308',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      title="Reset pipeline work — keeps document in library"
                    >
                      <Trash2 size={10} />
                      Reset
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteDocument(doc.id); }}
                      className="btn-secondary"
                      style={{
                        padding: '5px 10px',
                        fontSize: '10px',
                        color: '#DC2626',
                        borderColor: '#DC2626',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      title="Permanently delete document and all associated data"
                    >
                      <Trash2 size={10} />
                      Delete
                    </button>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleOpenSession(doc.id); }}
                    className="btn-primary"
                    style={{
                      padding: '5px 14px',
                      fontSize: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: accentColor,
                      borderColor: accentColor
                    }}
                  >
                    {isCompleted ? 'View Results' : 'Resume Session'}
                    <ArrowRight size={10} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
