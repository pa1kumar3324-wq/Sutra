const INTERNAL_ORIGIN = 'https://sutra.internal';

export const LINK_EXPIRED = 'link_expired';

export function safeNext(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/')) return '/';
  if (value.startsWith('//') || value.includes('\\')) return '/';

  try {
    const url = new URL(value, INTERNAL_ORIGIN);
    if (url.origin !== INTERNAL_ORIGIN) return '/';
    if (!url.pathname.startsWith('/') || url.pathname.startsWith('//')) return '/';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/';
  }
}

type AuthErrorLike = {
  code?: string;
  name?: string;
  message?: string;
  status?: number;
} | null | undefined;

export function passwordUpdateMessage(error: AuthErrorLike): string {
  if (!error) {
    return 'We could not confirm that your password was updated. Please try again.';
  }

  const code = `${error.code ?? ''} ${error.name ?? ''}`.toLowerCase();

  if (
    code.includes('authsessionmissing') ||
    code.includes('session_missing') ||
    code.includes('session_not_found')
  ) {
    return 'That reset link is no longer valid or your recovery session has expired. Request a new reset link.';
  }

  if (code.includes('otp_expired') || code.includes('flow_state_not_found')) {
    return 'That reset link has expired or has already been used. Request a new reset link.';
  }

  if (code.includes('same_password') || code.includes('same password')) {
    return 'Choose a different password from your current password.';
  }

  if (code.includes('weak_password') || code.includes('password_too_short')) {
    return 'Choose a stronger password that meets the password requirements.';
  }

  return 'We could not update your password. Please try again.';
}

export function invitationPasswordMessage(error: AuthErrorLike): string {
  if (!error) {
    return 'We could not set your password. Please try again.';
  }

  const code = `${error.code ?? ''} ${error.name ?? ''}`.toLowerCase();

  if (
    code.includes('otp_expired') ||
    code.includes('flow_state_not_found') ||
    code.includes('authsessionmissing') ||
    code.includes('session_missing')
  ) {
    return 'This invitation link has expired or is no longer valid. Ask your administrator to resend the invitation.';
  }

  if (code.includes('weak_password') || code.includes('password_too_short')) {
    return 'Choose a stronger password that meets the password requirements.';
  }

  if (code.includes('same_password') || code.includes('same password')) {
    return 'Choose a different password.';
  }

  return 'We could not set your password. Please try again.';
}
