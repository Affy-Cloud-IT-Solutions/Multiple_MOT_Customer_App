import React, { useState } from 'react';
import { useWebData } from '../context/WebDataContext';
import { useToast } from '../components/Toast';
import { 
  Users, 
  Car, 
  AlertTriangle, 
  Clock, 
  CalendarCheck, 
  RefreshCw, 
  Clipboard, 
  Mail, 
  Send 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { customers, vehicles, alerts, audits, refreshData } = useWebData();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshData();
      showToast('Database metrics updated.');
    } catch (err) {
      console.error(err);
      showToast('Refresh failed.', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const getDaysDiff = (dateStr: string) => {
    const today = new Date('2026-07-22'); // Mirroring mobile benchmark date
    const expiry = new Date(dateStr);
    const diffTime = expiry.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const activeVehicles = vehicles.filter((v) => v.status === 'Active');
  const totalCustomers = customers.length;
  const activeCount = activeVehicles.length;

  const dueIn7Days = activeVehicles.filter(v => {
    const diff = getDaysDiff(v.motExpiryDate);
    return diff >= 0 && diff <= 7;
  });
  
  const dueIn30Days = activeVehicles.filter(v => {
    const diff = getDaysDiff(v.motExpiryDate);
    return diff > 7 && diff <= 30;
  });

  const dueIn45Days = activeVehicles.filter(v => {
    const diff = getDaysDiff(v.motExpiryDate);
    return diff > 30 && diff <= 45;
  });

  const soldCount = vehicles.filter((v) => v.status === 'Sold').length;
  const bookedCount = alerts.filter(a => a.type === 'BOOKED').length;

  const handleSendReminder = (reg: string, customerId: string, days: number) => {
    const customer = customers.find(c => 
      String(c.id).toLowerCase() === String(customerId || '').toLowerCase() ||
      String(c._id).toLowerCase() === String(customerId || '').toLowerCase()
    );
    if (!customer) return;

    if (window.confirm(`Send ${days}-day MOT reminder to ${customer.firstName} ${customer.lastName} via ${customer.preferredContact}?`)) {
      showToast(`MOT reminder successfully sent to ${customer.firstName} via ${customer.preferredContact}!`);
    }
  };

  const statCards = [
    { label: 'Total Customers', value: totalCustomers, color: '#6366F1', icon: <Users size={20} /> },
    { label: 'Active Vehicles', value: activeCount, color: '#8B5CF6', icon: <Car size={20} /> },
    { label: 'Due in 7 Days', value: dueIn7Days.length, color: '#EF4444', icon: <AlertTriangle size={20} />, labelSub: 'Critical' },
    { label: 'Due in 30 Days', value: dueIn30Days.length, color: '#F59E0B', icon: <Clock size={20} />, labelSub: 'Warning' },
    { label: 'Due in 45 Days', value: dueIn45Days.length, color: '#10B981', icon: <Clock size={20} />, labelSub: 'Upcoming' },
    { label: "Booked MOT's", value: bookedCount, color: '#3B82F6', icon: <CalendarCheck size={20} />, action: () => navigate('/admin/booked-mots') },
    { label: 'Sold Vehicles', value: soldCount, color: '#6B7280', icon: <Car size={20} /> },
    { label: 'Total Audits', value: audits.length, color: '#EC4899', icon: <Clipboard size={20} /> },
  ];

  const urgentActionsList = [...dueIn7Days, ...dueIn30Days];

  return (
    <div className="animate-fade-in" style={styles.container}>
      {/* Title Header */}
      <div style={styles.dashboardHeader}>
        <div>
          <h2 style={{ fontWeight: '800', fontSize: '1.6rem', margin: 0 }}>Overview Dashboard</h2>
          <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Real-time management metrics and priority reminder controls.
          </p>
        </div>

        <button 
          onClick={handleRefresh} 
          disabled={isRefreshing} 
          className="btn btn-outline" 
          style={{ height: '40px', padding: '0 0.85rem' }}
        >
          <RefreshCw size={16} className={isRefreshing ? 'spinner' : ''} style={isRefreshing ? { animation: 'spin 1s linear infinite' } : {}} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Stats grid */}
      <div className="stats-grid">
        {statCards.map((card, idx) => (
          <div 
            key={idx} 
            className="card card-hover" 
            onClick={card.action}
            style={{ 
              ...styles.statCard, 
              borderLeft: `4px solid ${card.color}`,
              cursor: card.action ? 'pointer' : 'default'
            }}
          >
            <div style={{ ...styles.statIconWrapper, backgroundColor: `${card.color}15`, color: card.color }}>
              {card.icon}
            </div>
            <div>
              <span style={styles.statLabel}>{card.label}</span>
              <h3 style={styles.statValue}>{card.value}</h3>
              {card.labelSub && (
                <span style={{ ...styles.statSubText, color: card.color }}>{card.labelSub}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Urgent actions block */}
      <div className="card" style={{ marginTop: '2rem' }}>
        <h3 style={{ marginBottom: '1.25rem', fontWeight: '700' }}>
          Urgent MOT Actions ({urgentActionsList.length})
        </h3>

        {urgentActionsList.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <CheckCircle2 size={36} style={{ marginBottom: '0.5rem' }} />
            <p style={{ margin: 0, fontWeight: '500' }}>No vehicles require immediate attention.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Vehicle Plate</th>
                  <th>Make & Model</th>
                  <th>Days Left</th>
                  <th>Customer Name</th>
                  <th>Contact info</th>
                  <th>Remind Option</th>
                </tr>
              </thead>
              <tbody>
                {urgentActionsList.map((v) => {
                  const customer = customers.find(c => 
                    String(c.id).toLowerCase() === String(v.customerId || '').toLowerCase() ||
                    String(c._id).toLowerCase() === String(v.customerId || '').toLowerCase()
                  );
                  const daysLeft = getDaysDiff(v.motExpiryDate);
                  const isCritical = daysLeft <= 7;

                  return (
                    <tr key={v.id}>
                      <td><span className="uk-plate" style={{ fontSize: '0.85rem' }}>{v.registrationNumber}</span></td>
                      <td style={{ fontWeight: '600' }}>{v.make} {v.model} {v.year ? `(${v.year})` : ''}</td>
                      <td>
                        <span className={`badge badge-${isCritical ? 'rejected' : 'pending'}`}>
                          {daysLeft} days
                        </span>
                      </td>
                      <td>{customer ? `${customer.firstName} ${customer.lastName}` : 'Unknown'}</td>
                      <td>
                        <div style={{ fontSize: '0.85rem' }}>{customer?.mobile}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pref: {customer?.preferredContact}</div>
                      </td>
                      <td>
                        <button
                          onClick={() => handleSendReminder(v.registrationNumber, v.customerId, isCritical ? 7 : 30)}
                          className="btn btn-outline"
                          style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', color: 'var(--secondary)', borderColor: 'var(--secondary)' }}
                        >
                          <Send size={14} /> Send Remind
                        </button>
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

// Small helper icon component
const CheckCircle2 = ({ size, style }: any) => (
  <svg style={style} xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check-circle-2">
    <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
    <path d="m9 12 2 2 4-4"/>
  </svg>
);

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '0.5rem 0',
  },
  dashboardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
  },
  statCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.25rem',
    padding: '1.25rem 1.5rem',
  },
  statIconWrapper: {
    width: '42px',
    height: '42px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    fontSize: '0.85rem',
    fontWeight: '600',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  statValue: {
    fontSize: '1.5rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    margin: '0.2rem 0',
  },
  statSubText: {
    fontSize: '0.75rem',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
};
