import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const currentFile = fileURLToPath(import.meta.url)
const currentDirectory = path.dirname(currentFile)

dotenv.config({
  path: path.resolve(currentDirectory, '../../../.env.local'),
})

export const env = {
  port: process.env.PORT || 5000,
  supabaseUrl: process.env.VITE_SUPABASE_URL,
  supabasePublishableKey:
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY,
}

if (!env.supabaseUrl || !env.supabasePublishableKey) {
  throw new Error('Supabase environment variables are missing.')
}
