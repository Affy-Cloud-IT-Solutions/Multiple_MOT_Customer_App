import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useWebData, BASE_URL } from '../context/WebDataContext';
import { useToast } from '../components/Toast';
import { Mail, Lock, Eye, EyeOff, Bell, Loader } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const { setToken, setUser, token, user } = useWebData();
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect
  useEffect(() => {
    if (token && user) {
      if (user.role === 'admin' || user.role === 'staff') {
        navigate('/admin');
      } else if (user.role === 'customer') {
        navigate('/customer');
      }
    }
  }, [token, user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      showToast('Please enter both email and password.', 'warning');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password: password.trim()
        })
      });

      const data = await response.json();
      setLoading(false);

      if (!response.ok) {
        showToast(data.error || 'Invalid credentials', 'error');
        return;
      }

      showToast('Welcome! Login successful.');
      setToken(data.token);
      setUser(data.user);
      
      if (data.user?.role === 'admin' || data.user?.role === 'staff') {
        navigate('/admin');
      } else {
        navigate('/customer');
      }
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
          <p style={styles.brandSubtitle}>Sign in to access your garage account</p>
        </div>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div style={styles.inputWrapper}>
              <Mail size={18} style={styles.inputIcon} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E.g. manager@garage.co.uk"
                className="form-input"
                style={styles.inputWithIcon}
                required
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.75rem' }}>
            <label className="form-label">Password</label>
            <div style={styles.inputWrapper}>
              <Lock size={18} style={styles.inputIcon} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="form-input"
                style={styles.inputWithIcon}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary" style={styles.submitBtn}>
            {loading ? (
              <Loader size={18} style={styles.spinner} />
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div style={styles.footer}>
          <span style={{ color: 'var(--text-secondary)' }}>Don't have an account? </span>
          <Link to="/signup" style={styles.signupLink}>Sign Up</Link>
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
  eyeBtn: {
    position: 'absolute',
    right: '12px',
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
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
  signupLink: {
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
