import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { BASE_URL } from '../context/WebDataContext';
import { useToast } from '../components/Toast';
import { User, Mail, Lock, Phone, Loader, Bell } from 'lucide-react';

export default function Signup() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mobile, setMobile] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) {
      showToast('Name, email, and password are required.', 'warning');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password: password.trim(),
          mobile: mobile.trim() || 'N/A'
        })
      });

      const data = await response.json();
      setLoading(false);

      if (!response.ok) {
        showToast(data.error || 'Registration failed. Try a different email.', 'error');
        return;
      }

      showToast('Registration successful! Please log in.');
      navigate('/login');
    } catch (err) {
      setLoading(false);
      console.error(err);
      showToast('Could not connect to the backend server.', 'error');
    }
  };

  return (
    <div style={styles.container}>
      <div className="glass-card" style={styles.card}>
        <div style={styles.logoHeader}>
          <div style={styles.logoIcon}>
            <Bell size={32} color="#FFFFFF" />
          </div>
          <h2 style={styles.brandTitle}>MOT Reminders</h2>
          <p style={styles.brandSubtitle}>Register a customer self-service account</p>
        </div>

        <form onSubmit={handleSignup}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <div style={styles.inputWrapper}>
              <User size={18} style={styles.inputIcon} />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="E.g. John Doe"
                className="form-input"
                style={styles.inputWithIcon}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div style={styles.inputWrapper}>
              <Mail size={18} style={styles.inputIcon} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E.g. john@example.com"
                className="form-input"
                style={styles.inputWithIcon}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Mobile Number</label>
            <div style={styles.inputWrapper}>
              <Phone size={18} style={styles.inputIcon} />
              <input
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="E.g. 07123456789"
                className="form-input"
                style={styles.inputWithIcon}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.75rem' }}>
            <label className="form-label">Password</label>
            <div style={styles.inputWrapper}>
              <Lock size={18} style={styles.inputIcon} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create password"
                className="form-input"
                style={styles.inputWithIcon}
                required
              />
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary" style={styles.submitBtn}>
            {loading ? (
              <Loader size={18} style={styles.spinner} />
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <div style={styles.footer}>
          <span style={{ color: 'var(--text-secondary)' }}>Already have an account? </span>
          <Link to="/login" style={styles.loginLink}>Login</Link>
          <div style={{ marginTop: '1rem' }}>
            <Link to="/" style={styles.homeLink}>← Back to MOT Checker</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--bg-primary)',
    padding: '1.5rem',
  },
  card: {
    maxWidth: '420px',
    width: '100%',
    padding: '2.5rem 2rem',
  },
  logoHeader: {
    textAlign: 'center',
    marginBottom: '2rem',
  },
  logoIcon: {
    backgroundColor: 'var(--primary)',
    padding: '0.75rem',
    borderRadius: '16px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1rem',
    boxShadow: '0 4px 10px rgba(79, 70, 229, 0.25)',
  },
  brandTitle: {
    fontSize: '1.6rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    margin: '0 0 0.25rem 0',
    letterSpacing: '-0.5px',
  },
  brandSubtitle: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    margin: 0,
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: '12px',
    color: 'var(--text-muted)',
    pointerEvents: 'none',
  },
  inputWithIcon: {
    paddingLeft: '2.5rem',
  },
  submitBtn: {
    width: '100%',
    height: '44px',
  },
  spinner: {
    animation: 'spin 1s linear infinite',
  },
  footer: {
    textAlign: 'center',
    marginTop: '2rem',
    fontSize: '0.9rem',
  },
  loginLink: {
    color: 'var(--secondary)',
    textDecoration: 'none',
    fontWeight: '700',
  },
  homeLink: {
    color: 'var(--text-muted)',
    textDecoration: 'none',
    fontSize: '0.85rem',
    fontWeight: '500',
  },
};
