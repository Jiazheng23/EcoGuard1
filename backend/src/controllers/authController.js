import { supabase } from '../services/supabase.js'

export async function register(req, res) {
  const name = req.body?.name?.trim()
  const email = req.body?.email?.trim().toLowerCase()
  const password = req.body?.password

  if (!name || !email || !password) {
    return res.status(400).json({
      error: 'Name, email, and password are required.',
    })
  }

  if (password.length < 6) {
    return res.status(400).json({
      error: 'Password must contain at least 6 characters.',
    })
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        },
      },
    })

    if (error) {
      return res.status(400).json({
        error: error.message,
      })
    }

    return res.status(201).json({
      success: true,
      userId: data.user?.id,
      requiresEmailConfirmation: !data.session,
      message: data.session
        ? 'Account created successfully.'
        : 'Account created. Please confirm your email before signing in.',
    })
  } catch (error) {
    console.error('Registration error:', error)

    return res.status(500).json({
      error: 'An unexpected registration error occurred.',
    })
  }
}