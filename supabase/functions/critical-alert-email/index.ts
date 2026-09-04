import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type AlertRecord = {
  id: number
  metric_id?: number | null
  location_id: number
  category: string
  severity: string
  title: string
  detail: string
  current_value: number | null
  threshold_value: number | null
  unit: string | null
  created_at: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const payload = await request.json()
    const requestedAlert = (payload.record || payload) as AlertRecord
    if (!requestedAlert?.id || requestedAlert.severity !== 'critical') {
      return json({ skipped: true, reason: 'Not a critical alert' })
    }

    const supabase = createClient(
      requiredEnv('SUPABASE_URL'),
      requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    )
    const { data: alert, error: alertError } = await supabase
      .from('early_warning_alerts')
      .select('id, metric_id, location_id, category, severity, title, detail, current_value, threshold_value, unit, created_at')
      .eq('id', requestedAlert.id)
      .eq('severity', 'critical')
      .maybeSingle()

    if (alertError) throw alertError
    if (!alert) return json({ skipped: true, reason: 'Critical alert does not exist in the database' })

    const { data: threshold, error: thresholdError } = await supabase
      .from('crowd_thresholds')
      .select('notification_email, auto_alerts')
      .eq('location_id', alert.location_id)
      .maybeSingle()

    if (thresholdError) throw thresholdError
    if (!threshold?.auto_alerts || !threshold.notification_email) {
      return json({ skipped: true, reason: 'Email alerts are disabled or no recipient is configured' })
    }

    const { data: location, error: locationError } = await supabase
      .from('ecological_locations')
      .select('name')
      .eq('id', alert.location_id)
      .maybeSingle()

    if (locationError) throw locationError
    const { data: metric, error: metricError } = await supabase
      .from('location_metrics')
      .select('recorded_at')
      .eq('location_id', alert.location_id)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (metricError) throw metricError
    if (!metric?.recorded_at) return json({ skipped: true, reason: 'No sensor reading exists for this location' })

    const { data: activeAlerts, error: activeAlertsError } = await supabase
      .from('early_warning_alerts')
      .select('id, metric_id, location_id, category, severity, title, detail, current_value, threshold_value, unit, created_at')
      .eq('location_id', alert.location_id)
      .eq('severity', 'critical')
      .is('resolved_at', null)
      .order('id', { ascending: true })

    if (activeAlertsError) throw activeAlertsError
    if (!activeAlerts?.length) return json({ skipped: true, reason: 'No active critical alerts remain' })

    const { data: delivery, error: deliveryError } = await supabase
      .from('critical_alert_email_deliveries')
      .insert({
        location_id: alert.location_id,
        sensor_recorded_at: metric.recorded_at,
        trigger_alert_id: alert.id,
      })
      .select('id')
      .single()

    if (deliveryError?.code === '23505') {
      return json({ skipped: true, reason: 'A combined email was already sent for this sensor update' })
    }
    if (deliveryError) throw deliveryError

    const accessToken = await getGmailAccessToken()
    const rawMessage = buildGmailMessage({
      from: requiredEnv('GMAIL_FROM'),
      to: threshold.notification_email,
      subject: `[CRITICAL] ${activeAlerts.length} alert${activeAlerts.length === 1 ? '' : 's'} at ${location?.name || `Location ${alert.location_id}`}`,
      html: criticalAlertHtml(activeAlerts as AlertRecord[], location?.name || `Location ${alert.location_id}`),
    })
    const emailResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: rawMessage }),
    })

    const emailResult = await emailResponse.json()
    if (!emailResponse.ok) {
      await supabase.from('critical_alert_email_deliveries').delete().eq('id', delivery.id)
      throw new Error(emailResult?.error?.message || 'Gmail rejected the request')
    }
    await supabase
      .from('critical_alert_email_deliveries')
      .update({ gmail_message_id: emailResult.id, sent_at: new Date().toISOString() })
      .eq('id', delivery.id)
    return json({ sent: true, alertCount: activeAlerts.length, messageId: emailResult.id })
  } catch (error) {
    console.error('Critical alert email failed', error)
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})

function requiredEnv(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`${name} is not configured`)
  return value
}

async function getGmailAccessToken() {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: requiredEnv('GMAIL_CLIENT_ID'),
      client_secret: requiredEnv('GMAIL_CLIENT_SECRET'),
      refresh_token: requiredEnv('GMAIL_REFRESH_TOKEN'),
      grant_type: 'refresh_token',
    }),
  })
  const result = await response.json()
  if (!response.ok || !result.access_token) {
    throw new Error(result?.error_description || 'Unable to refresh Gmail access token')
  }
  return result.access_token as string
}

function buildGmailMessage({ from, to, subject, html }: { from: string; to: string; subject: string; html: string }) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new Error('Invalid notification email')
  const safeFrom = stripHeaderBreaks(from)
  const safeTo = stripHeaderBreaks(to)
  const encodedSubject = encodeBase64(subject)
  const mime = [
    `From: EcoGuard Alerts <${safeFrom}>`,
    `To: ${safeTo}`,
    `Subject: =?UTF-8?B?${encodedSubject}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    html,
  ].join('\r\n')
  return encodeBase64(mime).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function encodeBase64(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function stripHeaderBreaks(value: string) {
  return value.replace(/[\r\n]/g, '').trim()
}

function criticalAlertHtml(alerts: AlertRecord[], locationName: string) {
  const occurredAt = new Date(alerts[0]?.created_at).toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' })
  const alertRows = alerts.map((alert) => `
    <div style="margin-top:12px;padding:14px;background:#fef2f2;border-radius:8px">
      <strong>${escapeHtml(alert.title)}</strong>
      <p style="margin:6px 0 0">${escapeHtml(alert.detail)}</p>
      <small style="color:#64748b">${escapeHtml(alert.category)}</small>
    </div>`).join('')
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#1e293b">
      <div style="background:#dc2626;color:white;padding:18px 22px;border-radius:12px 12px 0 0">
        <strong style="font-size:18px">Critical environmental alert</strong>
      </div>
      <div style="border:1px solid #fecaca;border-top:0;padding:22px;border-radius:0 0 12px 12px">
        <h2 style="margin:0 0 10px">${alerts.length} critical sensor alert${alerts.length === 1 ? '' : 's'}</h2>
        <p><strong>Location:</strong> ${escapeHtml(locationName)}</p>
        <p><strong>Recorded:</strong> ${escapeHtml(occurredAt)}</p>
        ${alertRows}
        <p style="color:#64748b;font-size:13px">Please open EcoGuard and review the latest sensor readings.</p>
      </div>
    </div>`
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;')
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
