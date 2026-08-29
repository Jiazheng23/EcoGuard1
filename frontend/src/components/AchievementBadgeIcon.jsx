import { Award, Bike, Bus, CalendarDays, Gauge, Leaf, MapPin, Repeat2, Route, Sparkles, Wind, Zap } from 'lucide-react'

const icons = { award: Award, bike: Bike, bus: Bus, calendar: CalendarDays, gauge: Gauge, leaf: Leaf, mapPin: MapPin, repeat: Repeat2, route: Route, sparkles: Sparkles, wind: Wind, zap: Zap }
const colors = {
  amber: 'bg-amber-50 text-amber-600', blue: 'bg-blue-50 text-blue-600', cyan: 'bg-cyan-50 text-cyan-600',
  emerald: 'bg-emerald-50 text-emerald-600', green: 'bg-green-50 text-green-600', indigo: 'bg-indigo-50 text-indigo-600',
  lime: 'bg-lime-50 text-lime-600', orange: 'bg-orange-50 text-orange-600', rose: 'bg-rose-50 text-rose-600',
  sky: 'bg-sky-50 text-sky-600', teal: 'bg-teal-50 text-teal-600', violet: 'bg-violet-50 text-violet-600',
}

export default function AchievementBadgeIcon({ badge, size = 22, className = '' }) {
  const Icon = icons[badge.icon] || Award
  return <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${colors[badge.color] || colors.green} ${className}`}><Icon size={size} /></span>
}
