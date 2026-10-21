import 'server-only';
import { redirect } from 'next/navigation';
import type { ZodError } from 'zod';

export function flash(path: string, kind: 'ok' | 'error', msg: string): never {
  redirect(`${path}${path.includes('?') ? '&' : '?'}${kind}=${encodeURIComponent(msg)}`);
}
export const formObject = (fd: FormData) => Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === 'string')) as Record<string, string>;
export const zodMessage = (e: ZodError) => e.issues[0]?.message ?? 'Check the form and try again';

/** Maps database errors to safe messages. Never leaks SQL, table names or internals. */
export function dbMessage(e: { code?: string; message?: string } | null | undefined): string {
  if (!e) return 'Something went wrong. Try again.';
  switch (e.code) {
    case '23505': return 'That record already exists.';
    case '23503': return 'A related record was not found.';
    case '23514': return 'One of the values is not allowed.';
    case '42501': return 'You do not have permission to do that.';
    case 'P0001': return e.message ?? 'That change is not allowed.';   // our own RAISE EXCEPTION texts are written for users
    case '22P02': return 'One of the values is not valid.';
    default:
      console.error('db error', e.code);                               // code only; never log record contents
      return 'Something went wrong. Try again.';
  }
}
