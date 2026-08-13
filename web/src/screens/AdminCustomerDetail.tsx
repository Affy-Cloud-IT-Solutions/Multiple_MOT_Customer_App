import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWebData, BASE_URL } from '../context/WebDataContext';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';
import { 
  Car, 
  Calendar, 
  History, 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Clock, 
  Check, 
  XOctagon, 
  Loader,
  CalendarCheck
} from 'lucide-react';

export default function AdminCustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { 
    customers, 
    vehicles, 
    alerts, 
    audits, 
    token,
    addVehicle, 
    addAlert, 
    addAudit, 
    updateVehicleStatus, 
    approveAlert, 
    rejectAlert, 
    rescheduleBooking, 
    lookupVehicle,
    refreshData,
    fetchMakes,
    fetchModels
  } = useWebData();

  const [activeTab, setActiveTab] = useState<'vehicles' | 'bookings' | 'history'>('vehicles');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // Modals visibility state
  const [addVehicleModal, setAddVehicleModal] = useState(false);
  const [rejectModal, setRejectModal] = useState(false);
  const [rescheduleModal, setRescheduleModal] = useState(false);

  // Modal data states
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  
  // Reschedule form states
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('09:00 AM');

  // Add Vehicle form states
  const [regNo, setRegNo] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [expiry, setExpiry] = useState('');
  const [serviceDate, setServiceDate] = useState('');
  const [isSearchingPlate, setIsSearchingPlate] = useState(false);

  // Autocomplete lists
  const [makesList, setMakesList] = useState<string[]>([]);
  const [modelsList, setModelsList] = useState<string[]>([]);

  // Fetch makes when add vehicle modal opens
  useEffect(() => {
    if (addVehicleModal) {
      fetchMakes().then(setMakesList);
    }
  }, [addVehicleModal]);

  // Fetch models whenever make changes
  useEffect(() => {
    if (make) {
      fetchModels(make).then(setModelsList);
    } else {
      setModelsList([]);
    }
  }, [make]);

  const customer = customers.find((c) => c.id === id);

  useEffect(() => {
    if (!token) {
      navigate('/login');
    }
  }, [token, navigate]);

  if (!customer) {
    return (
      <div style={styles.centered}>
        <h3>Customer not found.</h3>
        <button onClick={() => navigate('/admin/customers')} className="btn btn-outline" style={{ marginTop: '1rem' }}>
          Back to Customers
        </button>
      </div>
    );
  }

  // Filter child collections
  const customerVehicles = vehicles.filter((v) => 
    v.customerId && String(v.customerId).toLowerCase() === String(id || '').toLowerCase()
  );
  
  const customerBookings = alerts.filter((a) => 
    a.type === 'BOOKED' && a.customerId && String(a.customerId).toLowerCase() === String(id || '').toLowerCase()
  );

  const customerAudits = audits.filter((a) => {
    const details = a.details.toLowerCase();
    const name = `${customer.firstName} ${customer.lastName}`.toLowerCase();
    const email = customer.email.toLowerCase();
    const hasPlate = customerVehicles.some((v) => details.includes(v.registrationNumber.toLowerCase()));
    return details.includes(name) || details.includes(email) || hasPlate;
  });

  const handleLookupPlate = async () => {
    const vrnClean = regNo.trim().toUpperCase();
    if (!vrnClean) {
      showToast('Please enter a plate number first.', 'warning');
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

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regNo.trim() || !make.trim() || !model.trim() || !year.trim() || !expiry.trim()) {
      showToast('Please fill in registration, make, model, year, and MOT expiry.', 'warning');
      return;
    }

    setLoadingAction('add_vehicle');
    try {
      await addVehicle({
        customerId: customer.id,
        registrationNumber: regNo.trim().toUpperCase(),
        make: make.trim().toUpperCase(),
        model: model.trim().toUpperCase(),
        year: year.trim(),
        motExpiryDate: expiry.trim(),
        lastServiceDate: serviceDate.trim() || undefined,
        status: 'Active'
      });

      await addAudit(
        'Vehicle Registered by Staff',
        `Staff registered vehicle ${make.trim().toUpperCase()} (${regNo.trim().toUpperCase()}) for customer ${customer.firstName} ${customer.lastName}`
      );

      setRegNo('');
      setMake('');
      setModel('');
      setYear('');
      setExpiry('');
      setServiceDate('');
      setAddVehicleModal(false);
      showToast('Vehicle registered successfully!');
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Failed to add vehicle.', 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleMarkAsSold = async (vehicleId: string, reg: string, makeModel: string) => {
    if (window.confirm(`Are you sure you want to mark ${makeModel} (${reg}) as sold? Future reminders will stop.`)) {
      try {
        await updateVehicleStatus(vehicleId, 'Sold');

        await addAlert({
          type: 'SOLD',
          customerName: `${customer.firstName} ${customer.lastName}`,
          customerId: customer.id,
          registrationNumber: reg,
          makeModel: makeModel,
          status: 'Approved' // Pre-approved by staff
        });

        await addAudit(
          'Vehicle Marked Sold',
          `Staff marked vehicle ${makeModel} (${reg}) as Sold on behalf of customer ${customer.firstName} ${customer.lastName}`
        );

        showToast('Vehicle marked sold.');
      } catch (err) {
        console.error(err);
        showToast('Failed to update vehicle status.', 'error');
      }
    }
  };

  const handleConfirmAlert = async (alertId: string) => {
    setLoadingAction(alertId);
    try {
      await approveAlert(alertId);
      showToast('Booking confirmed successfully.');
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Could not approve booking.', 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRejectClick = (alertId: string) => {
    setSelectedAlertId(alertId);
    setRejectionReason('');
    setRejectModal(true);
  };

  const submitRejection = async () => {
    if (!selectedAlertId) return;
    const alertId = selectedAlertId;

    setRejectModal(false);
    setLoadingAction(alertId);
    try {
      await rejectAlert(alertId, rejectionReason);
      showToast('Booking rejected.');
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Rejection failed.', 'error');
    } finally {
      setLoadingAction(null);
      setSelectedAlertId(null);
    }
  };

  const handleRescheduleClick = (alertId: string) => {
    setSelectedAlertId(alertId);
    setRescheduleDate('');
    setRescheduleTime('09:00 AM');
    setRescheduleModal(true);
  };

  const submitReschedule = async () => {
    if (!selectedAlertId || !rescheduleDate || !rescheduleTime) return;
    const alertId = selectedAlertId;

    setRescheduleModal(false);
    setLoadingAction(alertId);
    try {
      await rescheduleBooking(alertId, rescheduleDate, rescheduleTime);
      showToast('Booking rescheduled successfully.');
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Reschedule failed.', 'error');
    } finally {
      setLoadingAction(null);
      setSelectedAlertId(null);
    }
  };

  const formatShortDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const timeSlots = [
    { label: 'Morning (09:00 AM)', value: '09:00 AM' },
    { label: 'Late Morning (11:30 AM)', value: '11:30 AM' },
    { label: 'Afternoon (02:00 PM)', value: '02:00 PM' },
    { label: 'Late Afternoon (04:30 PM)', value: '04:30 PM' },
  ];

  return (
    <div className="animate-fade-in" style={{ padding: '0.5rem 0' }}>
      {/* Navbar Title header */}
      <div style={styles.detailHeader}>
        <button onClick={() => navigate('/admin/customers')} style={styles.backBtn}>
          <ArrowLeft size={18} />
          <span>Customers List</span>
        </button>
        <h2 style={{ fontWeight: '800', fontSize: '1.4rem', margin: 0 }}>Customer Profile Card</h2>
        <div style={{ width: '120px' }} />
      </div>

      {/* Customer profile block */}
      <div className="card" style={styles.profileBlock}>
        <div style={styles.avatar}>
          {customer.firstName[0]}{customer.lastName[0]}
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0, fontWeight: '800', fontSize: '1.3rem' }}>{customer.firstName} {customer.lastName}</h3>
          <div style={styles.metaRow}>
            <div style={styles.metaItem}><strong>Email:</strong> {customer.email}</div>
            <div style={styles.metaItem}><strong>Mobile:</strong> {customer.mobile}</div>
            <div style={styles.metaItem}><strong>Contact Preference:</strong> {customer.preferredContact}</div>
            {customer.address && (
              <div style={{ ...styles.metaItem, gridColumn: 'span 2' }}>
                <strong>Address:</strong> {customer.address}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs list bar */}
      <div className="tabs-container" style={{ marginTop: '2rem' }}>
        <button className={`tab-btn ${activeTab === 'vehicles' ? 'active' : ''}`} onClick={() => setActiveTab('vehicles')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Car size={16} /> Registered Vehicles ({customerVehicles.length})
          </div>
        </button>
        <button className={`tab-btn ${activeTab === 'bookings' ? 'active' : ''}`} onClick={() => setActiveTab('bookings')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <CalendarCheck size={16} /> MOT Bookings ({customerBookings.length})
          </div>
        </button>
        <button className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <History size={16} /> Audit Trail ({customerAudits.length})
          </div>
        </button>
      </div>

      {/* Tab contents */}
      {activeTab === 'vehicles' && (
        <div className="animate-fade-in">
          <div style={styles.sectionHeader}>
            <h3 style={{ margin: 0, fontWeight: '700' }}>Vehicles Registered</h3>
            <button onClick={() => setAddVehicleModal(true)} className="btn btn-primary" style={{ padding: '0.5rem 1rem' }}>
              <Plus size={16} /> Add Vehicle
            </button>
          </div>

          {customerVehicles.length === 0 ? (
            <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Car size={36} style={{ margin: '0 auto 0.5rem auto' }} />
              <p style={{ margin: 0 }}>No vehicles mapped to this customer account.</p>
            </div>
          ) : (
            <div className="responsive-grid">
              {customerVehicles.map((v) => {
                const isPending = v.status === 'Pending';
                const isRejected = v.status === 'Rejected';

                return (
                  <div key={v.id} className="card" style={styles.vehicleCard}>
                    <div style={styles.cardHeader}>
                      <span className="uk-plate">{v.registrationNumber}</span>
                      <span className={`badge badge-${v.status.toLowerCase()}`}>{v.status}</span>
                    </div>

                    <h4 style={{ fontSize: '1.1rem', fontWeight: '800', margin: '1rem 0 0.5rem 0' }}>{v.make} {v.model} ({v.year})</h4>
                    
                    <div style={styles.vehicleDetails}>
                      <div style={styles.detailsRow}>
                        <span style={styles.detailsLabel}>Expiry Date:</span>
                        <span style={styles.detailsValue}>{formatShortDate(v.motExpiryDate)}</span>
                      </div>
                      {v.lastServiceDate && (
                        <div style={styles.detailsRow}>
                          <span style={styles.detailsLabel}>Service Date:</span>
                          <span style={styles.detailsValue}>{formatShortDate(v.lastServiceDate)}</span>
                        </div>
                      )}
                      {isRejected && v.rejectionReason && (
                        <div style={styles.rejectionNotice}>
                          <strong>Reason:</strong> {v.rejectionReason}
                        </div>
                      )}
                    </div>

                    <div style={styles.vehicleActions}>
                      <button
                        disabled={v.status === 'Sold' || v.status === 'Scrapped'}
                        onClick={() => handleMarkAsSold(v.id, v.registrationNumber, `${v.make} ${v.model}`)}
                        className={`btn btn-outline ${v.status === 'Sold' || v.status === 'Scrapped' ? 'btn-disabled' : ''}`}
                        style={{ padding: '0.4rem', flex: 1, color: 'var(--error)', borderColor: 'var(--error)' }}
                        title="Mark Sold"
                      >
                        <Trash2 size={15} /> Sold
                      </button>
                      <button
                        disabled={isPending || isRejected || v.status === 'Sold' || v.status === 'Scrapped'}
                        onClick={() => navigate('/admin/book', { state: { vehicle: v, customer, isAdmin: true } })}
                        className={`btn btn-secondary ${isPending || isRejected || v.status === 'Sold' || v.status === 'Scrapped' ? 'btn-disabled' : ''}`}
                        style={{ padding: '0.4rem 1rem', flex: 2 }}
                      >
                        <Calendar size={15} /> Book MOT
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'bookings' && (
        <div className="animate-fade-in card">
          <h3 style={{ marginBottom: '1.25rem', fontWeight: '700' }}>Active MOT Appointments</h3>

          {customerBookings.length === 0 ? (
            <p style={{ fontStyle: 'italic', color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
              No MOT bookings scheduled or pending.
            </p>
          ) : (
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Date Scheduled</th>
                    <th>License Plate</th>
                    <th>Booking Details</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customerBookings.map((bk) => {
                    const isPending = bk.status === 'Pending';
                    const isApproved = bk.status === 'Approved';

                    return (
                      <tr key={bk.id}>
                        <td>{bk.date}</td>
                        <td><span className="uk-plate" style={{ fontSize: '0.8rem' }}>{bk.registrationNumber}</span></td>
                        <td>{bk.makeModel}</td>
                        <td>
                          <span className={`badge badge-${bk.status.toLowerCase()}`}>
                            {bk.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                            {isPending && (
                              <>
                                <button
                                  disabled={loadingAction === bk.id}
                                  onClick={() => handleConfirmAlert(bk.id)}
                                  className="btn btn-primary"
                                  style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', backgroundColor: 'var(--success)' }}
                                >
                                  {loadingAction === bk.id ? '...' : <Check size={14} />}
                                </button>
                                <button
                                  disabled={loadingAction === bk.id}
                                  onClick={() => handleRejectClick(bk.id)}
                                  className="btn btn-danger"
                                  style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                                >
                                  <XOctagon size={14} />
                                </button>
                              </>
                            )}
                            {isApproved && (
                              <button
                                onClick={() => handleRescheduleClick(bk.id)}
                                className="btn btn-outline"
                                style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', color: 'var(--secondary)', borderColor: 'var(--secondary)' }}
                              >
                                <Clock size={12} /> Reschedule
                              </button>
                            )}
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
      )}

      {activeTab === 'history' && (
        <div className="animate-fade-in card">
          <h3 style={{ marginBottom: '1.25rem', fontWeight: '700' }}>History & Audit Log</h3>
          {customerAudits.length === 0 ? (
            <p style={{ fontStyle: 'italic', color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
              No history trail found.
            </p>
          ) : (
            <div style={styles.historyList}>
              {customerAudits.map((log) => (
                <div key={log.id} style={styles.logItem}>
                  <div style={styles.logMeta}>
                    <strong style={{ color: 'var(--primary)' }}>{log.activity}</strong>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{log.date}</span>
                  </div>
                  <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    {log.details}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Rejection Modal */}
      <Modal isOpen={rejectModal} onClose={() => setRejectModal(false)} title="Reject Booking Request">
        <div className="form-group">
          <label className="form-label">Rejection Reason</label>
          <textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="E.g. No slots available, garage closed for maintenance"
            className="form-input"
            style={{ height: '80px', resize: 'none' }}
            required
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
          <button onClick={() => setRejectModal(false)} className="btn btn-outline">Cancel</button>
          <button onClick={submitRejection} className="btn btn-danger">Reject Booking</button>
        </div>
      </Modal>

      {/* Reschedule Modal */}
      <Modal isOpen={rescheduleModal} onClose={() => setRescheduleModal(false)} title="Reschedule MOT Slot">
        <div className="form-group">
          <label className="form-label">New Date</label>
          <input
            type="date"
            value={rescheduleDate}
            onChange={(e) => setRescheduleDate(e.target.value)}
            className="form-input"
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label">New Time Slot</label>
          <select
            value={rescheduleTime}
            onChange={(e) => setRescheduleTime(e.target.value)}
            className="form-input"
            style={{ height: '40px' }}
          >
            {timeSlots.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
          <button onClick={() => setRescheduleModal(false)} className="btn btn-outline">Cancel</button>
          <button onClick={submitReschedule} className="btn btn-secondary">Reschedule Slot</button>
        </div>
      </Modal>

      {/* Add Vehicle Modal */}
      <Modal isOpen={addVehicleModal} onClose={() => setAddVehicleModal(false)} title="Register Vehicle Details">
        <form onSubmit={handleCreateVehicle}>
          <div className="form-group">
            <label className="form-label">Registration Number</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={regNo}
                onChange={(e) => setRegNo(e.target.value)}
                placeholder="E.g. AB18 CDE"
                className="form-input"
                style={{ textTransform: 'uppercase', fontWeight: 'bold' }}
                required
              />
              <button 
                type="button" 
                disabled={isSearchingPlate}
                onClick={handleLookupPlate}
                className="btn btn-outline"
              >
                {isSearchingPlate ? 'Searching...' : 'Lookup'}
              </button>
            </div>
          </div>

          <div style={styles.formGrid}>
            <div className="form-group">
              <label className="form-label">Make</label>
              <input
                type="text"
                list="makes-list-admin-details"
                value={make}
                onChange={(e) => setMake(e.target.value)}
                placeholder="E.g. TOYOTA"
                className="form-input"
                required
              />
              <datalist id="makes-list-admin-details">
                {makesList.map(m => <option key={m} value={m} />)}
              </datalist>
            </div>
            <div className="form-group">
              <label className="form-label">Model</label>
              <input
                type="text"
                list="models-list-admin-details"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="E.g. YARIS"
                className="form-input"
                required
              />
              <datalist id="models-list-admin-details">
                {modelsList.map(m => <option key={m} value={m} />)}
              </datalist>
            </div>
            <div className="form-group">
              <label className="form-label">Year</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="E.g. 2017"
                className="form-input"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">MOT Expiry Date</label>
              <input
                type="date"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                className="form-input"
                required
              />
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Last Service Date (Optional)</label>
              <input
                type="date"
                value={serviceDate}
                onChange={(e) => setServiceDate(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
            <button type="button" onClick={() => setAddVehicleModal(false)} className="btn btn-outline">Cancel</button>
            <button type="submit" disabled={loadingAction === 'add_vehicle'} className="btn btn-primary">
              {loadingAction === 'add_vehicle' ? 'Adding...' : 'Add Vehicle'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  detailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
  },
  backBtn: {
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '0.9rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
  },
  profileBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.5rem',
    padding: '1.5rem 2rem',
    flexWrap: 'wrap',
  },
  avatar: {
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    backgroundColor: 'var(--secondary)',
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: '1.4rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'Outfit',
  },
  metaRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '0.75rem',
    marginTop: '0.75rem',
    fontSize: '0.9rem',
    color: 'var(--text-secondary)',
  },
  metaItem: {
    display: 'flex',
    gap: '0.35rem',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    margin: '1.5rem 0 1.25rem 0',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '1rem',
  },
  vehicleCard: {
    display: 'flex',
    flexDirection: 'column',
    padding: '1.25rem',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vehicleDetails: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.45rem',
    marginBottom: '1rem',
  },
  detailsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.8rem',
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
    fontSize: '0.75rem',
    color: 'var(--error)',
  },
  vehicleActions: {
    display: 'flex',
    gap: '0.5rem',
    borderTop: '1px solid var(--border-color)',
    paddingTop: '0.75rem',
  },
  historyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  logItem: {
    paddingBottom: '1rem',
    borderBottom: '1px solid var(--border-color)',
  },
  logMeta: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  centered: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem 1rem',
  },
};
