import { Router } from 'express'
import { startGoogleApplication, decideAdminApplication, getAdminApplicationDocumentUrl, listAdminApplications, listUnassignedLocations, register, submitAdminApplication } from '../controllers/authController.js'

const router = Router()

router.post('/register', register)
router.post('/auth/google-application', startGoogleApplication)
router.get('/location-admin/unassigned-locations', listUnassignedLocations)
router.post('/location-admin/application', submitAdminApplication)
router.get('/admin-applications', listAdminApplications)
router.get('/admin-applications/:id/document-url', getAdminApplicationDocumentUrl)
router.post('/admin-applications/:id/decision', decideAdminApplication)

export default router
