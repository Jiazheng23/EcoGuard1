import { useEffect, useState } from 'react'
import { Building2, FileCheck2, LoaderCircle, LogOut, MapPin, Search, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabaseClient'
import { searchMalaysiaLocations } from '../../services/mapService'
import { fileToBase64, getApplicationSetup, submitLocationAdminApplication } from '../../services/locationAdminApplicationService'

const methods = [
  { value: 'search', label: 'Search location', hint: 'Enter a place name or full address', icon: Search },
  { value: 'existing', label: 'Available location', hint: 'Choose an unassigned location', icon: Building2 },
]

export default function LocationAdminApplicationPage() {
  const navigate = useNavigate()
  const [method, setMethod] = useState('search')
  const [locations, setLocations] = useState([])
  const [locationId, setLocationId] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState(null)
  const [locationName, setLocationName] = useState('')
  const [document, setDocument] = useState(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [isResubmission, setIsResubmission] = useState(false)

  useEffect(() => {
    getApplicationSetup().then((data) => {
      if (data.applicationStatus === 'pending') return navigate('/location_admin/pending', { replace: true })
      setIsResubmission(data.applicationStatus === 'rejected')
      setLocations(data.locations || [])
    }).catch((error) => setMessage(error.message)).finally(() => setLoading(false))
  }, [navigate])

  async function search(event) {
    event.preventDefault()
    if (query.trim().length < 2) return setMessage('Enter at least 2 characters.')
    setSearching(true); setMessage(''); setSelected(null); setLocationName('')
    try { setResults(await searchMalaysiaLocations(query.trim())) }
    catch (error) { setMessage(error.message) }
    finally { setSearching(false) }
  }

  async function submit(event) {
    event.preventDefault(); setMessage('')
    if (method === 'existing' && !locationId) return setMessage('Choose an available location.')
    if (method !== 'existing' && !selected) return setMessage('Select one OpenStreetMap search result.')
    if (method !== 'existing' && !locationName.trim()) return setMessage('Enter a short name for the location.')
    if (!document) return setMessage('Upload your supporting company document.')
    if (document.size > 5 * 1024 * 1024) return setMessage('The company document must be 5 MB or smaller.')
    setSubmitting(true)
    try {
      await submitLocationAdminApplication({
        locationMethod: method,
        locationId: method === 'existing' ? Number(locationId) : undefined,
        customLocation: method === 'existing' ? undefined : {
          name: locationName.trim(),
          address: selected.name,
          latitude: selected.lat,
          longitude: selected.lng,
          state: selected.state,
        },
        companyDocument: { name: document.name, type: document.type, base64: await fileToBase64(document) },
      })
      navigate('/location_admin/pending', { replace: true })
    } catch (error) { setMessage(error.message) }
    finally { setSubmitting(false) }
  }

  async function logout() { await supabase.auth.signOut(); navigate('/login', { replace: true }) }

  return <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
    <section className="mx-auto max-w-3xl rounded-3xl border border-slate-100 bg-white p-6 shadow-sm sm:p-9">
      <header className="flex items-start justify-between gap-4"><div><span className="inline-flex rounded-xl bg-emerald-50 p-2.5 text-emerald-600"><ShieldCheck size={24} /></span><h1 className="mt-4 text-2xl font-bold text-slate-900">Set up your managed location</h1><p className="mt-2 text-sm leading-6 text-slate-500">Choose how to identify your location, then upload evidence for super-admin review.</p></div><button type="button" onClick={logout} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600"><LogOut size={15} /> Sign out</button></header>
      {loading ? <p className="mt-10 flex items-center justify-center gap-2 text-sm text-slate-500"><LoaderCircle className="animate-spin" size={17} /> Loading application...</p> : <form className="mt-8" onSubmit={submit}>
        {isResubmission && <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">Your previous application was rejected. Update the location information and supporting document, then submit it for another review.</p>}
        <div className="grid gap-3 sm:grid-cols-2">{methods.map(({ value, label, hint, icon: Icon }) => <button key={value} type="button" onClick={() => { setMethod(value); setMessage(''); setSelected(null); setLocationName(''); setResults([]) }} className={`rounded-2xl border p-4 text-left transition ${method === value ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}><Icon size={19} /><strong className="mt-2 block text-sm">{label}</strong><small className="mt-1 block text-xs opacity-75">{hint}</small></button>)}</div>
        {method === 'existing' ? <label className="mt-6 block"><span className="text-sm font-semibold text-slate-700">Unassigned location</span><select className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-emerald-500" value={locationId} onChange={(e) => setLocationId(e.target.value)} required><option value="">Select a location</option>{locations.map((item) => <option key={item.id} value={item.id}>{item.name}{item.state ? ` — ${item.state}` : ''}</option>)}</select>{!locations.length && <small className="mt-2 block text-amber-600">No existing locations are currently unassigned. Search for a new place instead.</small>}</label> : <div className="mt-6"><label className="text-sm font-semibold text-slate-700">Place name or full address</label><div className="mt-2 flex gap-2"><input className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-emerald-500" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. Taman Negara or a complete address" /><button type="button" onClick={search} disabled={searching} className="rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-50">{searching ? 'Finding...' : 'Find'}</button></div><div className="mt-3 grid gap-2">{results.map((item) => <button type="button" key={item.id} onClick={() => { setSelected(item); setLocationName('') }} className={`rounded-xl border p-3 text-left text-sm ${selected?.id === item.id ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-600'}`}><MapPin className="mr-2 inline shrink-0" size={15} />{item.name}</button>)}</div>{selected && <label className="mt-5 block"><span className="text-sm font-semibold text-slate-700">Short location name</span><input className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-emerald-500" value={locationName} onChange={(e) => setLocationName(e.target.value)} maxLength={120} placeholder={`e.g. ${selected.name.split(',')[0]}`} required /><small className="mt-2 block text-xs text-slate-400">This short name will appear throughout EcoGuard. The complete address is retained separately.</small></label>}</div>}
        <label className="mt-6 block"><span className="text-sm font-semibold text-slate-700">Supporting company document</span><span className="mt-2 flex items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4"><FileCheck2 className="text-emerald-600" size={21} /><input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setDocument(e.target.files?.[0] || null)} required className="min-w-0 text-sm text-slate-600" /></span><small className="mt-2 block text-xs text-slate-400">PDF, JPG, or PNG, up to 5 MB.</small></label>
        {message && <p role="alert" className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-600">{message}</p>}
        <button type="submit" disabled={submitting} className="mt-6 w-full rounded-xl bg-emerald-600 px-5 py-3.5 text-sm font-bold text-white shadow-sm disabled:opacity-50">{submitting ? 'Submitting application...' : isResubmission ? 'Resubmit for approval' : 'Submit for approval'}</button>
      </form>}
    </section>
  </main>
}
