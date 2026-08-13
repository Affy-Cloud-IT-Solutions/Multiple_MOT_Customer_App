import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { BASE_URL } from '../context/WebDataContext';
import { useToast } from '../components/Toast';
import { Car, Calendar, CheckCircle2, AlertTriangle, Send, Loader } from 'lucide-react';

export default function TokenPortal() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const token = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [customer, setCustomer] = useState<any>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [targetVehicleId, setTargetVehicleId] = useState<string | null>(null);

  // Form states for adding new vehicle
  const [showAddForm, setShowAddForm] = useState(false);
  const [regNo, setRegNo] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [expiry, setExpiry] = useState('');

  // Fetch token details
  const verifyToken = async () => {
    if (!token) {
      showToast('No security token found in your link.', 'error');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${BASE_URL}/response/portal?token=${token}`);
      const data = await response.json();
      setLoading(false);

      if (!response.ok) {
        showToast(data.error || 'Your self-service link is invalid or has expired.', 'error');
        return;
      }

      setCustomer(data.customer);
      setVehicles(data.vehicles || []);
      setTargetVehicleId(data.targetVehicleId || null);
    } catch (err) {
      setLoading(false);
      console.error(err);
      showToast('Could not connect to the backend server.', 'error');
    }
  };

  useEffect(() => {
    verifyToken();
  }, [token]);

  const handleAction = async (actionType: 'BOOK_MOT' | 'VEHICLE_SOLD', vehicleId: string, reg: string, makeModel: string) => {
    const confirmMsg = actionType === 'BOOK_MOT'
      ? `Would you like to request an MOT booking slot for ${makeModel} (${reg})?`
      : `Are you sure you want to mark ${makeModel} (${reg}) as sold? Automated reminders will be deactivated.`;

    if (!window.confirm(confirmMsg)) return;

    setVerifying(true);
    try {
      const response = await fetch(`${BASE_URL}/response/portal/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          actionType,
          vehicleId
        })
      });

      const data = await response.json();
      setVerifying(false);

      if (!response.ok) {
        showToast(data.error || 'Failed to complete requested action.', 'error');
        return;
      }

      showToast(data.message || 'Action completed successfully.');
      verifyToken(); // Refresh data
    } catch (err) {
      setVerifying(false);
      console.error(err);
      showToast('Failed to communicate with backend.', 'error');
    }
  };

  const handleAddNewVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regNo.trim() || !make.trim() || !model.trim() || !expiry.trim()) {
      showToast('Please fill in plate registration, make, model, and expiry.', 'warning');
      return;
    }

    setVerifying(true);
    try {
      const response = await fetch(`${BASE_URL}/response/portal/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          actionType: 'ADD_VEHICLE',
          registrationNumber: regNo.trim().toUpperCase(),
          make: make.trim().toUpperCase(),
          model: model.trim().toUpperCase(),
          year: year.trim() || undefined,
          motExpiryDate: expiry
        })
      });

      const data = await response.json();
      setVerifying(false);

      if (!response.ok) {
        showToast(data.error || 'Failed to submit vehicle details.', 'error');
        return;
      }

      showToast('Vehicle details submitted successfully for staff approval!');
      setRegNo('');
      setMake('');
      setModel('');
      setYear('');
      setExpiry('');
      setShowAddForm(false);
      verifyToken();
    } catch (err) {
      setVerifying(false);
      console.error(err);
      showToast('Failed to communicate with backend.', 'error');
    }
  };

  if (loading) {
    return (
      <div style={styles.centered}>
        <div style={styles.spinner} />
        <span style={{ marginTop: '1rem', fontWeight: '500' }}>Verifying secure token link...</span>
      </div>
    );
  }

  if (!customer) {
    return (
      <div style={styles.centered}>
        <div className="card" style={{ maxWidth: '400px', textAlign: 'center', padding: '2.5rem' }}>
          <AlertTriangle size={48} color="var(--error)" style={{ margin: '0 auto 1rem auto' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '0.5rem' }}>Access Denied</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
            This link is invalid, expired, or has already been used. Please request a new reminder link or sign in to your profile.
          </p>
          <button onClick={() => navigate('/login')} className="btn btn-primary" style={{ marginTop: '1rem', width: '100%' }}>
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.pageWrapper}>
      <header style={styles.header}>
        <span style={styles.headerTitle}>MOT Self-Service Portal</span>
      </header>

      <main style={styles.main}>
        <div className="card" style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontWeight: '800', fontSize: '1.4rem', marginBottom: '0.25rem' }}>Hello {customer.firstName}!</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Verify your vehicles details or request direct bookings below. No login required.
          </p>
        </div>

        {verifying && (
          <div style={styles.progressOverlay}>
            <Loader size={20} className="spinner" style={{ animation: 'spin 1s linear infinite', marginRight: '0.5rem' }} />
            <span>Processing your request...</span>
          </div>
        )}

        <h3 style={{ marginBottom: '1.25rem', fontWeight: '700' }}>Your Registered Vehicles</h3>

        {vehicles.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <Car size={36} color="var(--text-muted)" style={{ margin: '0 auto 0.5rem auto' }} />
            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>No active vehicles mapped to this link.</p>
          </div>
        ) : (
          <div style={styles.vehicleList}>
            {vehicles.map((v) => {
              const isTarget = v.id === targetVehicleId;
              const isSoldOrScrapped = v.status === 'Sold' || v.status === 'Scrapped';

              return (
                <div 
                  key={v.id} 
                  className="card" 
                  style={{
                    ...styles.vehicleCard,
                    border: isTarget ? '1.5px solid var(--secondary)' : '1px solid var(--border-color)',
                    boxShadow: isTarget ? '0 0 15px rgba(56, 189, 248, 0.15)' : 'var(--card-shadow)'
                  }}
                >
                  <div style={styles.cardLeft}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <div className="uk-plate" style={{ fontSize: '1.2rem' }}>{v.registrationNumber}</div>
                      {isSoldOrScrapped && (
                        <span className={`badge badge-${v.status.toLowerCase()}`}>{v.status}</span>
                      )}
                    </div>
                    <div style={{ marginTop: '0.5rem' }}>
                      <h4 style={{ margin: 0, fontWeight: '800' }}>{v.make} {v.model}</h4>
                      <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        MOT Expiry: <strong>{new Date(v.motExpiryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
                      </p>
                    </div>
                  </div>

                  <div style={styles.cardRight}>
                    <button
                      disabled={verifying || isSoldOrScrapped}
                      onClick={() => handleAction('VEHICLE_SOLD', v.id, v.registrationNumber, `${v.make} ${v.model}`)}
                      className={`btn btn-outline ${isSoldOrScrapped ? 'btn-disabled' : ''}`}
                      style={{ borderColor: 'var(--error)', color: 'var(--error)', flex: 1 }}
                    >
                      Report Sold
                    </button>
                    <button
                      disabled={verifying || isSoldOrScrapped}
                      onClick={() => handleAction('BOOK_MOT', v.id, v.registrationNumber, `${v.make} ${v.model}`)}
                      className={`btn btn-secondary ${isSoldOrScrapped ? 'btn-disabled' : ''}`}
                      style={{ flex: 2 }}
                    >
                      <Calendar size={16} /> Request MOT Booking
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Register New Vehicle section */}
        <div style={{ marginTop: '2.5rem' }}>
          {!showAddForm ? (
            <button onClick={() => setShowAddForm(true)} className="btn btn-outline" style={{ borderStyle: 'dashed', width: '100%', height: '48px' }}>
              + Register Another Vehicle
            </button>
          ) : (
            <div className="card animate-fade-in" style={{ border: '1.5px dashed var(--primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h4 style={{ margin: 0, fontWeight: '800' }}>Add Vehicle Details</h4>
                <button onClick={() => setShowAddForm(false)} className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', marginLeft: 'auto' }}>Cancel</button>
              </div>

              <form onSubmit={handleAddNewVehicle} style={styles.formGrid}>
                <div className="form-group">
                  <label className="form-label">Registration Number</label>
                  <input
                    type="text"
                    value={regNo}
                    onChange={(e) => setRegNo(e.target.value)}
                    placeholder="E.g. AB18 CDE"
                    className="form-input"
                    style={{ textTransform: 'uppercase', fontWeight: 'bold' }}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Make</label>
                  <input
                    type="text"
                    value={make}
                    onChange={(e) => setMake(e.target.value)}
                    placeholder="E.g. TOYOTA"
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Model</label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="E.g. YARIS"
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Year</label>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    placeholder="E.g. 2017"
                    className="form-input"
                  />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">MOT Expiry Date</label>
                  <input
                    type="date"
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>

                <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button type="submit" disabled={verifying} className="btn btn-primary" style={{ padding: '0.65rem 2rem' }}>
                    Submit Vehicle Approval Request
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </main>
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
    borderBottom: '1px solid #1E293B',
  },
  headerTitle: {
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'Outfit',
    fontSize: '1.25rem',
  },
  main: {
    flex: 1,
    width: '100%',
    maxWidth: '800px',
    margin: '0 auto',
    padding: '2.5rem 1.5rem',
  },
  centered: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    backgroundColor: 'var(--bg-primary)',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid var(--border-color)',
    borderTopColor: 'var(--primary)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  vehicleList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  vehicleCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1.5rem',
    flexWrap: 'wrap',
    gap: '1.5rem',
  },
  cardLeft: {
    flex: 1,
    minWidth: '220px',
  },
  cardRight: {
    display: 'flex',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '1.25rem',
  },
  progressOverlay: {
    backgroundColor: 'var(--primary-light)',
    border: '1.5px solid var(--primary)',
    color: 'var(--primary)',
    fontWeight: '600',
    padding: '1rem',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1.5rem',
  },
};
