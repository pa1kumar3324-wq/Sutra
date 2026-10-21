'use client';
import { useEffect, useRef } from 'react';
import { btn, btn2 } from '@/components/ui';

/** Accessible confirmation using the native <dialog>: focus is trapped, Escape cancels, focus returns on close. */
export function ConfirmDialog({ open, title, body, confirmLabel, onConfirm, onCancel }: {
  open: boolean; title: string; body: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onCancel={(e) => { e.preventDefault(); onCancel(); }} onClick={(e) => { if (e.target === ref.current) onCancel(); }}
      aria-labelledby="confirm-title" aria-describedby="confirm-body"
      className="m-auto w-[min(92vw,420px)] rounded-card border border-line-strong bg-surface p-0 text-ink shadow-pop backdrop:bg-black/70">
      <div className="p-5 sm:p-6">
        <h2 id="confirm-title" className="text-lg font-semibold tracking-tight">{title}</h2>
        <p id="confirm-body" className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button type="button" className={btn2} onClick={onCancel}>Cancel</button>
          <button type="button" className={btn} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </dialog>
  );
}
