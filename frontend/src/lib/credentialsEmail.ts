/**
 * Tail for the "account created" toasts. The API sends the login email
 * itself (no queue worker involved) and reports whether it went out in
 * `credentials_email_sent`; the temporary password is shown in the toast
 * either way, so when the email failed the admin can hand it over directly.
 * Returns "" when the flag is absent (an older backend), so callers can
 * always append it.
 */
export function credentialsEmailNote(sent: boolean | undefined, email: string): string {
  if (sent === true) return ` Login details were emailed to ${email}.`;
  if (sent === false) return ` The email to ${email} could not be sent, so pass the password on yourself.`;
  return "";
}
