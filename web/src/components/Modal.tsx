import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
  // Prevent scrolling behind modal when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content card animate-fade-in" 
        onClick={(e) => e.stopPropagation()}
        style={styles.modalContent}
      >
        {/* Header */}
        <div style={styles.header}>
          <h3 style={styles.title}>{title}</h3>
          <button onClick={onClose} style={styles.closeBtn}>
            <X size={20} />
          </button>
        </div>

        {/* Divider */}
        <div style={styles.divider} />

        {/* Body */}
        <div style={styles.body}>
          {children}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  modalContent: {
    maxWidth: '540px',
    width: '100%',
    padding: 0,
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    boxShadow: 'var(--card-shadow)',
    borderRadius: '14px',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1.25rem 1.5rem',
  },
  title: {
    margin: 0,
    fontSize: '1.2rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  closeBtn: {
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '0.25rem',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  },
  divider: {
    height: '1px',
    backgroundColor: 'var(--border-color)',
  },
  body: {
    padding: '1.5rem',
    maxHeight: '80vh',
    overflowY: 'auto',
  },
};
