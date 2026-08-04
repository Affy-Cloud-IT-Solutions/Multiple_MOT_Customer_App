const Alert = require('../models/Alert');
const Vehicle = require('../models/Vehicle');
const Audit = require('../models/Audit');

const formatDoc = (doc) => {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : doc;
  return { ...obj, id: obj._id.toString() };
};

async function getAllAlerts(req, res) {
  try {
    const alerts = await Alert.find({}).sort({ createdAt: -1 });
    res.json(alerts.map(formatDoc));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function createAlert(req, res) {
  try {
    const { type, customerName, customerId, registrationNumber, makeModel } = req.body;

    if (type === 'BOOKED') {
      const existingAlert = await Alert.findOne({
        type: 'BOOKED',
        registrationNumber: registrationNumber.toUpperCase().trim(),
        status: { $in: ['Pending', 'Approved'] }
      });
      if (existingAlert) {
        existingAlert.makeModel = makeModel;
        existingAlert.status = 'Pending';
        existingAlert.date = Date.now();
        await existingAlert.save();

        await Audit.create({
          activity: 'MOT Booking Rescheduled',
          details: `${customerName} rescheduled MOT booking slot for ${makeModel} (${registrationNumber}) via portal.`
        });

        return res.status(200).json({ message: 'Alert rescheduled successfully.', alert: formatDoc(existingAlert) });
      }
    }

    const newAlert = await Alert.create({
      type,
      customerName,
      customerId,
      registrationNumber,
      makeModel,
      status: 'Pending'
    });

    let auditActivity = 'Notification Received';
    let auditDetails = `Received alert of type ${type} for customer ${customerName}`;
    
    if (type === 'BOOKED') {
      auditActivity = 'MOT Booking Requested';
      auditDetails = `${customerName} requested MOT booking for ${makeModel} (${registrationNumber}) via portal.`;
    } else if (type === 'SOLD') {
      auditActivity = 'Vehicle Marked Sold';
      auditDetails = `${customerName} reported vehicle sold: ${makeModel} (${registrationNumber})`;
    } else if (type === 'NEW_VEHICLE') {
      auditActivity = 'New Vehicle Requested';
      auditDetails = `${customerName} requested vehicle registration approval for ${makeModel} (${registrationNumber})`;
    }

    await Audit.create({
      activity: auditActivity,
      details: auditDetails
    });

    res.status(201).json({ message: 'Alert created successfully.', alert: formatDoc(newAlert) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function approveAlert(req, res) {
  try {
    const alert = await Alert.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found.' });
    }

    alert.status = 'Approved';
    await alert.save();

    // Act on approval
    if (alert.type === 'NEW_VEHICLE') {
      const parts = alert.makeModel.split(' ');
      const make = parts[0] || 'UNKNOWN';
      const model = parts.slice(1).join(' ') || 'VEHICLE';

      // Check if vehicle already exists in database
      const existingVehicle = await Vehicle.findOne({ registrationNumber: alert.registrationNumber });
      
      if (existingVehicle) {
        // Transfer ownership and activate
        existingVehicle.customerId = alert.customerId;
        existingVehicle.make = make.toUpperCase();
        existingVehicle.model = model.toUpperCase();
        existingVehicle.status = 'Active';
        await existingVehicle.save();

        await Audit.create({
          activity: 'Vehicle Transferred',
          details: `Approved vehicle registration for existing plate ${alert.registrationNumber}. Ownership updated/transferred to customer ID ${alert.customerId}.`
        });
      } else {
        // Create new vehicle in database
        const newVehicle = await Vehicle.create({
          customerId: alert.customerId,
          registrationNumber: alert.registrationNumber,
          make: make.toUpperCase(),
          model: model.toUpperCase(),
          year: 2018,
          motExpiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Default 1 year expiry
          status: 'Active'
        });

        await Audit.create({
          activity: 'Vehicle Added',
          details: `Approved & registered new vehicle ${newVehicle.make} ${newVehicle.model} (${newVehicle.registrationNumber})`
        });
      }
    } else if (alert.type === 'SOLD') {
      // Find vehicle by registration and mark as Sold
      const vehicle = await Vehicle.findOne({ registrationNumber: alert.registrationNumber });
      if (vehicle) {
        vehicle.status = 'Sold';
        await vehicle.save();
        await Audit.create({
          activity: 'Vehicle Status Changed',
          details: `Approved vehicle sold alert: ${vehicle.make} ${vehicle.model} (${vehicle.registrationNumber}) status changed to Sold`
        });
      }
    } else if (alert.type === 'BOOKED') {
      await Audit.create({
        activity: 'MOT Booked',
        details: `Confirmed MOT booking approval for ${alert.makeModel} (${alert.registrationNumber})`
      });
    }

    res.json({ message: 'Alert approved successfully.', alert: formatDoc(alert) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function acknowledgeAlert(req, res) {
  try {
    const alert = await Alert.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found.' });
    }

    alert.status = 'Acknowledged';
    await alert.save();

    res.json({ message: 'Alert acknowledged successfully.', alert: formatDoc(alert) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  getAllAlerts,
  createAlert,
  approveAlert,
  acknowledgeAlert
};
