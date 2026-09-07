export function wasteScheduleStatus(schedule, now = Date.now()) {
  if (schedule.status !== 'scheduled') return schedule.status
  if (new Date(schedule.scheduled_until).getTime() <= now) return 'overdue'
  if (new Date(schedule.scheduled_for).getTime() <= now) return 'due'
  return 'scheduled'
}

export function overdueDuration(schedule, now = Date.now()) {
  const minutes = Math.max(1, Math.floor((now - new Date(schedule.scheduled_until).getTime()) / 60000))
  if (minutes < 60) return `${minutes} min overdue`
  if (minutes < 1440) return `${Math.floor(minutes / 60)} hr overdue`
  return `${Math.floor(minutes / 1440)} day(s) overdue`
}

export function filterWasteAlerts(alerts, locationIds, { level = 'all', status = 'all', query = '' } = {}) {
  const allowed = new Set(locationIds.map(String))
  const search = query.trim().toLowerCase()
  return alerts.filter((alert) => alert.category === 'waste' && allowed.has(String(alert.location_id))
    && (level === 'all' || alert.severity === level)
    && (status === 'all' || (alert.resolved_at ? 'resolved' : 'unresolved') === status)
    && (!search || `${alert.id} ${alert.title} ${alert.detail}`.toLowerCase().includes(search)))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at) || Number(b.id) - Number(a.id))
}

export function wasteAlertResponse(alertId, schedules, collections) {
  const relatedSchedules = schedules.filter((row) => String(row.alert_id) === String(alertId))
  const scheduleIds = new Set(relatedSchedules.map((row) => String(row.id)))
  const relatedCollections = collections.filter((row) => String(row.alert_id) === String(alertId) || (row.schedule_id != null && scheduleIds.has(String(row.schedule_id))))
  return { schedules: relatedSchedules, collections: relatedCollections, activeSchedule: relatedSchedules.find((row) => row.status === 'scheduled') || null }
}
