import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AuthPage from './features/auth/AuthPage'
import TouristWorkspace from './features/tourist/TouristWorkspace'
import AdminWorkspace from './features/super_admin/AdminWorkspace'
import LocationAdminWorkspace from './features/location_admin/LocationAdminWorkspace'
import PendingApprovalPage from './features/location_admin/PendingApprovalPage'
import LandingPage from './features/landing/LandingPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<AuthPage initialMode="login" />} />
        <Route path="/register" element={<AuthPage initialMode="register" />} />
        <Route path="/forgot-password" element={<AuthPage initialMode="forgot" />} />
        <Route path="/reset-password" element={<AuthPage initialMode="reset" />} />
        <Route path="/tourist/dashboard" element={<TouristWorkspace />} />
        <Route path="/super_admin/dashboard" element={<AdminWorkspace />} />
        <Route path="/location_admin/dashboard" element={<LocationAdminWorkspace />} />
        <Route path="/location_admin/pending" element={<PendingApprovalPage />} />
        <Route path="/admin/dashboard" element={<Navigate to="/location_admin/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
