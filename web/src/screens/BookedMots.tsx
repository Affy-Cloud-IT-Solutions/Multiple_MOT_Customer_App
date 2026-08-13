import React, { useState } from 'react';
import { useWebData } from '../context/WebDataContext';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';
import { 
  Calendar, 
  User, 
  Clock, 
  Check, 
  XOctagon, 
  Loader, 
  CalendarDays,
  AlertCircle
} from 'lucide-react';

export default function BookedMots() {
  const { showToast } = useToast();
  const { 
    alerts, 
    approveAlert, 
    rejectAlert, 
    rescheduleBooking 
  } = useWebData();

  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // Modal visibility states
  const [rejectModal, setRejectModal] = useState(false);
  const [rescheduleModal, setRescheduleModal] = useState(false);

  // Selected Alert info
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  
  // Reschedule date states
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('09:00 AM');

  // Filter alerts of type BOOKED
  const bookedMots = alerts.filter((a) => a.type === 'BOOKED');

  // Group booked MOTs by customer
  const groupedBookings = bookedMots.reduce((acc, alert) => {
    const custId = alert.customerId || 'unknown';
    if (!acc[custId]) {
      acc[custId] = {
        customerId: custId,
        customerName: alert.customerName,
        alerts: []
      };
    }
    acc[custId].alerts.push(alert);
    return acc;
  }, {} as Record<string, { customerId: string; customerName: string; alerts: typeof bookedMots }>);

  const groupedList = Object.values(groupedBookings);

  const handleConfirm = async (alertId: string) => {
    setLoadingAction(alertId);
    try {
      await approveAlert(alertId);
      showToast('MOT Booking has been confirmed successfully!');
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Could not confirm booking.', 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const openRejectModal = (alertId: string) => {
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
      showToast('Booking request has been rejected.');
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Could not reject booking.', 'error');
    } finally {
      setLoadingAction(null);
      setSelectedAlertId(null);
    }
  };

  const openRescheduleModal = (alertId: string) => {
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

  const timeSlots = [
    { label: 'Morning (09:00 AM)', value: '09:00 AM' },
    { label: 'Late Morning (11:30 AM)', value: '11:30 AM' },
    { label: 'Afternoon (02:00 PM)', value: '02:00 PM' },
    { label: 'Late Afternoon (04:30 PM)', value: '04:30 PM' },
  ];

  return (
    <div className="animate-fade-in" style={{ padding: '0.5rem 0' }}>
      {/* Title Header */}
      <div style={styles.dashboardHeader}>
        <div>
          <h2 style={{ fontWeight: '800', fontSize: '1.6rem', margin: 0 }}>Booked MOT's</h2>
          <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            List of all booked MOT appointment slots grouped by customer.
          </p>
        </div>
        <div className="badge badge-active" style={{ fontSize: '1rem', padding: '0.5rem 1rem' }}>
          Total Bookings: {bookedMots.length}
        </div>
      </div>

      {groupedList.length === 0 ? (
        <div className="card" style={styles.emptyContainer}>
          <CalendarDays size={48} color="var(--text-muted)" />
          <h3 style={{ margin: 0, fontWeight: '600', color: 'var(--text-muted)' }}>No MOT Bookings Found</h3>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>There are no booking request cards registered.</p>
        </div>
      ) : (
        <div style={styles.groupsContainer}>
          {groupedList.map((group) => (
            <div key={group.customerId} className="card" style={styles.groupCard}>
              {/* Customer Header Section */}
              <div style={styles.customerHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <User size={20} color="var(--secondary)" />
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800' }}>
                    {group.customerName || 'Unknown Customer'}
                  </h3>
                </div>
                <span className="badge badge-pending">
                  {group.alerts.length} {group.alerts.length === 1 ? 'Booking' : 'Bookings'}
                </span>
              </div>

              {/* List of sub-bookings for this customer */}
              <div style={styles.bookingsList}>
                {group.alerts.map((item) => {
                  const isPending = item.status === 'Pending';
                  const isApproved = item.status === 'Approved';
                  const isRejected = item.status === 'Rejected';

                  return (
                    <div key={item.id} style={styles.subBookingCard}>
                      <div style={styles.subHeader}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Date: {item.date}
                        </span>
                        <span className={`badge badge-${item.status.toLowerCase()}`}>
                          {item.status === 'Pending' ? 'Pending Confirmation' : item.status}
                        </span>
                      </div>

                      <div style={styles.subBody}>
                        <div className="uk-plate" style={{ fontSize: '0.9rem', marginRight: '0.75rem' }}>
                          {item.registrationNumber}
                        </div>
                        <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                          {item.makeModel}
                        </span>
                      </div>

                      {isRejected && item.rejectionReason && (
                        <div style={styles.rejectionNotice}>
                          <strong>Rejection Reason:</strong> {item.rejectionReason}
                        </div>
                      )}

                      {/* Action triggers */}
                      {isPending && (
                        <div style={styles.actionsRow}>
                          <button
                            disabled={loadingAction !== null}
                            onClick={() => openRejectModal(item.id)}
                            className="btn btn-outline"
                            style={{ borderColor: 'var(--error)', color: 'var(--error)', padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
                          >
                            <XOctagon size={14} /> Reject
                          </button>
                          <button
                            disabled={loadingAction !== null}
                            onClick={() => handleConfirm(item.id)}
                            className="btn btn-primary"
                            style={{ padding: '0.4rem 1.25rem', fontSize: '0.8rem' }}
                          >
                            {loadingAction === item.id ? (
                              <Loader size={14} className="spinner" style={{ animation: 'spin 1s linear infinite' }} />
                            ) : (
                              <>
                                <Check size={14} /> Confirm Booking
                              </>
                            )}
                          </button>
                        </div>
                      )}

                      {isApproved && (
                        <div style={styles.actionsRow}>
                          <button
                            onClick={() => openRescheduleModal(item.id)}
                            className="btn btn-outline"
                            style={{ borderColor: 'var(--secondary)', color: 'var(--secondary)', padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
                          >
                            <Clock size={14} /> Reschedule Slot
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
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
          <button onClick={submitRejection} className="btn btn-danger">Confirm Reject</button>
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
  emptyContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem 2rem',
    gap: '0.75rem',
    textAlign: 'center',
  },
  groupsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  groupCard: {
    padding: '1.5rem',
  },
  customerHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid var(--border-color)',
    paddingBottom: '0.75rem',
    marginBottom: '1rem',
  },
  bookingsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  subBookingCard: {
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    padding: '1rem',
  },
  subHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.75rem',
  },
  subBody: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '0.75rem',
  },
  rejectionNotice: {
    padding: '0.5rem 0.75rem',
    backgroundColor: 'var(--error-light)',
    border: '1px solid var(--error)',
    borderRadius: '6px',
    fontSize: '0.8rem',
    color: 'var(--error)',
    marginBottom: '0.75rem',
  },
  actionsRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.5rem',
    borderTop: '1px solid var(--border-color)',
    paddingTop: '0.75rem',
  },
};
