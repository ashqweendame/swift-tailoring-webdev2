import { useEffect } from 'react';

// persistent: ignore Escape and outside clicks (used for the order form so typed data isn't lost).
export default function Modal({ onClose, children, className = '', persistent = false }) {
  useEffect(() => {
    if (persistent) return undefined;
    const h = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose, persistent]);

  return (
    <div className="modal-overlay" onMouseDown={(e) => !persistent && e.target === e.currentTarget && onClose?.()}>
      <div className={`modal-card ${className}`} role="dialog" aria-modal="true">{children}</div>
    </div>
  );
}
