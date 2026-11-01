const DEFAULT_ALLOWED_EMAIL = 'contact@513sips.com'

export function parseAllowedEmails(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return [DEFAULT_ALLOWED_EMAIL]
  }

  const emails = raw
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)

  return emails.length > 0 ? emails : [DEFAULT_ALLOWED_EMAIL]
}

export function isAllowedEmail(email: string, allowed: string[]): boolean {
  const normalizedEmail = email.trim().toLowerCase()
  return allowed.some((allowedEmail) => allowedEmail.trim().toLowerCase() === normalizedEmail)
}
