import React, { useEffect, useState } from 'react';
import { useWebData } from '../context/WebDataContext';
import { Sun, Moon, Bell, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  const { user, alerts, setToken, setUser } = useWebData();
  const navigate = useNavigate();
  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const getInitials = (name: string) => {
    if (!name) return 'GU';
    return name.slice(0, 2).toUpperCase();
  };

  const handleSignOut = () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      setToken(null);
      setUser(null);
      navigate('/login');
    }
  };

  const pendingAlerts = alerts.filter(a => a.status === 'Pending').length;

  return (
    <header style={styles.header}>
      {/* Title */}
      <h1 style={styles.title}>{title}</h1>

      {/* Control panel */}
      <div style={styles.controlPanel}>
        {/* Theme Toggle */}
        <button onClick={toggleTheme} style={styles.iconBtn} title="Toggle Dark/Light Mode">
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>

        {/* Notifications बेल */}
        <button onClick={() => navigate('/admin/alerts')} style={styles.iconBtn} title="Notifications">
          <div style={styles.bellWrapper}>
            <Bell size={20} />
            {pendingAlerts > 0 && <span style={styles.bellBadge} />}
          </div>
        </button>

        {/* Vertical divider */}
        <div style={styles.divider} />

        {/* Profile Card */}
        <div style={styles.profileCard}>
          <div style={styles.avatar}>
            {getInitials(user?.name || '')}
          </div>
          <div style={styles.profileDetails}>
            <span style={styles.profileName}>{user?.name || 'User'}</span>
            <span style={styles.profileRole}>
              {user?.role === 'admin' ? 'Super Admin' : user?.role === 'staff' ? 'Staff' : 'Customer'}
            </span>
          </div>
        </div>

        {/* Small Logout Button for Quick Sign Out */}
        <button onClick={handleSignOut} style={styles.logoutBtn} title="Sign Out">
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    height: '70px',
    borderBottom: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 1.5rem',
    position: 'sticky',
    top: 0,
    zIndex: 90,
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0,
  },
  controlPanel: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  iconBtn: {
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '0.5rem',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  },
  bellWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: '1px',
    right: '2px',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#EF4444',
  },
  divider: {
    height: '24px',
    width: '1px',
    backgroundColor: 'var(--border-color)',
  },
  profileCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  avatar: {
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    backgroundColor: 'var(--primary)',
    color: '#FFFFFF',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.9rem',
    boxShadow: '0 2px 5px rgba(0,0,0,0.08)',
  },
  profileDetails: {
    display: 'flex',
    flexDirection: 'column',
  },
  profileName: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    lineHeight: '1.2',
  },
  profileRole: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    fontWeight: '500',
    marginTop: '2px',
  },
  logoutBtn: {
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--error)',
    cursor: 'pointer',
    padding: '0.5rem',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: '0.5rem',
  },
};
