import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AuthPage from './features/auth/AuthPage'
import TouristWorkspace from './features/tourist/TouristWorkspace'
import AdminWorkspace from './features/admin/AdminWorkspace'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<AuthPage initialMode="login" />} />
        <Route path="/register" element={<AuthPage initialMode="register" />} />
        <Route path="/forgot-password" element={<AuthPage initialMode="forgot" />} />
        <Route path="/tourist/dashboard" element={<TouristWorkspace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />

        // Admin routes
        <Route path="/admin/dashboard" element={<AdminWorkspace />} />
      </Routes>
    </BrowserRouter>
  )
}
