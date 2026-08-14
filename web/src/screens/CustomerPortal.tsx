import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWebData, BASE_URL } from '../context/WebDataContext';
import { useToast } from '../components/Toast';
import { 
  Car, 
  Calendar, 
  User, 
  History, 
  Plus, 
  Trash2, 
  Search, 
  Mail, 
  Phone, 
  MapPin, 
  LogOut, 
  Moon, 
  Sun 
} from 'lucide-react';

export default function CustomerPortal() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { 
    customers, 
    vehicles, 
    alerts, 
    token,
    user,
    setToken,
    setUser,
    addVehicle, 
    addAlert, 
    addAudit, 
    updateVehicleStatus, 
    lookupVehicle, 
    refreshData,
    fetchMakes,
    fetchModels
  } = useWebData();

  const [activeTab, setActiveTab] = useState<'vehicles' | 'history' | 'profile'>('vehicles');
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSearchingPlate, setIsSearchingPlate] = useState(false);

  // Autocomplete lists
  const [makesList, setMakesList] = useState<string[]>([]);
  const [modelsList, setModelsList] = useState<string[]>([]);
  
  // New Vehicle form states
  const [regNo, setRegNo] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [expiry, setExpiry] = useState('');

  // Fetch makes when add vehicle form opens
  useEffect(() => {
    if (showAddForm) {
      fetchMakes().then(setMakesList);
    }
  }, [showAddForm]);

  // Fetch models whenever make changes
  useEffect(() => {
    if (make) {
      fetchModels(make).then(setModelsList);
    } else {
      setModelsList([]);
    }
  }, [make]);

  // Profile preferences
  const [preferredContact, setPreferredContact] = useState<'SMS' | 'Email' | 'WhatsApp'>('Email');
  const [updatingContact, setUpdatingContact] = useState(false);

  // Find active customer profile
  const customer = customers.find((c) => c.id === user?.customerId) || customers[0];

  useEffect(() => {
    if (!token) {
      navigate('/login');
    }
  }, [token, navigate]);

  useEffect(() => {
    if (customer) {
      setPreferredContact(customer.preferredContact);
    }
  }, [customer]);

  const customerVehicles = vehicles.filter((v) => 
    v.customerId && (
      String(v.customerId).toLowerCase() === String(customer?.id || '').toLowerCase() ||
      String(v.customerId).toLowerCase() === String(customer?._id || '').toLowerCase()
    ) && v.status !== 'Scrapped'
  );

  const customerAlerts = alerts.filter((a) => 
    a.customerId && (
      String(a.customerId).toLowerCase() === String(customer?.id || '').toLowerCase() ||
      String(a.customerId).toLowerCase() === String(customer?._id || '').toLowerCase()
    )
  );

  const handleLookupPlate = async () => {
    const vrnClean = regNo.trim().toUpperCase();
    if (!vrnClean) {
      showToast('Please enter a vehicle registration number first.', 'warning');
      return;
    }
    
    setIsSearchingPlate(true);
    try {
      const res = await lookupVehicle(vrnClean);
      if (res && res.found && res.vehicle) {
        const v = res.vehicle;
        setMake(v.make || '');
        setModel(v.model || '');
        setYear(v.year ? String(v.year) : '');
        setExpiry(v.motExpiryDate || '');
        showToast(`Vehicle details retrieved for ${v.make} ${v.model}.`);
      } else {
        showToast('Vehicle details not found in registry. Please enter manually.', 'warning');
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Plate lookup failed.', 'error');
    } finally {
      setIsSearchingPlate(false);
    }
  };

  const handleAddNewVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regNo.trim() || !make.trim() || !model.trim() || !year.trim() || !expiry.trim()) {
      showToast('Please fill in all vehicle fields.', 'warning');
      return;
    }

    if (!/^\d{4}$/.test(year.trim())) {
      showToast('Please enter a valid 4-digit year of manufacture.', 'warning');
      return;
    }

    try {
      await addVehicle({
        customerId: customer.id,
        registrationNumber: regNo.trim().toUpperCase(),
        make: make.trim().toUpperCase(),
        model: model.trim().toUpperCase(),
        year: year.trim(),
        motExpiryDate: expiry,
        status: 'Pending'
      });

      await addAlert({
        type: 'NEW_VEHICLE',
        customerName: `${customer.firstName} ${customer.lastName}`,
        customerId: customer.id,
        registrationNumber: regNo.trim().toUpperCase(),
        makeModel: `${make.trim().toUpperCase()} ${model.trim().toUpperCase()}`,
      });

      await addAudit(
        'New Vehicle Registered', 
        `${customer.firstName} ${customer.lastName} registered vehicle ${make.trim().toUpperCase()} (${regNo.trim().toUpperCase()}) via portal`
      );

      setRegNo('');
      setMake('');
      setModel('');
      setYear('');
      setExpiry('');
      setShowAddForm(false);
      showToast('Vehicle submitted for approval.');
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Could not register vehicle.', 'error');
    }
  };

  const handleMarkAsSold = async (vehicleId: string, reg: string, makeModel: string) => {
    if (window.confirm(`Are you sure you want to mark ${makeModel} (${reg}) as sold? Future MOT reminders will stop.`)) {
      try {
        await updateVehicleStatus(vehicleId, 'Sold');

        await addAlert({
          type: 'SOLD',
          customerName: `${customer.firstName} ${customer.lastName}`,
          customerId: customer.id,
          registrationNumber: reg,
          makeModel: makeModel,
        });

        await addAudit(
          'Vehicle Reported Sold',
          `${customer.firstName} ${customer.lastName} marked vehicle ${makeModel} (${reg}) as Sold`
        );

        showToast('Vehicle status updated successfully.');
      } catch (err: any) {
        console.error(err);
        showToast('Failed to update vehicle status.', 'error');
      }
    }
  };

  const updateContactPreference = async (preference: 'SMS' | 'Email' | 'WhatsApp') => {
    setUpdatingContact(true);
    try {
      const response = await fetch(`${BASE_URL}/customers/${customer.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          mobile: customer.mobile,
          address: customer.address,
          preferredContact: preference
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update customer preference');
      }

      setPreferredContact(preference);
      showToast(`Preferred contact method updated to ${preference}.`);
      await refreshData();
    } catch (err) {
      console.error(err);
      showToast('Could not update preference.', 'error');
    } finally {
      setUpdatingContact(false);
    }
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      setToken(null);
      setUser(null);
      navigate('/login');
    }
  };

  const formatShortDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (!customer) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '1rem' }}>
        <div style={styles.spinner} />
        <span>Loading your customer portal...</span>
      </div>
    );
  }

  return (
    <div style={styles.pageWrapper}>
      {/* Top Navbar */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.brand}>
            <div style={styles.logo}>
              <Car size={20} color="#FFFFFF" />
            </div>
            <span style={styles.brandTitle}>Customer Self-Service Portal</span>
          </div>

          <button onClick={handleLogout} style={styles.logoutBtn}>
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Customer Hero Info Block */}
      <div style={styles.main}>
        <div className="card animate-fade-in" style={styles.heroCard}>
          <div style={styles.heroLayout}>
            <div style={styles.avatar}>
              {customer.firstName[0]}{customer.lastName[0]}
            </div>
            <div>
              <h2 style={styles.customerName}>{customer.firstName} {customer.lastName}</h2>
              <div style={styles.metaRow}>
                <div style={styles.metaItem}>
                  <Mail size={14} color="var(--text-muted)" />
                  <span>{customer.email}</span>
                </div>
                <div style={styles.metaItem}>
                  <Phone size={14} color="var(--text-muted)" />
                  <span>{customer.mobile}</span>
                </div>
                {customer.address && (
                  <div style={styles.metaItem}>
                    <MapPin size={14} color="var(--text-muted)" />
                    <span>{customer.address}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="tabs-container" style={{ marginTop: '2rem' }}>
          <button 
            className={`tab-btn ${activeTab === 'vehicles' ? 'active' : ''}`}
            onClick={() => setActiveTab('vehicles')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Car size={18} /> My Vehicles
            </div>
          </button>
          <button 
            className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <History size={18} /> Request History
            </div>
          </button>
          <button 
            className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <User size={18} /> Communication Preferences
            </div>
          </button>
        </div>

        {/* Tab contents */}
        {activeTab === 'vehicles' && (
          <div className="animate-fade-in">
            {/* Header row with add btn */}
            <div style={styles.sectionHeader}>
              <h3>Registered Vehicles ({customerVehicles.length})</h3>
              {!showAddForm && (
                <button onClick={() => setShowAddForm(true)} className="btn btn-primary" style={{ padding: '0.5rem 1rem' }}>
                  <Plus size={18} /> Add New Vehicle
                </button>
              )}
            </div>

            {/* Add Vehicle Form overlay-card */}
            {showAddForm && (
              <div className="card animate-fade-in" style={{ marginBottom: '1.5rem', border: '1.5px dashed var(--primary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <h4 style={{ margin: 0, fontWeight: '700' }}>Register New Vehicle</h4>
                  <button onClick={() => setShowAddForm(false)} className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>Cancel</button>
                </div>

                <form onSubmit={handleAddNewVehicle} style={styles.formGrid}>
                  <div className="form-group">
                    <label className="form-label">Registration VRN</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type="text"
                        value={regNo}
                        onChange={(e) => setRegNo(e.target.value)}
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
                      list="makes-list-customer"
                      value={make}
                      onChange={(e) => setMake(e.target.value)}
                      placeholder="E.g. FORD"
                      className="form-input"
                    />
                    <datalist id="makes-list-customer">
                      {makesList.map(m => <option key={m} value={m} />)}
                    </datalist>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Model</label>
                    <input
                      type="text"
                      list="models-list-customer"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="E.g. FOCUS"
                      className="form-input"
                    />
                    <datalist id="models-list-customer">
                      {modelsList.map(m => <option key={m} value={m} />)}
                    </datalist>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Year of Manufacture</label>
                    <input
                      type="number"
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      placeholder="E.g. 2018"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">MOT Expiry Date</label>
                    <input
                      type="date"
                      value={expiry}
                      onChange={(e) => setExpiry(e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                    <button type="submit" className="btn btn-primary" style={{ padding: '0.65rem 2rem' }}>
                      Register Vehicle
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Vehicle List */}
            {customerVehicles.length === 0 ? (
              <div className="card" style={styles.emptyState}>
                <Car size={40} color="var(--text-muted)" />
                <p style={{ margin: 0, fontWeight: '600', color: 'var(--text-muted)' }}>No active vehicles registered.</p>
              </div>
            ) : (
              <div className="responsive-grid">
                {customerVehicles.map((v) => {
                  const isPending = v.status === 'Pending';
                  const isRejected = v.status === 'Rejected';
                  const isSold = v.status === 'Sold';
                  const showBlurOverlay = isSold || isRejected;

                  return (
                    <div key={v.id} className="card card-hover" style={{ ...styles.vehicleCard, position: 'relative', overflow: 'hidden' }}>
                      {/* Blurred card content */}
                      <div style={showBlurOverlay ? { filter: 'blur(3px)', opacity: 0.5, pointerEvents: 'none', display: 'flex', flexDirection: 'column', height: '100%' } : { display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <div style={styles.vehicleHeader}>
                          <div className="uk-plate">{v.registrationNumber}</div>
                          <span className={`badge badge-${v.status.toLowerCase()}`}>{v.status}</span>
                        </div>

                        <h4 style={styles.vehicleTitle}>{v.make} {v.model} ({v.year})</h4>
                        
                        <div style={styles.vehicleDetails}>
                          <div style={styles.detailsRow}>
                            <span style={styles.detailsLabel}>MOT Expiry Date:</span>
                            <span style={styles.detailsValue}>{formatShortDate(v.motExpiryDate)}</span>
                          </div>
                          {v.lastServiceDate && (
                            <div style={styles.detailsRow}>
                              <span style={styles.detailsLabel}>Last Serviced:</span>
                              <span style={styles.detailsValue}>{formatShortDate(v.lastServiceDate)}</span>
                            </div>
                          )}
                          {isRejected && v.rejectionReason && (
                            <div style={styles.rejectionNotice}>
                              <strong>Rejection Reason:</strong> {v.rejectionReason}
                            </div>
                          )}
                        </div>

                        <div style={styles.vehicleActions}>
                          <button
                            disabled={true}
                            onClick={() => handleMarkAsSold(v.id, v.registrationNumber, `${v.make} ${v.model}`)}
                            className="btn btn-outline btn-disabled"
                            style={{ padding: '0.45rem', flex: 1, borderColor: 'var(--error)', color: 'var(--error)' }}
                            title="Report Sold"
                          >
                            <Trash2 size={16} /> Mark Sold
                          </button>

                          <button
                            disabled={true}
                            onClick={() => navigate('/customer/book', { state: { vehicle: v } })}
                            className="btn btn-secondary btn-disabled"
                            style={{ padding: '0.45rem 1rem', flex: 2 }}
                          >
                            <Calendar size={16} /> Book MOT
                          </button>
                        </div>
                      </div>

                      {/* Overlays for Sold/Rejected */}
                      {showBlurOverlay && (
                        <>
                          {/* Top Right Status Badge */}
                          <div style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', zIndex: 10 }}>
                            <span className={`badge badge-${v.status.toLowerCase()}`} style={{ fontWeight: 'bold' }}>{v.status}</span>
                          </div>

                          {/* Center highlighted text */}
                          <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 9,
                          }}>
                            <span style={{
                              fontSize: '1.6rem',
                              fontWeight: '900',
                              letterSpacing: '3px',
                              color: isSold ? '#EF4444' : '#DC2626',
                              backgroundColor: isSold ? 'rgba(239, 68, 68, 0.12)' : 'rgba(220, 38, 38, 0.12)',
                              border: `2px solid ${isSold ? '#EF4444' : '#DC2626'}`,
                              padding: '0.5rem 1.75rem',
                              borderRadius: '8px',
                              textTransform: 'uppercase',
                              boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
                            }}>
                              {v.status}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab History */}
        {activeTab === 'history' && (
          <div className="animate-fade-in card">
            <h3 style={{ marginBottom: '1.25rem' }}>Request & Booking History</h3>
            {customerAlerts.length === 0 ? (
              <p style={{ fontStyle: 'italic', color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
                No past self-service requests or booking requests logged.
              </p>
            ) : (
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Request Date</th>
                      <th>Activity Type</th>
                      <th>Vehicle Description</th>
                      <th>License VRN</th>
                      <th>Approval Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerAlerts.map((alert) => (
                      <tr key={alert.id}>
                        <td>{alert.date}</td>
                        <td style={{ fontWeight: '600' }}>
                          {alert.type === 'BOOKED' && 'MOT Booking Request'}
                          {alert.type === 'NEW_VEHICLE' && 'New Vehicle Register'}
                          {alert.type === 'SOLD' && 'Reported Vehicle Sold'}
                        </td>
                        <td>{alert.makeModel.split(' - Slot:')[0]}</td>
                        <td><span className="uk-plate" style={{ fontSize: '0.8rem' }}>{alert.registrationNumber}</span></td>
                        <td>
                          <span className={`badge badge-${alert.status.toLowerCase()}`}>
                            {alert.status}
                          </span>
                          {alert.status === 'Rejected' && alert.rejectionReason && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '4px' }}>
                              Reason: {alert.rejectionReason}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab Profile Preference */}
        {activeTab === 'profile' && (
          <div className="animate-fade-in card" style={{ maxWidth: '600px' }}>
            <h3 style={{ marginBottom: '0.5rem' }}>Reminder Contact Settings</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Configure how you want to receive your automated MOT reminder alerts (45, 30, and 7 days prior to expiry).
            </p>

            <div style={styles.preferenceGroup}>
              {['SMS', 'Email', 'WhatsApp'].map((option) => (
                <label key={option} style={{
                  ...styles.preferenceLabel,
                  borderColor: preferredContact === option ? 'var(--primary)' : 'var(--border-color)',
                  backgroundColor: preferredContact === option ? 'var(--primary-light)' : 'transparent',
                }}>
                  <input
                    type="radio"
                    name="contact-preference"
                    value={option}
                    checked={preferredContact === option}
                    disabled={updatingContact}
                    onChange={() => updateContactPreference(option as 'SMS' | 'Email' | 'WhatsApp')}
                    style={{ marginRight: '0.75rem' }}
                  />
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.95rem' }}>Receive via {option}</strong>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {option === 'SMS' && `Reminders sent to mobile ${customer.mobile}`}
                      {option === 'Email' && `Reminders sent to address ${customer.email}`}
                      {option === 'WhatsApp' && `Reminders sent to whatsapp ${customer.mobile}`}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  pageWrapper: {
    minHeight: '100vh',
    backgroundColor: 'var(--bg-primary)',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    height: '65px',
    backgroundColor: '#0F172A',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 1.5rem',
    borderBottom: '1px solid #1E293B',
  },
  headerContent: {
    width: '100%',
    maxWidth: '1200px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  logo: {
    backgroundColor: 'var(--primary)',
    padding: '0.4rem',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
  },
  brandTitle: {
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'Outfit',
    fontSize: '1.1rem',
  },
  logoutBtn: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#F87171',
    fontWeight: '600',
    fontSize: '0.9rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
  },
  main: {
    flex: 1,
    width: '100%',
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '2rem 1.5rem',
  },
  heroCard: {
    padding: '1.5rem 2rem',
  },
  heroLayout: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.5rem',
    flexWrap: 'wrap',
  },
  avatar: {
    width: '54px',
    height: '54px',
    borderRadius: '50%',
    backgroundColor: 'var(--secondary)',
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: '1.3rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'Outfit',
  },
  customerName: {
    fontSize: '1.4rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    marginBottom: '0.5rem',
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.5rem',
    flexWrap: 'wrap',
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    margin: '2rem 0 1.25rem 0',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '1.25rem',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem 2rem',
    gap: '0.75rem',
    textAlign: 'center',
  },
  vehicleCard: {
    display: 'flex',
    flexDirection: 'column',
    padding: '1.5rem',
  },
  vehicleHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  vehicleTitle: {
    fontSize: '1.15rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    marginBottom: '1rem',
  },
  vehicleDetails: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    marginBottom: '1.5rem',
  },
  detailsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.85rem',
  },
  detailsLabel: {
    color: 'var(--text-muted)',
    fontWeight: '500',
  },
  detailsValue: {
    color: 'var(--text-primary)',
    fontWeight: '700',
  },
  rejectionNotice: {
    marginTop: '0.5rem',
    padding: '0.5rem',
    borderRadius: '6px',
    backgroundColor: 'var(--error-light)',
    border: '1px solid var(--error)',
    fontSize: '0.8rem',
    color: 'var(--error)',
  },
  vehicleActions: {
    display: 'flex',
    gap: '0.75rem',
    borderTop: '1px solid var(--border-color)',
    paddingTop: '1rem',
  },
  preferenceGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  preferenceLabel: {
    display: 'flex',
    alignItems: 'flex-start',
    padding: '1rem',
    borderRadius: '8px',
    border: '1.5px solid',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  spinner: {
    width: '28px',
    height: '28px',
    border: '3px solid var(--border-color)',
    borderTopColor: 'var(--primary)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
};
