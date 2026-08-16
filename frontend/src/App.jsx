import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AuthPage from './features/auth/AuthPage'
import TouristWorkspace from './features/tourist/TouristWorkspace'
import AdminWorkspace from './features/admin/AdminWorkspace'
import LandingPage from './features/landing/LandingPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<AuthPage initialMode="login" />} />
        <Route path="/register" element={<AuthPage initialMode="register" />} />
        <Route path="/forgot-password" element={<AuthPage initialMode="forgot" />} />
        <Route path="/tourist/dashboard" element={<TouristWorkspace />} />
        <Route path="/admin/dashboard" element={<AdminWorkspace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
