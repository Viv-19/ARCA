import React from 'react';

export const Header: React.FC = () => {
  return (
    <div style={{ 
      background: 'var(--surface)', 
      border: '1px solid var(--border)', 
      borderRadius: '4px', 
      padding: '16px 24px', 
      marginBottom: '20px', 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center' 
    }}>
      <div>
        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.3px' }}>ARCA Command Center</h1>
        <p style={{ color: 'var(--text-tertiary)', margin: '2px 0 0 0', fontSize: '11.5px', fontWeight: 500 }}>Autonomous Compliance Tracking, Mapping & Routing Engine</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text)' }}>Compliance Officer</div>
          <div style={{ 
            fontSize: '10px', 
            color: 'var(--text-tertiary)', 
            fontWeight: 600, 
            display: 'flex', 
            alignItems: 'center', 
            gap: '4px', 
            justifyContent: 'flex-end', 
            marginTop: '1px' 
          }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#228B22' }} />
            System Active
          </div>
        </div>
        <div style={{ 
          width: '32px', 
          height: '32px', 
          borderRadius: '4px', 
          background: 'var(--sidebar-bg)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          fontWeight: 800, 
          color: 'white', 
          fontSize: '11px' 
        }}>CO</div>
      </div>
    </div>
  );
};
