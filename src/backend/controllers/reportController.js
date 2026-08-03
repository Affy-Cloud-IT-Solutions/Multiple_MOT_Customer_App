const Customer = require('../models/Customer');
const Vehicle = require('../models/Vehicle');
const Reminder = require('../models/Reminder');
const Alert = require('../models/Alert');
const Audit = require('../models/Audit');
const { getDaysDiff, formatCSV } = require('../utils/helpers');

// Helper to check if MOT is due soon
async function getMOTDueReportData() {
  const vehicles = await Vehicle.find({ status: 'Active' });
  const customers = await Customer.find({});

  return vehicles.map(v => {
    const customer = customers.find(c => c._id.toString() === v.customerId.toString());
    const daysLeft = getDaysDiff(v.motExpiryDate, '2026-07-22');
    return {
      registrationNumber: v.registrationNumber,
      make: v.make,
      model: v.model,
      motExpiryDate: v.motExpiryDate.toISOString().substring(0, 10),
      daysRemaining: daysLeft,
      customerName: customer ? `${customer.firstName} ${customer.lastName}` : 'Unknown',
      customerContact: customer ? customer.mobile : 'N/A'
    };
  });
}

async function getReminderSentReportData() {
  const reminders = await Reminder.find({});
  const vehicles = await Vehicle.find({});
  const customers = await Customer.find({});

  return reminders.map(rem => {
    const vehicle = vehicles.find(v => v._id.toString() === rem.vehicleId.toString());
    const customer = vehicle ? customers.find(c => c._id.toString() === vehicle.customerId.toString()) : null;
    return {
      reminderId: rem._id.toString(),
      registrationNumber: vehicle ? vehicle.registrationNumber : 'N/A',
      makeModel: vehicle ? `${vehicle.make} ${vehicle.model}` : 'N/A',
      recipientName: customer ? `${customer.firstName} ${customer.lastName}` : 'Unknown',
      contactMethod: customer ? customer.preferredContact : 'N/A',
      reminderType: rem.reminderType,
      sentTimestamp: rem.sentTimestamp ? rem.sentTimestamp.toISOString().replace('T', ' ').substring(0, 16) : 'N/A',
      sentStatus: rem.sentStatus ? 'Sent' : 'Failed'
    };
  });
}

async function getCustomerResponseReportData() {
  // Returns audit records related to customer responses (booked, sold, new vehicle requests)
  const audits = await Audit.find({
    $or: [
      { activity: { $regex: 'Requested', $options: 'i' } },
      { activity: { $regex: 'Changed', $options: 'i' } },
      { activity: { $regex: 'Booked', $options: 'i' } }
    ]
  }).sort({ date: -1 });

  return audits.map(au => ({
    auditId: au._id.toString(),
    timestamp: au.date.toISOString().replace('T', ' ').substring(0, 16),
    activity: au.activity,
    details: au.details
  }));
}

async function getBookedMOTReportData() {
  // Get all alerts of type 'BOOKED'
  const bookingAlerts = await Alert.find({ type: 'BOOKED' });
  return bookingAlerts.map(b => ({
    alertId: b._id.toString(),
    customerName: b.customerName,
    registrationNumber: b.registrationNumber,
    makeModel: b.makeModel,
    requestDate: b.date.toISOString().replace('T', ' ').substring(0, 16),
    status: b.status
  }));
}

// Route handlers
async function getMOTDueReport(req, res) {
  try {
    const data = await getMOTDueReportData();
    const { format } = req.query;

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=mot_due_report.csv');
      return res.send(formatCSV(data, ['registrationNumber', 'make', 'model', 'motExpiryDate', 'daysRemaining', 'customerName', 'customerContact']));
    }
    
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getReminderSentReport(req, res) {
  try {
    const data = await getReminderSentReportData();
    const { format } = req.query;

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=reminders_sent_report.csv');
      return res.send(formatCSV(data, ['reminderId', 'registrationNumber', 'makeModel', 'recipientName', 'contactMethod', 'reminderType', 'sentTimestamp', 'sentStatus']));
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getCustomerResponseReport(req, res) {
  try {
    const data = await getCustomerResponseReportData();
    const { format } = req.query;

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=customer_response_report.csv');
      return res.send(formatCSV(data, ['auditId', 'timestamp', 'activity', 'details']));
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getBookedMOTReport(req, res) {
  try {
    const data = await getBookedMOTReportData();
    const { format } = req.query;

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=booked_mots_report.csv');
      return res.send(formatCSV(data, ['alertId', 'customerName', 'registrationNumber', 'makeModel', 'requestDate', 'status']));
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  getMOTDueReport,
  getReminderSentReport,
  getCustomerResponseReport,
  getBookedMOTReport
};
