import React, { useState } from 'react';
import { useWebData } from '../context/WebDataContext';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';
import { 
  Car, 
  ShieldCheck, 
  XOctagon, 
  Trash2, 
  CalendarRange, 
  AlertCircle, 
  Loader, 
  BellOff 
} from 'lucide-react';

export default function AdminAlerts() {
  const { showToast } = useToast();
  const { alerts, approveAlert, rejectAlert, acknowledgeAlert } = useWebData();

  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [selectedAlertType, setSelectedAlertType] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Renders only Pending status alerts
  const pendingAlerts = alerts.filter((a) => a.status === 'Pending');

  const handleApprove = async (alertId: string, alertType: string) => {
    setLoadingAction(alertId);
    try {
      await approveAlert(alertId);
      let msg = 'Action approved successfully!';
      if (alertType === 'NEW_VEHICLE') {
        msg = 'New vehicle approved and added to customer profile.';
      } else if (alertType === 'SOLD') {
        msg = 'Vehicle marked as sold. Reminders turned off.';
      } else if (alertType === 'BOOKED') {
        msg = 'MOT Booking confirmed!';
      }
      showToast(msg);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Approval action failed.', 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRejectClick = (alertId: string, alertType: string) => {
    setSelectedAlertId(alertId);
    setSelectedAlertType(alertType);
    setRejectionReason('');
    setRejectModalVisible(true);
  };

  const submitRejection = async () => {
    if (!selectedAlertId) return;
    const alertId = selectedAlertId;
    const alertType = selectedAlertType;

    setRejectModalVisible(false);
    setLoadingAction(alertId);
    try {
      if (alertType === 'BOOKED' || alertType === 'NEW_VEHICLE') {
        await rejectAlert(alertId, rejectionReason);
      } else {
        await acknowledgeAlert(alertId);
      }
      showToast('Request rejected successfully.');
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Rejection action failed.', 'error');
    } finally {
      setLoadingAction(null);
      setSelectedAlertId(null);
      setSelectedAlertType(null);
    }
  };

  return (
    <div className="animate-fade-in" style={{ padding: '0.5rem 0' }}>
      <h2 style={{ fontWeight: '800', fontSize: '1.6rem', margin: 0 }}>Action Alerts</h2>
      <p style={{ margin: '0.2rem 0 2rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
        Review and process customer self-service actions.
      </p>

      {pendingAlerts.length === 0 ? (
        <div className="card" style={styles.emptyContainer}>
          <BellOff size={48} color="var(--text-muted)" />
          <h3 style={{ margin: 0, fontWeight: '600', color: 'var(--text-muted)' }}>No pending alerts</h3>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>All requests have been successfully processed.</p>
        </div>
      ) : (
        <div style={styles.alertList}>
          {pendingAlerts.map((item) => {
            let icon = <AlertCircle size={20} color="var(--secondary)" />;
            let titleText = 'Alert Notice';
            let color = 'var(--secondary)';
            let bgColor = 'var(--secondary-light)';

            if (item.type === 'NEW_VEHICLE') {
              icon = <Car size={20} color="var(--success)" />;
              titleText = 'New Vehicle Register';
              color = 'var(--success)';
              bgColor = 'var(--success-light)';
            } else if (item.type === 'SOLD') {
              icon = <Trash2 size={20} color="var(--warning)" />;
              titleText = 'Vehicle Reported Sold';
              color = 'var(--warning)';
              bgColor = 'var(--warning-light)';
            } else if (item.type === 'BOOKED') {
              icon = <CalendarRange size={20} color="var(--primary)" />;
              titleText = 'MOT Booking Requested';
              color = 'var(--primary)';
              bgColor = 'var(--primary-light)';
            }

            return (
              <div key={item.id} className="card" style={styles.alertCard}>
                {/* Alert Top */}
                <div style={styles.cardHeader}>
                  <div style={{ ...styles.typeBadge, backgroundColor: bgColor, color }}>
                    {icon}
                    <span style={{ fontWeight: '700', fontSize: '0.85rem' }}>{titleText}</span>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.date}</span>
                </div>

                {/* Alert Body */}
                <div style={styles.cardBody}>
                  <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.5' }}>
                    Customer <strong>{item.customerName}</strong>{' '}
                    {item.type === 'NEW_VEHICLE' && 'wishes to register a new vehicle:'}
                    {item.type === 'SOLD' && 'reported they sold their vehicle:'}
                    {item.type === 'BOOKED' && 'requested an MOT booking for:'}
                  </p>

                  <div style={styles.vehicleRow}>
                    <span className="uk-plate">{item.registrationNumber}</span>
                    <strong style={{ fontSize: '1rem' }}>{item.makeModel}</strong>
                  </div>
                </div>

                {/* Divider */}
                <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '1rem 0' }} />

                {/* Action buttons */}
                <div style={styles.actionRow}>
                  <button
                    disabled={loadingAction !== null}
                    onClick={() => handleRejectClick(item.id, item.type)}
                    className="btn btn-outline"
                    style={{ borderColor: 'var(--error)', color: 'var(--error)', flex: 1 }}
                  >
                    <XOctagon size={16} /> Reject
                  </button>
                  <button
                    disabled={loadingAction !== null}
                    onClick={() => handleApprove(item.id, item.type)}
                    className="btn btn-primary"
                    style={{ backgroundColor: item.type === 'BOOKED' ? 'var(--secondary)' : 'var(--primary)', flex: 2 }}
                  >
                    {loadingAction === item.id ? (
                      <Loader size={16} className="spinner" style={{ animation: 'spin 1s linear infinite' }} />
                    ) : (
                      <>
                        <ShieldCheck size={16} />
                        <span>{item.type === 'BOOKED' ? 'Confirm Booking' : 'Approve'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reject Reason input dialog */}
      <Modal
        isOpen={rejectModalVisible}
        onClose={() => setRejectModalVisible(false)}
        title={selectedAlertType === 'NEW_VEHICLE' ? 'Reject Vehicle Registration' : 'Reject Booking Request'}
      >
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.25rem', lineHeight: '1.5' }}>
          Please specify a reason for rejecting this {selectedAlertType === 'NEW_VEHICLE' ? 'registration' : 'booking'} request. The customer will see this message in their portal.
        </p>

        <div className="form-group">
          <textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder={selectedAlertType === 'NEW_VEHICLE' ? "E.g. Invalid document details or plate is not registered" : "E.g. No slots available, garage closed"}
            className="form-input"
            style={{ height: '80px', resize: 'none' }}
            required
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
          <button onClick={() => setRejectModalVisible(false)} className="btn btn-outline">Cancel</button>
          <button onClick={submitRejection} className="btn btn-danger">Confirm Rejection</button>
        </div>
      </Modal>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  emptyContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem 2rem',
    gap: '0.75rem',
    textAlign: 'center',
  },
  alertList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
    gap: '1.25rem',
  },
  alertCard: {
    padding: '1.25rem',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  typeBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.45rem',
    padding: '0.35rem 0.75rem',
    borderRadius: '6px',
  },
  cardBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
  },
  vehicleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
    backgroundColor: 'var(--bg-tertiary)',
    padding: '0.5rem 0.75rem',
    borderRadius: '6px',
  },
  actionRow: {
    display: 'flex',
    gap: '0.75rem',
  },
};
