import { Router } from 'express'
import { decideAdminApplication, listAdminApplications, listUnassignedLocations, register, submitAdminApplication } from '../controllers/authController.js'

const router = Router()

router.post('/register', register)
router.get('/location-admin/unassigned-locations', listUnassignedLocations)
router.post('/location-admin/application', submitAdminApplication)
router.get('/admin-applications', listAdminApplications)
router.post('/admin-applications/:id/decision', decideAdminApplication)

export default router
