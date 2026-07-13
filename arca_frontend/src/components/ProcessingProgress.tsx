import React from 'react';
import './ProcessingProgress.css';

interface Props {
  status: string;
  pipelineProgress?: any;
}

const STEPS = [
  { key: 'collection', label: 'Collection' },
  { key: 'classification', label: 'Classification' },
  { key: 'download', label: 'Download' },
  { key: 'docling', label: 'Docling' },
  { key: 'summary', label: 'Summary' },
  { key: 'provision', label: 'Provision' },
  { key: 'map', label: 'MAP' },
];

export const ProcessingProgress: React.FC<Props> = ({ status, pipelineProgress }) => {
  // Maps actual backend pipeline statuses to numeric ranks for step completion logic.
  // Ranks cover both AI-registry statuses (CLASSIFIED, DOWNLOADED) and pipeline statuses.
  const getStepStatus = (stepKey: string) => {
    const hierarchy: Record<string, number> = {
      'NEW': 0,
      'INGESTED': 1,
      'CLASSIFIED': 2,
      'DOWNLOADED': 3,
      'PROCESSING': 4,
      'PROCESSING_STAGE1': 4,
      'SUMMARY_GENERATED': 4,
      'DRAFT_MAPS_GENERATED': 5,
      'PROCESSING_STAGE2': 5,
      'DRAFT_MAPS_ROUTED': 5,
      'PROCESSING_STAGE3': 6,
      'DRAFT_PIPELINE_FINALIZED': 6,
      'PROCESSED': 7,
      'MAP_GENERATED': 7,
      'COMPLETED': 7,
      'FAILED': -1,
    };

    const rank = hierarchy[status] ?? 0;

    switch (stepKey) {
      case 'collection':   return rank >= 1;
      case 'classification': return rank >= 2;
      case 'download':     return rank >= 3;
      case 'docling':      return rank >= 4 || !!pipelineProgress?.docling;
      case 'summary':      return rank >= 5 || !!pipelineProgress?.summary;
      case 'provision':    return rank >= 5 || !!pipelineProgress?.provision;
      case 'map':          return rank >= 7 || !!pipelineProgress?.map;
      default:             return false;
    }
  };

  const isFailed = status === 'FAILED';

  return (
    <div className="processing-progress-container">
      {STEPS.map((step, idx) => {
        const isDone = getStepStatus(step.key);
        
        let icon = '○';
        let className = 'step-pending';
        
        if (isDone) {
          icon = '✔';
          className = 'step-done';
        } else if (isFailed) {
          icon = '✖';
          className = 'step-failed';
        }

        return (
          <div key={step.key} className={`progress-step ${className}`}>
            <span className="step-icon">{icon}</span>
            <span className="step-label">{step.label}</span>
          </div>
        );
      })}
    </div>
  );
};
