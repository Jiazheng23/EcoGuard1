import { supabase } from './supabaseClient'

const BUCKET = 'location-images'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_GALLERY_IMAGES = 12
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

function validateImage(file) {
  if (!file || !ALLOWED_TYPES.has(file.type)) {
    throw new Error('Location images must be JPG, PNG, or WebP files.')
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('Each location image must be 5 MB or smaller.')
  }
}

function safeName(file) {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  return `${Date.now()}-${crypto.randomUUID()}.${extension}`
}

async function uploadImage(locationId, folder, file) {
  validateImage(file)
  const path = `${locationId}/${folder}/${safeName(file)}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '31536000',
    contentType: file.type,
    upsert: false,
  })
  if (error) throw error

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function uploadLocationImages(locationId, galleryFiles = []) {
  if (!locationId) throw new Error('Save the location before uploading images.')
  if (galleryFiles.length > MAX_GALLERY_IMAGES) {
    throw new Error(`Choose no more than ${MAX_GALLERY_IMAGES} gallery images at a time.`)
  }

  const galleryUrls = await Promise.all(
    galleryFiles.map((file) => uploadImage(locationId, 'gallery', file)),
  )

  return galleryUrls
}

export async function deleteLocationImages(urls = []) {
  const marker = `/storage/v1/object/public/${BUCKET}/`
  const paths = urls.map((url) => {
    const path = String(url).split(marker)[1]?.split('?')[0]
    return path ? decodeURIComponent(path) : null
  }).filter(Boolean)
  if (!paths.length) return

  const { error } = await supabase.storage.from(BUCKET).remove(paths)
  if (error) throw error
}

export { MAX_GALLERY_IMAGES }
