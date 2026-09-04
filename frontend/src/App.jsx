import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AuthPage from './features/auth/AuthPage'
import TouristWorkspace from './features/tourist/TouristWorkspace'
import AdminWorkspace from './features/super_admin/AdminWorkspace'
import LocationAdminWorkspace from './features/location_admin/LocationAdminWorkspace'
import PendingApprovalPage from './features/location_admin/PendingApprovalPage'
import LocationAdminApplicationPage from './features/location_admin/LocationAdminApplicationPage'
import LandingPage from './features/landing/LandingPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<AuthPage key="login" initialMode="login" />} />
        <Route path="/register" element={<AuthPage key="register" initialMode="register" />} />
        <Route path="/forgot-password" element={<AuthPage key="forgot" initialMode="forgot" />} />
        <Route path="/reset-password" element={<AuthPage key="reset" initialMode="reset" />} />
        <Route path="/tourist/:page" element={<TouristWorkspace />} />
        <Route path="/super_admin/:page" element={<AdminWorkspace requiredRole="super_admin" />} />
        <Route path="/location_admin/:page" element={<LocationAdminWorkspace />} />
        <Route path="/location_admin/pending" element={<PendingApprovalPage />} />
        <Route path="/location_admin/application" element={<LocationAdminApplicationPage />} />
        <Route path="/admin/dashboard" element={<Navigate to="/location_admin/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
