import { X } from 'lucide-react';

export default function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmText = "Confirm", cancelText = "Cancel", confirmColor = "primary" }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel} style={{ zIndex: 9999 }}>
      <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{title || 'Confirm Action'}</h3>
          <button className="modal-close" onClick={onCancel}><X size={18} /></button>
        </div>
        <p style={{ margin: '16px 0', color: 'var(--text-secondary)', fontSize: 14 }}>
          {message}
        </p>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel}>{cancelText}</button>
          <button className={`btn btn-${confirmColor}`} onClick={() => { onConfirm(); onCancel(); }}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}
