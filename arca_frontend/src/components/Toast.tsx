import React from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      background: type === 'success' ? '#228B22' : type === 'error' ? '#DC2626' : '#1E293B',
      color: 'white',
      padding: '12.5px 20px',
      borderRadius: '4px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      zIndex: 9999,
      fontSize: '12px',
      fontWeight: 600,
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    }}>
      {type === 'success' && <span style={{fontSize: '14px', fontWeight: 800}}>✓</span>}
      {type === 'error' && <span style={{fontSize: '14px', fontWeight: 800}}>✗</span>}
      <span>{message}</span>
      <button onClick={onClose} style={{
        background: 'none',
        border: 'none',
        color: 'rgba(255,255,255,0.7)',
        cursor: 'pointer',
        fontSize: '10px',
        marginLeft: '10px',
        padding: 0
      }}>✕</button>
    </div>
  );
};
