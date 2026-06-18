import React from 'react';
import { 
  RefreshCw, 
  CheckSquare, 
  Clock, 
  AlertTriangle, 
  Users, 
  FileText 
} from 'lucide-react';
import type { Alert, Department, AuditLog } from '../types';

interface DashboardTabProps {
  overallScore: number;
  totalActive: number;
  totalAtRisk: number;
  totalOverdue: number;
  alerts: Alert[];
  departments: Department[];
  recentLogs: AuditLog[];
  onAlertScan: () => void;
  onResolveAlert: (id: string) => void;
  scoreColor: (s: number) => string;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  overallScore,
  totalActive,
  totalAtRisk,
  totalOverdue,
  alerts,
  departments,
  recentLogs,
  onAlertScan,
  onResolveAlert,
  scoreColor
}) => {
  return (
    <div>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
        <div>
          <h2 style={{margin: 0, fontSize: '16px', fontWeight: 800}}>Executive Scorecard</h2>
          <p style={{color: 'var(--text-tertiary)', margin: '2px 0 0 0', fontSize: '11px'}}>Real-time audit aggregations, overdue counts, and systemic risk posture</p>
        </div>
        <button className="btn-secondary" onClick={onAlertScan} style={{fontSize: '11px', padding: '6px 14px'}}>
          <RefreshCw size={11} />
          Run Alert Check
        </button>
      </div>

      {/* Metrics cards */}
      <div className="metrics-grid">
        <div className="glass-panel metric-card" style={{display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
          <div>
            <div className="metric-title">Compliance Index</div>
            <div className="metric-value" style={{color: scoreColor(overallScore)}}>{overallScore}%</div>
          </div>
          <div className="progress-ring-container">
            <div className="progress-text" style={{color: 'var(--text)'}}>{overallScore}%</div>
            <svg width="72" height="72">
              <circle cx="36" cy="36" r="28" fill="transparent" stroke="var(--border)" strokeWidth="4" />
              <circle cx="36" cy="36" r="28" fill="transparent" stroke={scoreColor(overallScore)} strokeWidth="4" 
                strokeDasharray={`${2 * Math.PI * 28}`} 
                strokeDashoffset={`${2 * Math.PI * 28 * (1 - overallScore/100)}`} 
                strokeLinecap="butt"
                transform="rotate(-90 36 36)"
              />
            </svg>
          </div>
        </div>

        <div className="glass-panel metric-card">
          <div className="metric-title">Active Assigned MAPs</div>
          <div className="metric-value">{totalActive}</div>
          <div className="badge badge-info" style={{marginTop: '4px'}}><CheckSquare size={9} /> Active pipelines</div>
        </div>

        <div className="glass-panel metric-card warning-border">
          <div className="metric-title">At Risk Items</div>
          <div className="metric-value" style={{color: '#EAB308'}}>{totalAtRisk}</div>
          <div className="badge badge-warning" style={{marginTop: '4px'}}><Clock size={9} /> Near deadline (7d)</div>
        </div>

        <div className="glass-panel metric-card danger-border">
          <div className="metric-title">Overdue Penalties</div>
          <div className="metric-value" style={{color: '#DC2626'}}>{totalOverdue}</div>
          <div className="badge badge-danger" style={{marginTop: '4px'}}><AlertTriangle size={9} /> Escalated</div>
        </div>
      </div>

      {/* Alerts Panel */}
      {alerts.length > 0 && (
        <div className="glass-panel" style={{padding: '16px', marginBottom: '20px', borderLeft: '3px solid #DC2626'}}>
          <h3 style={{
            margin: '0 0 10px 0', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px', 
            color: '#DC2626', 
            fontSize: '12px', 
            fontWeight: 700, 
            textTransform: 'uppercase', 
            letterSpacing: '0.5px'
          }}>
            <AlertTriangle size={13} />
            System Risk Escalation Warnings
          </h3>
          <div style={{display: 'flex', flexDirection: 'column', gap: '6px'}}>
            {alerts.map((al) => (
              <div key={al.id} style={{
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                padding: '8px 12px', 
                background: 'var(--surface-raised)', 
                borderRadius: '4px', 
                border: '1px solid var(--border)'
              }}>
                <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                  <span className={`badge ${al.severity === 'CRITICAL' ? 'badge-danger' : 'badge-warning'}`}>{al.severity}</span>
                  <div>
                    <div style={{fontWeight: 600, color: 'var(--text)', fontSize: '12px'}}>{al.message}</div>
                    <div style={{fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-disabled)', marginTop: '1px'}}>
                      {new Date(al.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
                <button className="btn-secondary" style={{padding: '4px 10px', fontSize: '10px'}} onClick={() => onResolveAlert(al.id)}>Resolve</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Columns: Departments scorecards vs activity stream */}
      <div style={{display: 'grid', gridTemplateColumns: '1.7fr 1.3fr', gap: '16px'}}>
        {/* Departments breakdown */}
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
            <Users size={13} />
            Department Scorecards
          </h3>
          <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
            {departments.map((dept) => (
              <div key={dept.id} style={{padding: '10px 12px', background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: '4px'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px'}}>
                  <div>
                    <div style={{fontWeight: 700, fontSize: '12px', color: 'var(--text)'}}>{dept.name}</div>
                    <div style={{fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-disabled)'}}>{dept.email}</div>
                  </div>
                  <div style={{textAlign: 'right'}}>
                    <div style={{fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, color: scoreColor(dept.score)}}>{dept.score}%</div>
                    <span className={`badge ${
                      dept.riskLevel === 'LOW' ? 'badge-success' : dept.riskLevel === 'MEDIUM' ? 'badge-warning' : 'badge-danger'
                    }`} style={{fontSize: '8px', padding: '1px 4px'}}>{dept.riskLevel} Risk</span>
                  </div>
                </div>
                
                {/* Progress bar */}
                <div style={{width: '100%', height: '3px', background: 'var(--border)', borderRadius: '1px', overflow: 'hidden', marginBottom: '6px'}}>
                  <div style={{width: `${dept.score}%`, height: '100%', background: scoreColor(dept.score)}} />
                </div>
                
                <div style={{display: 'flex', gap: '10px', fontSize: '10.5px', color: 'var(--text-tertiary)'}}>
                  <div>Active Tasks: <span style={{fontWeight: 700, color: 'var(--text)'}}>{dept.atRiskCount + dept.overdueCount}</span></div>
                  <div>At Risk: <span style={{fontWeight: 700, color: '#EAB308'}}>{dept.atRiskCount}</span></div>
                  <div>Overdue: <span style={{fontWeight: 700, color: '#DC2626'}}>{dept.overdueCount}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* System Activity audit logs */}
        <div className="glass-panel" style={{padding: '18px', display: 'flex', flexDirection: 'column'}}>
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
            <FileText size={13} />
            Audit Log
          </h3>
          <div style={{display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', flex: 1, maxHeight: '550px'}}>
            {recentLogs.map((log) => (
              <div key={log.id} style={{
                padding: '10px', 
                background: 'var(--surface-raised)', 
                border: '1px solid var(--border)', 
                borderRadius: '4px',
                position: 'relative'
              }}>
                <span className="badge badge-info" style={{
                  fontSize: '8px', 
                  padding: '0px 3px', 
                  position: 'absolute', 
                  right: '10px', 
                  top: '10px'
                }}>{log.eventType}</span>
                <div style={{fontWeight: 700, color: 'var(--text)', fontSize: '11.5px'}}>{log.actor}</div>
                <p style={{margin: '4px 0 0 0', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4}}>{log.description}</p>
                <div style={{
                  fontSize: '9px', 
                  fontFamily: 'var(--font-mono)', 
                  color: 'var(--text-disabled)', 
                  marginTop: '6px', 
                  textAlign: 'right'
                }}>{new Date(log.createdAt).toLocaleString()}</div>
              </div>
            ))}
            {recentLogs.length === 0 && (
              <div style={{color: 'var(--text-disabled)', fontStyle: 'italic', fontSize: '11px'}}>No recent compliance activity recorded.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
