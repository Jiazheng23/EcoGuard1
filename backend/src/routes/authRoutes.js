import { Router } from 'express'
import { decideAdminApplication, listAdminApplications, register } from '../controllers/authController.js'

const router = Router()

router.post('/register', register)
router.get('/admin-applications', listAdminApplications)
router.post('/admin-applications/:id/decision', decideAdminApplication)

export default router
