// Shared brand styles for MUSLLY AI OS auth emails.
// Body background stays white per email-client best practices.
export const brand = {
  primary: '#005D4F',
  primaryDark: '#004339',
  ink: '#0F172A',
  muted: '#4B5563',
  soft: '#9CA3AF',
  border: '#E5E7EB',
  panel: '#F8FAFC',
}

export const main = {
  backgroundColor: '#ffffff',
  fontFamily: "'Cairo','Tajawal','Segoe UI',Arial,sans-serif",
  margin: 0,
  padding: '32px 0',
}
export const container = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '0 24px',
}
export const card = {
  border: `1px solid ${brand.border}`,
  borderRadius: '16px',
  padding: '32px',
  backgroundColor: brand.panel,
}
export const header = {
  padding: '0 0 20px',
  borderBottom: `2px solid ${brand.primary}`,
  marginBottom: '24px',
}
export const brandName = {
  fontSize: '20px',
  fontWeight: 700 as const,
  color: brand.primary,
  margin: 0,
  letterSpacing: '0.02em',
}
export const brandTag = {
  fontSize: '12px',
  color: brand.muted,
  margin: '4px 0 0',
}
export const h1 = {
  fontSize: '22px',
  fontWeight: 700 as const,
  color: brand.ink,
  margin: '0 0 16px',
}
export const text = {
  fontSize: '15px',
  color: brand.muted,
  lineHeight: '1.7',
  margin: '0 0 20px',
}
export const link = { color: brand.primary, textDecoration: 'underline' }
export const button = {
  backgroundColor: brand.primary,
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 700 as const,
  borderRadius: '10px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'inline-block',
}
export const codeStyle = {
  fontFamily: "'Courier New',monospace",
  fontSize: '28px',
  fontWeight: 700 as const,
  color: brand.primary,
  letterSpacing: '0.4em',
  textAlign: 'center' as const,
  padding: '16px',
  backgroundColor: '#ffffff',
  border: `1px dashed ${brand.primary}`,
  borderRadius: '10px',
  margin: '0 0 24px',
}
export const footer = {
  fontSize: '12px',
  color: brand.soft,
  margin: '24px 0 0',
  lineHeight: '1.6',
  textAlign: 'center' as const,
}
