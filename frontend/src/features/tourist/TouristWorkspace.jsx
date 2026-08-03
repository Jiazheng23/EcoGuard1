import { useState } from 'react'
import TouristDashboard from './TouristDashboard'
import TouristLayout from './TouristLayout'

export default function TouristWorkspace() {
  const [page, setPage] = useState('dashboard')
  return <TouristLayout activePage={page} onNavigate={setPage}>{page === 'dashboard' ? <TouristDashboard onNavigate={setPage} /> : <section className="rounded-2xl border border-slate-100 bg-white p-8 shadow-sm"><p className="text-sm font-semibold uppercase tracking-widest text-green-600">Coming next</p><h1 className="mt-2 text-2xl font-bold text-slate-900">{page.replace(/^./, (letter) => letter.toUpperCase())} module</h1><p className="mt-2 text-slate-500">This screen will be added after the Tourist Dashboard.</p></section>}</TouristLayout>
}
