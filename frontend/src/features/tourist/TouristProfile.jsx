import { useMemo, useState } from 'react'
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Mail,
  Phone,
  Save,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { supabase } from '../../services/supabaseClient'
import { updateOwnProfile } from '../../services/profileService'

const card = 'rounded-2xl border border-slate-100 bg-white p-5 shadow-sm'

export default function TouristProfile({ user, profile, onProfileChange }) {
  const [fullName, setFullName] = useState(
    profile?.full_name || user?.user_metadata?.full_name || '',
  )
  const [phone, setPhone] = useState(
    profile?.phone || user?.user_metadata?.phone || '',
  )
  const [isSaving, setIsSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const role = profile?.role || 'tourist'

  const initials = useMemo(() => {
    const name =
      fullName.trim() ||
      user?.email?.split('@')[0] ||
      'Tourist'

    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0].toUpperCase())
      .join('')
  }, [fullName, user?.email])

  const createdDate = profile?.created_at || user?.created_at
    ? new Intl.DateTimeFormat('en-MY', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(profile?.created_at || user.created_at))
    : 'Not available'

  async function handleSubmit(event) {
    event.preventDefault()

    setSuccessMessage('')
    setErrorMessage('')

    const cleanName = fullName.trim()
    const cleanPhone = phone.trim()

    if (!cleanName) {
      setErrorMessage('Full name is required.')
      return
    }

    if (cleanPhone && !/^[0-9+()\-\s]{7,20}$/.test(cleanPhone)) {
      setErrorMessage('Enter a valid phone number.')
      return
    }

    setIsSaving(true)

    try {
      const updatedProfile = await updateOwnProfile(user.id, {
        fullName: cleanName,
        phone: cleanPhone,
        avatarUrl: profile?.avatar_url,
      })

      const { error: authError } = await supabase.auth.updateUser({
        data: {
          ...user.user_metadata,
          full_name: cleanName,
          phone: cleanPhone,
        },
      })

      if (authError) {
        console.warn('Auth display metadata was not updated:', authError.message)
      }

      setFullName(cleanName)
      setPhone(cleanPhone)
      onProfileChange?.(updatedProfile)
      setSuccessMessage('Profile updated successfully.')
    } catch (error) {
      setErrorMessage(
        error.message || 'Unable to update your profile.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  if (!user) {
    return (
      <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600">
        You must be logged in to view your profile.
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">
          Tourist Profile
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          View and update your EcoGuard account information
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <aside className={`${card} h-fit text-center`}>
          <div className="mx-auto grid size-24 place-items-center rounded-full bg-gradient-to-br from-green-400 to-green-700 text-3xl font-bold text-white shadow-lg shadow-green-500/20">
            {initials}
          </div>

          <h2 className="mt-4 text-xl font-bold text-slate-800">
            {fullName || 'Tourist'}
          </h2>

          <p className="mt-1 break-all text-sm text-slate-500">
            {user.email}
          </p>

          <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold capitalize text-green-700">
            <ShieldCheck size={13} />
            {role}
          </span>

          <div className="mt-5 border-t border-slate-100 pt-4 text-left">
            <p className="text-xs font-medium text-slate-400">
              Account ID
            </p>
            <p className="mt-1 truncate text-xs text-slate-600" title={user.id}>
              {user.id}
            </p>
          </div>
        </aside>

        <form onSubmit={handleSubmit} className={`${card} space-y-5`}>
          <div>
            <h2 className="font-bold text-slate-800">
              Personal Information
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Your updated name will also appear on the dashboard and sidebar.
            </p>
          </div>

          <ProfileField
            label="Full Name"
            icon={UserRound}
            value={fullName}
            onChange={setFullName}
            placeholder="Enter your full name"
            required
          />

          <ProfileField
            label="Email Address"
            icon={Mail}
            value={user.email || ''}
            readOnly
          />

          <ProfileField
            label="Phone Number"
            icon={Phone}
            value={phone}
            onChange={setPhone}
            placeholder="Example: +60 12-345 6789"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <InformationBox
              label="Account Role"
              value={role === 'admin' ? 'Location Admin' : 'Tourist'}
              icon={ShieldCheck}
            />

            <InformationBox
              label="Member Since"
              value={createdDate}
              icon={CalendarDays}
            />
          </div>

          {errorMessage && (
            <div
              className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600"
              role="alert"
            >
              <AlertCircle className="mt-0.5 shrink-0" size={17} />
              <p>{errorMessage}</p>
            </div>
          )}

          {successMessage && (
            <div
              className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700"
              role="status"
            >
              <CheckCircle2 className="mt-0.5 shrink-0" size={17} />
              <p>{successMessage}</p>
            </div>
          )}

          <div className="flex justify-end border-t border-slate-100 pt-5">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-green-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save size={16} />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ProfileField({
  label,
  icon: Icon,
  value,
  onChange,
  placeholder,
  readOnly = false,
  required = false,
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-500">
        {label}
      </span>

      <span className="relative block">
        <Icon
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          size={16}
        />

        <input
          value={value}
          onChange={
            onChange
              ? (event) => onChange(event.target.value)
              : undefined
          }
          placeholder={placeholder}
          readOnly={readOnly}
          required={required}
          className={`w-full rounded-xl border py-2.5 pl-10 pr-3 text-sm outline-none ${
            readOnly
              ? 'cursor-not-allowed border-slate-100 bg-slate-100 text-slate-500'
              : 'border-slate-200 bg-slate-50 text-slate-700 focus:border-green-500'
          }`}
        />
      </span>
    </label>
  )
}

function InformationBox({ label, value, icon: Icon }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
        <Icon size={13} />
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold capitalize text-slate-700">
        {value}
      </p>
    </div>
  )
}
