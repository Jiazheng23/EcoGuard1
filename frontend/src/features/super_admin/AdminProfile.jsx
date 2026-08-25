import { useMemo, useState } from 'react'
import { AlertCircle, CalendarDays, CheckCircle2, Mail, Phone, Save, ShieldCheck, UserRound } from 'lucide-react'
import { supabase } from '../../services/supabaseClient'
import { updateOwnProfile } from '../../services/profileService'
import ProfileAvatarUploader from '../profile/ProfileAvatarUploader'

const card = 'rounded-2xl border border-slate-100 bg-white p-5 shadow-sm'

export default function AdminProfile({ user, profile, onProfileChange }) {
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [phone, setPhone] = useState(profile?.phone || '')
  const [gender, setGender] = useState(profile?.gender || user?.user_metadata?.gender || '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const initials = useMemo(() => (fullName || 'Admin').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join(''), [fullName])
  const joined = profile?.created_at ? new Intl.DateTimeFormat('en-MY', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(profile.created_at)) : 'Not available'
  const roleLabel = profile?.role === 'super_admin' ? 'Super Administrator' : 'Location Administrator'

  async function saveProfile(event) {
    event.preventDefault()
    setMessage('')
    setError('')

    if (!fullName.trim()) {
      setError('Full name is required.')
      return
    }

    setSaving(true)
    try {
      const updated = await updateOwnProfile(user.id, { fullName, phone, gender, avatarUrl: profile?.avatar_url })
      const { error: authError } = await supabase.auth.updateUser({ data: { ...user.user_metadata, full_name: updated.full_name, phone: updated.phone, gender: updated.gender } })
      if (authError) console.warn('Auth display metadata was not updated:', authError.message)
      onProfileChange(updated)
      setMessage('Administrator profile saved to Supabase.')
    } catch (saveError) {
      setError(saveError.message || 'Unable to update the administrator profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header><h1 className="text-2xl font-bold text-slate-900">Administrator Profile</h1><p className="mt-1 text-sm text-slate-500">Your profile is shared with the same Supabase profiles model used by tourists</p></header>
      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <aside className={`${card} h-full text-center`}>
          <ProfileAvatarUploader userId={user.id} profile={profile} initials={initials} accent="blue" onProfileChange={onProfileChange} onError={setError} onSuccess={setMessage} />
          <h2 className="mt-4 text-xl font-bold text-slate-800">{fullName || 'Administrator'}</h2>
          <p className="mt-1 break-all text-sm text-slate-500">{user?.email}</p>
          <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700"><ShieldCheck size={13} />{roleLabel}</span>
        </aside>

        <form onSubmit={saveProfile} className={`${card} space-y-5`}>
          <div><h2 className="font-bold text-slate-800">Personal Information</h2><p className="mt-1 text-xs text-slate-500">Changes update public.profiles and the navigation header.</p></div>
          <Field label="Full Name" icon={UserRound} value={fullName} onChange={setFullName} required />
          <Field label="Email Address" icon={Mail} value={user?.email || ''} readOnly />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone Number" icon={Phone} value={phone} onChange={setPhone} />
            <GenderField value={gender} onChange={setGender} accent="blue" />
          </div>
          <Info label="Member Since" value={joined} icon={CalendarDays} />
          {error && <Notice type="error" text={error} />}
          {message && <Notice type="success" text={message} />}
          <div className="flex justify-end border-t border-slate-100 pt-5"><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"><Save size={16} />{saving ? 'Saving...' : 'Save Changes'}</button></div>
        </form>
      </div>
    </div>
  )
}

function GenderField({ value, onChange, accent }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-500">Gender</span><span className="relative block"><UserRound className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><select value={value} onChange={(event) => onChange(event.target.value)} className={`w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-8 text-sm text-slate-700 outline-none ${accent === 'blue' ? 'focus:border-blue-500' : 'focus:border-green-500'}`}><option value="">Prefer not to specify</option><option value="female">Female</option><option value="male">Male</option><option value="non_binary">Non-binary</option><option value="prefer_not_to_say">Prefer not to say</option></select><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">⌄</span></span></label>
}

function Field({ label, icon: Icon, value, onChange, readOnly, required }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-500">{label}</span><span className="relative block"><Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input value={value} onChange={onChange ? (event) => onChange(event.target.value) : undefined} readOnly={readOnly} required={required} className={`w-full rounded-xl border py-2.5 pl-10 pr-3 text-sm outline-none ${readOnly ? 'cursor-not-allowed border-slate-100 bg-slate-100 text-slate-500' : 'border-slate-200 bg-slate-50 text-slate-700 focus:border-blue-500'}`} /></span></label>
}

function Info({ label, value, icon: Icon }) {
  return <div className="rounded-xl border border-slate-100 bg-slate-50 p-3"><p className="flex items-center gap-1.5 text-xs text-slate-400"><Icon size={13} />{label}</p><p className="mt-1 text-sm font-semibold text-slate-700">{value}</p></div>
}

function Notice({ type, text }) {
  const Icon = type === 'success' ? CheckCircle2 : AlertCircle
  return <div className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${type === 'success' ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-600'}`}><Icon className="mt-0.5 shrink-0" size={17} /><p>{text}</p></div>
}
