import { useEffect, useState } from 'react'
import { Check, ExternalLink, FileText, X } from 'lucide-react'
import { decideAdminApplication, listAdminApplications } from '../../services/adminApplicationService'

export default function AdminApplications() {
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  async function refresh() {
    setLoading(true)
    try { setApplications(await listAdminApplications()) }
    catch (error) { setMessage(error.message) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    let active = true
    listAdminApplications()
      .then((rows) => { if (active) setApplications(rows) })
      .catch((error) => { if (active) setMessage(error.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  async function decide(id, decision) {
    setMessage('')
    try {
      await decideAdminApplication(id, decision)
      setMessage(`Application ${decision}.`)
      await refresh()
    } catch (error) { setMessage(error.message) }
  }

  return <div className="mx-auto max-w-6xl"><header><h1 className="text-2xl font-bold text-slate-900">Location admin applications</h1><p className="mt-1 text-sm text-slate-500">Review company documents before granting access to one location.</p></header>{message && <p className="mt-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-700">{message}</p>}<section className="mt-6 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-400"><tr><th className="px-5 py-3">Applicant</th><th className="px-5 py-3">Location</th><th className="px-5 py-3">Document</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Decision</th></tr></thead><tbody className="divide-y divide-slate-100">{applications.map((item) => <tr key={item.id}><td className="px-5 py-4 font-semibold text-slate-800">{item.profiles?.full_name || item.user_id}</td><td className="px-5 py-4 text-slate-600">{item.ecological_locations?.name || item.requested_location_id}</td><td className="px-5 py-4">{item.documentUrl ? <a href={item.documentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600"><FileText size={15} />{item.company_document_name}<ExternalLink size={13} /></a> : item.company_document_name}</td><td className="px-5 py-4 capitalize text-slate-600">{item.status}</td><td className="px-5 py-4"><div className="flex justify-end gap-2">{item.status === 'pending' && <><button onClick={() => decide(item.id, 'approved')} className="rounded-lg bg-green-50 p-2 text-green-700" aria-label="Approve"><Check size={17} /></button><button onClick={() => decide(item.id, 'rejected')} className="rounded-lg bg-red-50 p-2 text-red-600" aria-label="Reject"><X size={17} /></button></>}</div></td></tr>)}</tbody></table></div>{!loading && !applications.length && <p className="p-10 text-center text-sm text-slate-400">No applications found.</p>}{loading && <p className="p-10 text-center text-sm text-slate-400">Loading applications...</p>}</section></div>
}
