import { Check, CheckCircle2, CircleAlert, Clock, RotateCcw, ShieldCheck, UserX } from 'lucide-react';
import type { Attendance, Outcome } from '@/lib/domain/assessment';

/**
 * One definition of how each status looks, shared by the boards, student profile and reports.
 * Every status has a distinct icon AND a text label, so colour is never the only signal.
 * `on` is the selected state for toggle buttons, `chip` the compact read-only state.
 */
export const OUTCOME_META: Record<Outcome, { Icon: typeof CheckCircle2; on: string; chip: string; bar: string; hint: string }> = {
  understood: { Icon: CheckCircle2, on: 'border-ok bg-ok-soft text-ok', chip: 'border-ok/40 bg-ok-soft text-ok', bar: '#86cf9f', hint: 'Got it' },
  needs_revision: { Icon: RotateCcw, on: 'border-warn bg-warn-soft text-warn', chip: 'border-warn/40 bg-warn-soft text-warn', bar: '#e6ae5c', hint: 'Revisit' },
  didnt_understand: { Icon: CircleAlert, on: 'border-bad bg-bad-soft text-bad', chip: 'border-bad/40 bg-bad-soft text-bad', bar: '#ef8a84', hint: 'Re-teach' },
};

export const ATTENDANCE_META: Record<Attendance, { Icon: typeof Check; on: string; chip: string }> = {
  present: { Icon: Check, on: 'border-ok bg-ok-soft text-ok', chip: 'border-ok/40 bg-ok-soft text-ok' },
  absent: { Icon: UserX, on: 'border-bad bg-bad-soft text-bad', chip: 'border-bad/40 bg-bad-soft text-bad' },
  late: { Icon: Clock, on: 'border-warn bg-warn-soft text-warn', chip: 'border-warn/40 bg-warn-soft text-warn' },
  excused: { Icon: ShieldCheck, on: 'border-gold bg-brand-soft text-gold-light', chip: 'border-gold/40 bg-brand-soft text-gold-light' },
};
