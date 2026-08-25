import { supabase } from './supabaseClient'

const BUCKET = 'profile-avatars'
const MAX_AVATAR_BYTES = 2 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export async function uploadProfileAvatar(userId, file) {
  if (!userId) throw new Error('You must be signed in to upload a profile picture.')
  if (!file || !ALLOWED_TYPES.has(file.type)) {
    throw new Error('Choose a JPG, PNG, or WebP image.')
  }
  if (file.size > MAX_AVATAR_BYTES) {
    throw new Error('Profile pictures must be 2 MB or smaller.')
  }

  const path = `${userId}/avatar`
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: true,
    })
  if (uploadError) throw uploadError

  const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(path)
  const avatarUrl = `${publicUrl.publicUrl}?v=${Date.now()}`
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', userId)
    .select('*')
    .single()
  if (profileError) throw profileError

  return profile
}
