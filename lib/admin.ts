export function isAdminEmail(email: string | undefined, configuredEmail?: string): boolean {
  const adminEmail = (configuredEmail || process.env.ADMIN_EMAIL || "Himanshuraj25102008@gmail.com").trim().toLowerCase();
  return Boolean(email && email.trim().toLowerCase() === adminEmail);
}
