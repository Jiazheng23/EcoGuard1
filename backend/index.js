import express from 'express'
import cors from 'cors'
import { env } from './src/config/env.js'
import authRoutes from './src/routes/authRoutes.js'

const app = express()

app.use(cors({
  origin: 'http://localhost:5173',
}))

app.use(express.json())

app.get('/api/health', (req, res) => {
  res.json({
    status: 'success',
    message: 'EcoGuard backend is running.',
  })
})

app.use('/api', authRoutes)

app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found.',
  })
})

app.listen(env.port, () => {
  console.log(`Backend running on http://localhost:${env.port}`)
})