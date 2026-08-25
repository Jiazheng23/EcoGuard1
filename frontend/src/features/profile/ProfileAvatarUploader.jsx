import { useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { uploadProfileAvatar } from '../../services/avatarService'

export default function ProfileAvatarUploader({ userId, profile, initials, accent = 'green', onProfileChange, onError, onSuccess }) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const colors = accent === 'blue'
    ? 'from-blue-500 to-indigo-600 shadow-blue-500/20'
    : 'from-green-400 to-green-700 shadow-green-500/20'

  async function selectImage(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    onError?.('')
    onSuccess?.('')
    setUploading(true)
    try {
      const updated = await uploadProfileAvatar(userId, file)
      onProfileChange?.(updated)
      onSuccess?.('Profile picture updated successfully.')
    } catch (error) {
      onError?.(error.message || 'Unable to upload the profile picture.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex w-full flex-col items-center">
      <div className="relative">
      <div className={`grid size-28 overflow-hidden place-items-center rounded-full border-4 border-white bg-gradient-to-br text-3xl font-bold text-white shadow-lg ring-1 ring-slate-100 ${colors}`}>
        {profile?.avatar_url
          ? <img src={profile.avatar_url} alt="Profile" className="size-full object-cover" />
          : initials}
      </div>
      <button type="button" disabled={uploading} onClick={() => inputRef.current?.click()} aria-label="Upload or change profile picture" className={`absolute bottom-0 right-0 grid size-8 place-items-center rounded-full border-2 border-white text-white shadow-md transition disabled:opacity-60 ${accent === 'blue' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-green-500 hover:bg-green-600'}`}>
        <Camera size={14} />
      </button>
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={selectImage} className="hidden" />
      <p className="mt-3 text-xs text-slate-400">{uploading ? 'Uploading...' : 'JPG, PNG or WebP · Max 2 MB'}</p>
    </div>
  )
}
