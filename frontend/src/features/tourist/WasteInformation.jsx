import { useState } from 'react'
import { Calendar, ChevronDown, ChevronUp, Info, Leaf, MapPin, Recycle, Trash2 } from 'lucide-react'

const schedule = [
  { day: 'Monday', zones: ['Wangsa Maju', 'Setapak', 'Gombak'], type: 'General', color: '#64748b', bg: '#f8fafc' },
  { day: 'Tuesday', zones: ['Cheras', 'Ampang', 'Ulu Kelang'], type: 'Recyclables', color: '#3b82f6', bg: '#eff6ff' },
  { day: 'Wednesday', zones: ['Petaling Jaya', 'Damansara', 'Subang'], type: 'Organic', color: '#22c55e', bg: '#f0fdf4' },
  { day: 'Thursday', zones: ['Bukit Bintang', 'KLCC', 'Chow Kit'], type: 'General', color: '#64748b', bg: '#f8fafc' },
  { day: 'Friday', zones: ['Bangsar', 'Midvalley', 'Brickfields'], type: 'Bulky Items', color: '#f59e0b', bg: '#fffbeb' },
  { day: 'Saturday', zones: ['All tourist zones', 'National Parks'], type: 'Special Collection', color: '#8b5cf6', bg: '#f5f3ff' },
]
const centers = [
  { name: 'Taman Negara Eco Station', distance: '0.3 km', accepts: ['Plastic', 'Paper', 'Glass', 'Metal'], open: '8am–6pm' },
  { name: 'Penang Hill Recycle Point', distance: '0.1 km', accepts: ['Plastic', 'Paper', 'E-Waste'], open: '7am–8pm' },
  { name: 'Tioman Island Hub', distance: '0.8 km', accepts: ['Plastic', 'Glass', 'Hazardous'], open: '9am–5pm' },
  { name: 'KLCC Eco Drop', distance: '1.2 km', accepts: ['Paper', 'Plastic', 'Metal', 'Glass'], open: '10am–9pm' },
]
const tips = [
  { category: 'Plastic', icon: '🧴', tip: 'Rinse before recycling. Remove caps from bottles — recycle them separately.', color: '#3b82f6' },
  { category: 'Paper', icon: '📄', tip: 'Keep dry and clean. Grease-stained paper goes in general waste.', color: '#f59e0b' },
  { category: 'Glass', icon: '🍶', tip: 'Never mix broken glass with other recyclables. Wrap in newspaper for safety.', color: '#0ea5e9' },
  { category: 'Organic', icon: '🌿', tip: 'Composting reduces methane. Use eco-friendly bins provided at parks.', color: '#22c55e' },
  { category: 'E-Waste', icon: '📱', tip: 'Never dump electronics. Bring them to designated e-waste centres.', color: '#ef4444' },
  { category: 'Hazardous', icon: '⚠️', tip: 'Paint, chemicals, and batteries need special disposal.', color: '#f97316' },
]
const education = [
  { title: 'Why Recycle?', text: 'Recycling 1 tonne of aluminium saves 9 tonnes of CO₂ and 4 tonnes of bauxite ore.', icon: Recycle, color: 'text-green-600' },
  { title: 'Zero Waste Tourism', text: 'Bring reusable water bottles and bags. Avoid single-use plastics entirely.', icon: Leaf, color: 'text-green-600' },
  { title: 'Eco Score & Waste', text: 'Proper disposal at eco destinations earns you +2 to +5 Eco Score points per trip.', icon: Info, color: 'text-blue-500' },
  { title: 'Composting at Destinations', text: 'Many national parks have composting bins for organic waste.', icon: Trash2, color: 'text-amber-500' },
]
const card = 'rounded-2xl border border-slate-100 bg-white p-5 shadow-sm'

