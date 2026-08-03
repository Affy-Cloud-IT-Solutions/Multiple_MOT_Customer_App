const Customer = require('../models/Customer');
const Vehicle = require('../models/Vehicle');
const Alert = require('../models/Alert');
const Audit = require('../models/Audit');
const { getDaysDiff } = require('../utils/helpers');

async function getDashboardStats(req, res) {
  try {
    const activeVehicles = await Vehicle.find({ status: 'Active' });
    
    let due7 = 0;
    let due30 = 0;
    let due45 = 0;

    activeVehicles.forEach(v => {
      const diff = getDaysDiff(v.motExpiryDate, '2026-07-22');
      if (diff >= 0 && diff <= 7) {
        due7++;
      } else if (diff > 7 && diff <= 30) {
        due30++;
      } else if (diff > 30 && diff <= 45) {
        due45++;
      }
    });

    const totalCustomers = await Customer.countDocuments({});
    const soldCount = await Vehicle.countDocuments({ status: 'Sold' });
    const bookedCount = await Alert.countDocuments({ type: 'BOOKED' });
    const totalAudits = await Audit.countDocuments({});

    res.json({
      totalCustomers,
      activeVehicles: activeVehicles.length,
      dueIn7Days: due7,
      dueIn30Days: due30,
      dueIn45Days: due45,
      vehiclesSold: soldCount,
      bookedMots: bookedCount,
      totalAudits
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  getDashboardStats
};
