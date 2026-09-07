import { supabase } from './supabaseClient'

// RLS remains authoritative; the additional location scope limits the query itself.
export async function listCrowdAlertHistory(locationIds) {
  if (!locationIds.length) return []
  const rows = []
  const pageSize = 500
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.from('early_warning_alerts')
      .select('*, location_metrics(crowd_count)')
      .eq('category', 'crowd').in('location_id', locationIds)
      .order('created_at', { ascending: false }).order('id', { ascending: false })
      .range(offset, offset + pageSize - 1)
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < pageSize) return rows
  }
}