export default function WasteInformation() {
  const [tab, setTab] = useState('schedule')
  const [expandedDay, setExpandedDay] = useState(null)
  const today = new Date().toLocaleDateString('en-MY', { weekday: 'long' })
  const tabs = { schedule: 'Collection Schedule', centers: 'Recycle Centers', tips: 'Sorting Tips', education: 'Education' }

  return <div className="mx-auto flex max-w-5xl flex-col gap-6"><header><h1 className="text-2xl font-bold text-slate-900">Waste Information</h1><p className="mt-1 text-sm text-slate-500">Collection schedules, recycling centres, and sustainable disposal tips</p></header><section className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[{ label: 'Recycled This Month', value: '23.4 kg', icon: '♻️', color: '#22c55e' }, { label: 'Collection Points', value: '48', icon: '📍', color: '#3b82f6' }, { label: 'Eco Score Impact', value: '+12 pts', icon: '⭐', color: '#8b5cf6' }, { label: 'Trees Saved', value: '3.2', icon: '🌳', color: '#f59e0b' }].map((stat) => <article className={`${card} flex items-center gap-3 p-4`} key={stat.label}><span className="text-2xl">{stat.icon}</span><div><p className="text-xs text-slate-400">{stat.label}</p><p className="text-xl font-bold" style={{ color: stat.color }}>{stat.value}</p></div></article>)}</section><nav className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">{Object.entries(tabs).map(([key, label]) => <button key={key} onClick={() => setTab(key)} className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold ${tab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>{label}</button>)}</nav>{tab === 'schedule' && <Schedule today={today} expandedDay={expandedDay} onExpand={setExpandedDay} />}{tab === 'centers' && <Centers />}{tab === 'tips' && <Tips />}{tab === 'education' && <Education />}</div>
}

function Schedule({ today, expandedDay, onExpand }) { return <section className="space-y-3"><div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700"><Calendar size={16} /><p>Today is <b>{today}</b> — check your zone's scheduled collection below.</p></div>{schedule.map((item) => <article className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm" key={item.day}><button className="flex w-full items-center justify-between p-4 text-left" onClick={() => onExpand(expandedDay === item.day ? null : item.day)}><div className="flex flex-wrap items-center gap-2"><b className="text-sm text-slate-800">{item.day}</b><span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ color: item.color, background: item.bg }}>{item.type}</span>{item.day === today && <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">Today</span>}</div>{expandedDay === item.day ? <ChevronUp size={17} className="text-slate-400" /> : <ChevronDown size={17} className="text-slate-400" />}</button>{expandedDay === item.day && <div className="border-t border-slate-100 px-4 pb-4"><p className="mb-2 mt-3 text-xs font-medium text-slate-500">Collection Zones:</p><div className="flex flex-wrap gap-2">{item.zones.map((zone) => <span className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600" key={zone}><MapPin size={12} />{zone}</span>)}</div><p className="mt-3 text-xs text-slate-400">Place bins out by <b>7:00 AM</b>. Collection by <b>8:00 PM</b>.</p></div>}</article>)}</section> }
function Centers() { return <section className="grid gap-4 md:grid-cols-2">{centers.map((center) => <article className={`${card} flex flex-col gap-3`} key={center.name}><div className="flex justify-between gap-2"><div><h2 className="font-bold text-slate-800">{center.name}</h2><p className="mt-1 flex items-center gap-1 text-xs text-slate-400"><MapPin size={12} />{center.distance} away</p></div><span className="h-fit rounded-lg bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">{center.open}</span></div><div className="flex flex-wrap gap-1.5">{center.accepts.map((item) => <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600" key={item}>{item}</span>)}</div><button className="mt-1 flex items-center gap-1 text-left text-xs font-semibold text-green-600"><MapPin size={13} /> Get Directions</button></article>)}</section> }
function Tips() { return <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{tips.map((tip) => <article className={card} key={tip.category}><div className="mb-3 flex items-center gap-3"><span className="text-3xl">{tip.icon}</span><h2 className="font-bold" style={{ color: tip.color }}>{tip.category}</h2></div><p className="text-sm leading-6 text-slate-600">{tip.tip}</p></article>)}</section> }
function Education() { return <section className="space-y-4"><div className="grid gap-4 md:grid-cols-2">{education.map(({ title, text, icon: Icon, color }) => <article className={card} key={title}><div className="mb-3 flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-green-50"><Icon size={19} className={color} /></span><h2 className="font-bold text-slate-800">{title}</h2></div><p className="text-sm leading-6 text-slate-600">{text}</p></article>)}</div><article className="rounded-2xl bg-gradient-to-br from-green-600 to-teal-600 p-5 text-white"><h2 className="font-bold">Malaysia's 2030 Waste Target</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-white/80">Malaysia aims to achieve a 40% solid waste recycling rate by 2030. Your EcoGuard actions contribute to this sustainability target.</p><div className="mt-4 flex gap-8"><Stat label="Current Rate" value="31%" /><Stat label="2030 Target" value="40%" /><Stat label="Your Impact" value="↑ 0.02%" /></div></article></section> }
function Stat({ label, value }) { return <div><p className="text-xs text-white/60">{label}</p><p className="text-xl font-bold">{value}</p></div> }
