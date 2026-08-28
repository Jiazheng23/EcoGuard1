import { supabase } from './supabaseClient'

function throwIfError(error) {
  if (error) throw error
}

export async function listEarlyWarningNotifications(userId, limit = 30) {
  const [alertsResult, readsResult] = await Promise.all([
    supabase
      .from('early_warning_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('early_warning_alert_reads')
      .select('alert_id')
      .eq('user_id', userId),
  ])
  throwIfError(alertsResult.error)
  throwIfError(readsResult.error)
  const readIds = new Set((readsResult.data || []).map((item) => String(item.alert_id)))
  return (alertsResult.data || []).map((alert) => ({
    ...alert,
    read: readIds.has(String(alert.id)),
  }))
}

export async function markEarlyWarningsRead(userId, alertIds) {
  if (!alertIds.length) return
  const { error } = await supabase
    .from('early_warning_alert_reads')
    .upsert(alertIds.map((alertId) => ({ alert_id: alertId, user_id: userId })), {
      onConflict: 'alert_id,user_id',
      ignoreDuplicates: true,
    })
  throwIfError(error)
}

export function subscribeToEarlyWarnings(onChange) {
  const channel = supabase
    .channel('early-warning-notifications')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'early_warning_alerts' }, onChange)
    .subscribe()
  return () => { void supabase.removeChannel(channel) }
}
