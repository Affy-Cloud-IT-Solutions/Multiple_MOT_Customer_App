import React from 'react';
import { NavLink } from 'react-router-dom';
import { useWebData } from '../context/WebDataContext';
import { 
  LayoutDashboard, 
  Users, 
  Bell, 
  FileClock, 
  Settings, 
  ShieldAlert,
  LogOut,
  Calendar
} from 'lucide-react';

interface SidebarProps {
  onLogout: () => void;
}

export default function Sidebar({ onLogout }: SidebarProps) {
  const { alerts, user } = useWebData();
  const pendingAlertsCount = alerts.filter((a) => a.status === 'Pending').length;

  return (
    <aside style={styles.sidebar}>
      {/* Brand logo section */}
      <div style={styles.brandContainer}>
        <div style={styles.logoIcon}>
          <Bell size={24} color="#FFFFFF" />
        </div>
        <div>
          <h2 style={styles.brandTitle}>MOT System</h2>
          <p style={styles.brandSubtitle}>Garage Portal</p>
        </div>
      </div>

      {/* Nav Links */}
      <nav style={styles.nav}>
        <NavLink 
          to="/admin" 
          end
          style={({ isActive }) => ({
            ...styles.navLink,
            ...(isActive ? styles.navLinkActive : {})
          })}
        >
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </NavLink>

        <NavLink 
          to="/admin/customers" 
          style={({ isActive }) => ({
            ...styles.navLink,
            ...(isActive ? styles.navLinkActive : {})
          })}
        >
          <Users size={20} />
          <span>Customers</span>
        </NavLink>

        <NavLink 
          to="/admin/booked-mots" 
          style={({ isActive }) => ({
            ...styles.navLink,
            ...(isActive ? styles.navLinkActive : {})
          })}
        >
          <Calendar size={20} />
          <span>Booked MOT's</span>
        </NavLink>

        <NavLink 
          to="/admin/reminders" 
          style={({ isActive }) => ({
            ...styles.navLink,
            ...(isActive ? styles.navLinkActive : {})
          })}
        >
          <FileClock size={20} />
          <span>Reminders & Logs</span>
        </NavLink>

        <NavLink 
          to="/admin/alerts" 
          style={({ isActive }) => ({
            ...styles.navLink,
            ...(isActive ? styles.navLinkActive : {})
          })}
        >
          <div style={styles.alertLinkContent}>
            <div style={styles.alertLinkLeft}>
              <ShieldAlert size={20} />
              <span>Alert Notifications</span>
            </div>
            {pendingAlertsCount > 0 && (
              <span style={styles.badge}>{pendingAlertsCount}</span>
            )}
          </div>
        </NavLink>

        {user?.role === 'admin' && (
          <NavLink 
            to="/admin/staff" 
            style={({ isActive }) => ({
              ...styles.navLink,
              ...(isActive ? styles.navLinkActive : {})
            })}
          >
            <Users size={20} />
            <span>Staff Directory</span>
          </NavLink>
        )}

        <NavLink 
          to="/admin/profile" 
          style={({ isActive }) => ({
            ...styles.navLink,
            ...(isActive ? styles.navLinkActive : {})
          })}
        >
          <Settings size={20} />
          <span>Settings</span>
        </NavLink>
      </nav>

      {/* Logout button */}
      <div style={styles.footer}>
        <button onClick={onLogout} style={styles.logoutBtn}>
          <LogOut size={20} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    position: 'fixed',
    top: 0,
    left: 0,
    bottom: 0,
    width: '260px',
    backgroundColor: '#0F172A',
    color: '#F8FAFC',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 100,
    borderRight: '1px solid #1E293B',
  },
  brandContainer: {
    display: 'flex',
    alignItems: 'center',
    padding: '1.5rem',
    gap: '0.85rem',
    borderBottom: '1px solid #1E293B',
  },
  logoIcon: {
    backgroundColor: '#4F46E5',
    padding: '0.5rem',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: '1.2rem',
    fontWeight: 'bold',
    margin: 0,
    letterSpacing: '-0.25px',
  },
  brandSubtitle: {
    fontSize: '0.75rem',
    color: '#94A3B8',
    margin: 0,
  },
  nav: {
    flex: 1,
    padding: '1.5rem 1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  navLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
    padding: '0.75rem 1rem',
    color: '#94A3B8',
    textDecoration: 'none',
    fontWeight: '600',
    borderRadius: '8px',
    fontSize: '0.925rem',
    transition: 'all 0.2s ease',
  },
  navLinkActive: {
    backgroundColor: '#1E293B',
    color: '#FFFFFF',
    boxShadow: 'inset 4px 0px 0px #4F46E5',
  },
  alertLinkContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  alertLinkLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
  },
  badge: {
    backgroundColor: '#EF4444',
    color: '#FFFFFF',
    fontSize: '0.7rem',
    fontWeight: 'bold',
    padding: '0.15rem 0.45rem',
    borderRadius: '9999px',
  },
  footer: {
    padding: '1.5rem 1rem',
    borderTop: '1px solid #1E293B',
  },
  logoutBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
    padding: '0.75rem 1rem',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#F87171',
    fontWeight: '600',
    fontSize: '0.925rem',
    cursor: 'pointer',
    textAlign: 'left',
    borderRadius: '8px',
    transition: 'background-color 0.2s ease',
  },
};
