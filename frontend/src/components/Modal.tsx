import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cx } from '../lib/format';

/**
 * Shared dialog behaviour: Escape to close, focus trapped inside while
 * open, body scroll locked, first focusable element focused on open.
 * Any hand-rolled modal can call this instead of reimplementing it.
 */
export function useDialogA11y(open: boolean, onClose: () => void, panelRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'Tab') return;
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables?.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLElement>('input, button')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose, panelRef]);
}

export default function Modal({
  open,
  onClose,
  label,
  title,
  bn,
  children,
  wide = false,
  maxWidth,
  maxHeight,
}: {
  open: boolean;
  onClose: () => void;
  label?: string;
  title: string;
  bn?: string;
  children: React.ReactNode;
  wide?: boolean;
  maxWidth?: 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
  maxHeight?: string;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  useDialogA11y(open, onClose, panelRef);

  if (!open) return null;

  const widthClass = maxWidth
    ? maxWidth === '5xl'
      ? 'sm:max-w-5xl'
      : maxWidth === '4xl'
      ? 'sm:max-w-4xl'
      : maxWidth === '3xl'
      ? 'sm:max-w-3xl'
      : maxWidth === '2xl'
      ? 'sm:max-w-2xl'
      : maxWidth === 'xl'
      ? 'sm:max-w-xl'
      : maxWidth === 'lg'
      ? 'sm:max-w-lg'
      : 'sm:max-w-md'
    : wide
    ? 'sm:max-w-2xl'
    : 'sm:max-w-md';

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 md:p-6 bg-black/40 backdrop-blur-[2px] overflow-hidden"
      style={{ isolation: 'isolate' }}
    >
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ maxHeight: 'min(90vh, 760px)' }}
        className={cx(
          'anim-sheet-in relative flex flex-col w-full border border-line bg-sheet-raised shadow-2xl sm:rounded-lg overflow-hidden',
          widthClass
        )}
      >
        <header className="shrink-0 flex items-start justify-between gap-4 border-b border-line px-5 py-3.5 sm:py-4 bg-sheet-raised">
          <div>
            {label && <span className="mono block text-2xs uppercase text-ink-3">{label}</span>}
            <h2 className="sheet-title mt-0.5 text-base sm:text-lg font-semibold text-ink">{title}</h2>
            {bn && <p className="bn text-xs text-ink-3">{bn}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="no-print -mr-1 rounded-md p-1.5 text-ink-3 transition-colors duration-1 hover:bg-ground-sunk hover:text-ink focus:outline-none focus:ring-1 focus:ring-line"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div
          className={cx(
            'modal-scrollbar flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4 sm:py-5',
            maxHeight
          )}
          style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
