import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWebData } from '../context/WebDataContext';
import { useToast } from '../components/Toast';
import { Search, UserPlus, Eye, Calendar, Plus, Loader } from 'lucide-react';

export default function AdminCustomers() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { customers, vehicles, addCustomer, addVehicle, lookupVehicle, fetchMakes, fetchModels } = useWebData();

  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(false);

  // Add Customer Form states
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');

  // Add Vehicle toggles
  const [addVehicleNow, setAddVehicleNow] = useState(true);
  const [newCustRegNo, setNewCustRegNo] = useState('');
  const [newCustMake, setNewCustMake] = useState('');
  const [newCustModel, setNewCustModel] = useState('');
  const [newCustYear, setNewCustYear] = useState('');
  const [newCustExpiry, setNewCustExpiry] = useState('');
  const [newCustServiceDate, setNewCustServiceDate] = useState('');
  const [isSearchingPlate, setIsSearchingPlate] = useState(false);

  // Autocomplete lists
  const [makesList, setMakesList] = useState<string[]>([]);
  const [modelsList, setModelsList] = useState<string[]>([]);

  // Fetch makes when form opens and vehicle option is checked
  React.useEffect(() => {
    if (showAddForm && addVehicleNow) {
      fetchMakes().then(setMakesList);
    }
  }, [showAddForm, addVehicleNow]);

  // Fetch models when make input changes
  React.useEffect(() => {
    if (newCustMake) {
      fetchModels(newCustMake).then(setModelsList);
    } else {
      setModelsList([]);
    }
  }, [newCustMake]);

  const handleLookupPlate = async () => {
    const vrnClean = newCustRegNo.trim().toUpperCase();
    if (!vrnClean) {
      showToast('Please enter a registration plate number first.', 'warning');
      return;
    }
    
    setIsSearchingPlate(true);
    try {
      const res = await lookupVehicle(vrnClean);
      if (res && res.found && res.vehicle) {
        const v = res.vehicle;
        setNewCustMake(v.make || '');
        setNewCustModel(v.model || '');
        setNewCustYear(v.year ? String(v.year) : '');
        setNewCustExpiry(v.motExpiryDate || '');
        showToast(`Vehicle details autofilled for ${v.make} ${v.model}.`);
      } else {
        showToast('Vehicle details not found in registry.', 'warning');
      }
    } catch (err: any) {
      console.error(err);
      showToast('Plate lookup failed.', 'error');
    } finally {
      setIsSearchingPlate(false);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !email.trim() || !mobile.trim()) {
      showToast('First Name, Email, and Mobile are required.', 'warning');
      return;
    }

    if (addVehicleNow) {
      if (!newCustRegNo.trim() || !newCustMake.trim() || !newCustModel.trim() || !newCustYear.trim() || !newCustExpiry.trim()) {
        showToast('Please fill in all vehicle details or toggle off "Include Vehicle Details".', 'warning');
        return;
      }
      if (!/^\d{4}$/.test(newCustYear.trim())) {
        showToast('Please enter a valid 4-digit year of manufacture.', 'warning');
        return;
      }
    }

    setLoading(true);
    try {
      // 1. Create Customer
      const customerId = await addCustomer({
        firstName: firstName.trim(),
        lastName: lastName.trim() || '',
        email: email.trim().toLowerCase(),
        mobile: mobile.trim(),
        address: address.trim() || undefined,
        preferredContact: 'Email'
      });

      // 2. Create Vehicle
      if (addVehicleNow && customerId) {
        await addVehicle({
          customerId,
          registrationNumber: newCustRegNo.trim().toUpperCase(),
          make: newCustMake.trim().toUpperCase(),
          model: newCustModel.trim().toUpperCase(),
          year: newCustYear.trim(),
          motExpiryDate: newCustExpiry.trim(),
          lastServiceDate: newCustServiceDate.trim() || undefined,
          status: 'Active'
        });
      }

      setLoading(false);
      showToast('Customer created successfully!');
      
      // Reset form
      setFirstName('');
      setLastName('');
      setEmail('');
      setMobile('');
      setAddress('');
      setNewCustRegNo('');
      setNewCustMake('');
      setNewCustModel('');
      setNewCustYear('');
      setNewCustExpiry('');
      setNewCustServiceDate('');
      setShowAddForm(false);
    } catch (err: any) {
      setLoading(false);
      console.error(err);
      showToast(err.message || 'Failed to create customer.', 'error');
    }
  };

  // Customer Filtering logic
  const filteredCustomers = customers.filter((cust) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;

    const nameMatch = `${cust.firstName} ${cust.lastName}`.toLowerCase().includes(q);
    const emailMatch = cust.email.toLowerCase().includes(q);
    const mobileMatch = cust.mobile.includes(q);
    
    // Check if customer has any vehicle matching VRN
    const custVehicles = vehicles.filter((v) => 
      v.customerId && (
        String(v.customerId).toLowerCase() === String(cust.id || '').toLowerCase() ||
        String(v.customerId).toLowerCase() === String(cust._id || '').toLowerCase()
      )
    );
    const vrnMatch = custVehicles.some(v => v.registrationNumber.toLowerCase().includes(q));

    return nameMatch || emailMatch || mobileMatch || vrnMatch;
  });

  return (
    <div className="animate-fade-in" style={{ padding: '0.5rem 0' }}>
      {/* Header controls */}
      <div style={styles.dashboardHeader}>
        <div>
          <h2 style={{ fontWeight: '800', fontSize: '1.6rem', margin: 0 }}>Customer Directory</h2>
          <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Manage registered customer profiles and associated vehicles.
          </p>
        </div>

        {!showAddForm && (
          <button onClick={() => setShowAddForm(true)} className="btn btn-primary">
            <UserPlus size={18} />
            <span>Add Customer</span>
          </button>
        )}
      </div>

      {/* Add customer form card */}
      {showAddForm && (
        <div className="card animate-fade-in" style={{ marginBottom: '2rem', border: '1.5px dashed var(--primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0, fontWeight: '700' }}>Register Customer Account</h3>
            <button onClick={() => setShowAddForm(false)} className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', marginLeft: 'auto' }}>Cancel</button>
          </div>

          <form onSubmit={handleCreateCustomer}>
            {/* Customer Details Row */}
            <div style={styles.formGrid}>
              <div className="form-group">
                <label className="form-label">First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="E.g. John"
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="E.g. Doe"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="E.g. john@example.com"
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Mobile Number</label>
                <input
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="E.g. 07123456789"
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Postal Address (Optional)</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="E.g. 12 High Street, Birmingham"
                  className="form-input"
                />
              </div>
            </div>

            {/* Vehicle inclusion toggle */}
            <div style={styles.toggleRow}>
              <input
                type="checkbox"
                id="add-vehicle-checkbox"
                checked={addVehicleNow}
                onChange={(e) => setAddVehicleNow(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <label htmlFor="add-vehicle-checkbox" style={{ fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem' }}>
                Include First Vehicle Details
              </label>
            </div>

            {/* Vehicle Details Fields */}
            {addVehicleNow && (
              <div style={{ ...styles.formGrid, marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }} className="animate-fade-in">
                <div className="form-group">
                  <label className="form-label">Registration VRN</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      value={newCustRegNo}
                      onChange={(e) => setNewCustRegNo(e.target.value)}
                      placeholder="E.g. AB18 CDE"
                      className="form-input"
                      style={{ textTransform: 'uppercase', fontWeight: 'bold' }}
                    />
                    <button 
                      type="button" 
                      disabled={isSearchingPlate}
                      onClick={handleLookupPlate}
                      className="btn btn-outline"
                    >
                      {isSearchingPlate ? 'Searching...' : 'Lookup Plate'}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Make</label>
                  <input
                    type="text"
                    list="makes-list-admin-customers"
                    value={newCustMake}
                    onChange={(e) => setNewCustMake(e.target.value)}
                    placeholder="E.g. FORD"
                    className="form-input"
                  />
                  <datalist id="makes-list-admin-customers">
                    {makesList.map(m => <option key={m} value={m} />)}
                  </datalist>
                </div>

                <div className="form-group">
                  <label className="form-label">Model</label>
                  <input
                    type="text"
                    list="models-list-admin-customers"
                    value={newCustModel}
                    onChange={(e) => setNewCustModel(e.target.value)}
                    placeholder="E.g. FOCUS"
                    className="form-input"
                  />
                  <datalist id="models-list-admin-customers">
                    {modelsList.map(m => <option key={m} value={m} />)}
                  </datalist>
                </div>

                <div className="form-group">
                  <label className="form-label">Year</label>
                  <input
                    type="number"
                    value={newCustYear}
                    onChange={(e) => setNewCustYear(e.target.value)}
                    placeholder="E.g. 2018"
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">MOT Expiry Date</label>
                  <input
                    type="date"
                    value={newCustExpiry}
                    onChange={(e) => setNewCustExpiry(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Last Service Date (Optional)</label>
                  <input
                    type="date"
                    value={newCustServiceDate}
                    onChange={(e) => setNewCustServiceDate(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <button type="button" onClick={() => setShowAddForm(false)} className="btn btn-outline">Cancel</button>
              <button type="submit" disabled={loading} className="btn btn-primary" style={{ padding: '0.65rem 2rem' }}>
                {loading ? <Loader size={18} className="spinner" style={{ animation: 'spin 1s linear infinite' }} /> : 'Create Customer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search Input */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem' }}>
        <div style={styles.searchWrapper}>
          <Search size={18} style={styles.searchIcon} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search customers by name, mobile, email, or vehicle registration plate..."
            style={styles.searchInput}
          />
        </div>
      </div>

      {/* Customers List Table */}
      <div className="card" style={{ padding: 0 }}>
        {filteredCustomers.length === 0 ? (
          <div style={{ padding: '4rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p style={{ margin: 0, fontWeight: '500' }}>No customer accounts matched your search queries.</p>
          </div>
        ) : (
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Customer Name</th>
                  <th>Email Address</th>
                  <th>Mobile Number</th>
                  <th>Preferred Contact</th>
                  <th>Vehicles</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((cust) => {
                  const custVehicles = vehicles.filter((v) => 
                    v.customerId && (
                      String(v.customerId).toLowerCase() === String(cust.id || '').toLowerCase() ||
                      String(v.customerId).toLowerCase() === String(cust._id || '').toLowerCase()
                    ) && v.status !== 'Sold'
                  );

                  return (
                    <tr key={cust.id}>
                      <td style={{ fontWeight: '700' }}>{cust.firstName} {cust.lastName}</td>
                      <td>{cust.email}</td>
                      <td>{cust.mobile}</td>
                      <td>
                        <span className="badge badge-sold" style={{ fontSize: '0.75rem' }}>
                          {cust.preferredContact}
                        </span>
                      </td>
                      <td>
                        <div style={styles.platesRow}>
                          {custVehicles.length === 0 ? (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>None</span>
                          ) : (
                            custVehicles.map(v => (
                              <span key={v.id} className="uk-plate" style={{ fontSize: '0.75rem', padding: '0.15rem 0.45rem', letterSpacing: 0 }}>
                                {v.registrationNumber}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          <button
                            onClick={() => navigate(`/admin/customer/${cust.id}`)}
                            className="btn btn-outline"
                            style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}
                          >
                            <Eye size={14} /> Profile
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  dashboardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '1.25rem',
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginTop: '1.25rem',
  },
  searchWrapper: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    position: 'relative',
    height: '40px',
    border: '1.5px solid var(--border-color)',
    borderRadius: '8px',
    backgroundColor: 'var(--bg-primary)',
    paddingLeft: '2.5rem',
  },
  searchIcon: {
    position: 'absolute',
    left: '12px',
    color: 'var(--text-muted)',
  },
  searchInput: {
    border: 'none',
    outline: 'none',
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
    fontSize: '0.95rem',
    color: 'var(--text-primary)',
  },
  platesRow: {
    display: 'flex',
    gap: '0.35rem',
    flexWrap: 'wrap',
  },
};
