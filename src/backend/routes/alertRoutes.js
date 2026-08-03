const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');

router.get('/', alertController.getAllAlerts);
router.post('/', alertController.createAlert);
router.put('/:id/approve', alertController.approveAlert);
router.put('/:id/acknowledge', alertController.acknowledgeAlert);

module.exports = router;
