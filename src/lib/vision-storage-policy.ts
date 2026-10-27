// OCR inputs come from a user's own private upload. Organization/admin roles
// do not grant a wildcard capability to sign another user's medical documents.
export function assertOwnVisionObject(userId: string, bucket: string, path: string): void {
  if (bucket !== 'prescriptions' && bucket !== 'invoice-uploads') {
    throw new Error('حاوية المستندات غير مسموحة')
  }
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(userId)
    || path.length > 500 || !path.startsWith(`${userId}/`)) {
    throw new Error('لا تملك صلاحية قراءة هذا المستند')
  }
  const filename = path.slice(userId.length + 1)
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,240}$/.test(filename) || filename.includes('..')) {
    throw new Error('مسار المستند غير صالح')
  }
}
