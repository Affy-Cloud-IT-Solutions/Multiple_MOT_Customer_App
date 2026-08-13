import React, { useState, useEffect } from 'react';
import { useWebData } from '../context/WebDataContext';
import { useToast } from '../components/Toast';
import { User, Mail, Shield, Bell, Moon, Sun, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AdminProfileSettings() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user, token } = useWebData();

  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
  });

  const [notifyEnabled, setNotifyEnabled] = useState(true);

  useEffect(() => {
    if (!token) {
      navigate('/login');
    }
  }, [token, navigate]);

  const handleToggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setThemeState(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('theme', nextTheme);
    showToast(`Switched to ${nextTheme} mode.`);
  };

  const getInitials = (name: string) => {
    if (!name) return 'GU';
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="animate-fade-in" style={{ padding: '0.5rem 0', maxWidth: '640px' }}>
      <h2 style={{ fontWeight: '800', fontSize: '1.6rem', margin: 0 }}>System Settings</h2>
      <p style={{ margin: '0.2rem 0 2rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
        Manage system settings and verify account information.
      </p>

      {/* Account Info Card */}
      <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <div style={styles.avatar}>
          {getInitials(user?.name || '')}
        </div>
        <div>
          <h3 style={{ margin: 0, fontWeight: '800', fontSize: '1.2rem' }}>{user?.name}</h3>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.2rem' }}>
            Logged in as <strong>{user?.role === 'admin' ? 'Super Admin' : 'Staff'}</strong>
          </span>
        </div>
      </div>

      {/* Preferences Section */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <h3 style={{ fontWeight: '700', fontSize: '1.1rem', margin: 0 }}>General Preferences</h3>

        {/* Theme Toggle option */}
        <div style={styles.settingRow}>
          <div style={styles.settingLeft}>
            <Sun size={20} color="var(--primary)" />
            <div>
              <strong style={styles.settingTitle}>Theme Mode</strong>
              <span style={styles.settingDesc}>Switch client layout styling themes</span>
            </div>
          </div>
          <button onClick={handleToggleTheme} className="btn btn-outline" style={{ padding: '0.45rem 1rem' }}>
            {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
          </button>
        </div>

        <div style={{ height: '1px', backgroundColor: 'var(--border-color)' }} />

        {/* Notification toggle */}
        <div style={styles.settingRow}>
          <div style={styles.settingLeft}>
            <Bell size={20} color="var(--secondary)" />
            <div>
              <strong style={styles.settingTitle}>Push Notification Alerts</strong>
              <span style={styles.settingDesc}>Receive sound warnings for new client booking notifications</span>
            </div>
          </div>
          <input
            type="checkbox"
            checked={notifyEnabled}
            onChange={(e) => {
              setNotifyEnabled(e.target.checked);
              showToast(e.target.checked ? 'Notifications enabled.' : 'Notifications muted.');
            }}
            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
          />
        </div>

        <div style={{ height: '1px', backgroundColor: 'var(--border-color)' }} />

        {/* Security Role card */}
        <div style={styles.settingRow}>
          <div style={styles.settingLeft}>
            <Shield size={20} color="var(--success)" />
            <div>
              <strong style={styles.settingTitle}>Security Clearance Role</strong>
              <span style={styles.settingDesc}>Clearance Level: {user?.role.toUpperCase()}</span>
            </div>
          </div>
          <span className="badge badge-active">{user?.role}</span>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  avatar: {
    width: '54px',
    height: '54px',
    borderRadius: '50%',
    backgroundColor: 'var(--primary)',
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: '1.25rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'Outfit',
  },
  settingRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
  },
  settingLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
  },
  settingTitle: {
    display: 'block',
    fontSize: '0.925rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  settingDesc: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    marginTop: '0.15rem',
    display: 'block',
  },
};
