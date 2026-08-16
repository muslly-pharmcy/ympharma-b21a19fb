// Google Sheets bridge — server only.
// Appends CRM rows to the operations spreadsheet through the Lovable
// connector gateway (OAuth token refresh handled by the gateway).

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/google_sheets/v4'

/** Default operations spreadsheet (overridable via app_settings). */
export const DEFAULT_SPREADSHEET_ID = '1UnYdgwEk6OZbui3gQ42rn_Tx2R6d68AOP9eITqAmMhQ'
export const DEFAULT_SHEET_RANGE = 'Sheet1!A:E'

export interface SheetRow {
  fullName: string
  phone: string
  details: string
  category: string
  /** ISO timestamp; formatted to Asia/Aden locale before append. */
  at?: string
}

function formatDate(iso?: string): string {
  const d = iso ? new Date(iso) : new Date()
  try {
    return new Intl.DateTimeFormat('ar-YE', {
      timeZone: 'Asia/Aden',
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(d)
  } catch {
    return d.toISOString()
  }
}

export function toSheetValues(row: SheetRow): string[] {
  return [row.fullName || '—', row.phone || '—', row.details || '—', row.category || 'عام', formatDate(row.at)]
}

export interface AppendResult {
  ok: boolean
  status: number
  error?: string
  via: 'gateway' | 'webhook'
}

/**
 * Append one row. Prefers an explicit webhook URL when configured
 * (`GOOGLE_SHEETS_WEBHOOK_URL` app setting), otherwise the connector gateway.
 */
export async function appendSheetRow(
  row: SheetRow,
  opts?: { spreadsheetId?: string; range?: string; webhookUrl?: string | null },
): Promise<AppendResult> {
  const values = toSheetValues(row)

  if (opts?.webhookUrl) {
    try {
      const r = await fetch(opts.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values, row }),
      })
      const text = r.ok ? '' : await r.text()
      return { ok: r.ok, status: r.status, error: r.ok ? undefined : text.slice(0, 500), via: 'webhook' }
    } catch (e) {
      return { ok: false, status: 0, error: (e as Error).message, via: 'webhook' }
    }
  }

  const lovableKey = process.env['LOVABLE_API_KEY']
  const connKey = process.env['GOOGLE_SHEETS_API_KEY']
  if (!lovableKey || !connKey) {
    return { ok: false, status: 0, error: 'Google Sheets connection is not configured', via: 'gateway' }
  }

  const spreadsheetId = opts?.spreadsheetId || DEFAULT_SPREADSHEET_ID
  const range = opts?.range || DEFAULT_SHEET_RANGE
  const url = `${GATEWAY_URL}/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        'X-Connection-Api-Key': connKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [values] }),
    })
    if (!r.ok) {
      const body = await r.text()
      console.error(`[google-sheets] append failed [${r.status}]: ${body}`)
      return { ok: false, status: r.status, error: body.slice(0, 500), via: 'gateway' }
    }
    return { ok: true, status: r.status, via: 'gateway' }
  } catch (e) {
    return { ok: false, status: 0, error: (e as Error).message, via: 'gateway' }
  }
}
