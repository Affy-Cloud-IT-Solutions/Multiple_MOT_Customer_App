import React, { useState, useEffect } from 'react';
import { useWebData } from '../context/WebDataContext';
import { useToast } from '../components/Toast';
import { UserPlus, Trash2, Mail, Lock, User, Loader, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function StaffManagement() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user, token, createStaffAccount, fetchStaffList, deleteStaffAccount } = useWebData();

  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form states
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [creatingStaff, setCreatingStaff] = useState(false);

  const loadStaff = async () => {
    try {
      const data = await fetchStaffList();
      setStaffList(data);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Failed to fetch staff list.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    if (user?.role !== 'admin') {
      showToast('Access denied. Only Super Admin can access staff controls.', 'error');
      navigate('/admin');
      return;
    }
    loadStaff();
  }, [token, user]);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName.trim() || !staffEmail.trim() || !staffPassword.trim()) {
      showToast('All fields are required.', 'warning');
      return;
    }

    setCreatingStaff(true);
    try {
      await createStaffAccount(
        staffName.trim(), 
        staffEmail.trim().toLowerCase(), 
        staffPassword.trim()
      );
      showToast(`Staff account for ${staffName} has been created successfully.`);
      setStaffName('');
      setStaffEmail('');
      setStaffPassword('');
      loadStaff(); // Reload directory
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Failed to register staff.', 'error');
    } finally {
      setCreatingStaff(false);
    }
  };

  const handleDeleteStaff = async (staffId: string, name: string) => {
    if (window.confirm(`Are you sure you want to permanently delete staff account for ${name}? This action cannot be undone.`)) {
      setDeletingId(staffId);
      try {
        await deleteStaffAccount(staffId);
        showToast('Staff member deleted successfully.');
        loadStaff();
      } catch (err: any) {
        console.error(err);
        showToast(err.message || 'Deletion failed.', 'error');
      } finally {
        setDeletingId(null);
      }
    }
  };

  return (
    <div className="animate-fade-in" style={{ padding: '0.5rem 0' }}>
      <h2 style={{ fontWeight: '800', fontSize: '1.6rem', margin: 0 }}>Staff Directory Control</h2>
      <p style={{ margin: '0.2rem 0 2rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
        Register staff credentials and manage permissions for garage operators.
      </p>

      <div className="responsive-grid" style={{ gridTemplateColumns: '1.2fr 2fr', alignItems: 'start' }}>
        {/* Create Staff */}
        <div className="card">
          <h3 style={{ marginBottom: '1.25rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <UserPlus size={20} color="var(--primary)" /> Add Staff Account
          </h3>

          <form onSubmit={handleCreateStaff} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <div style={styles.inputWrapper}>
                <User size={18} style={styles.inputIcon} />
                <input
                  type="text"
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  placeholder="E.g. Richard Hendricks"
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
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                  placeholder="E.g. richard@garage.com"
                  className="form-input"
                  style={styles.inputWithIcon}
                  required
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Password</label>
              <div style={styles.inputWrapper}>
                <Lock size={18} style={styles.inputIcon} />
                <input
                  type="password"
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                  placeholder="Enter staff password"
                  className="form-input"
                  style={styles.inputWithIcon}
                  required
                />
              </div>
            </div>

            <button type="submit" disabled={creatingStaff} className="btn btn-primary" style={{ height: '42px' }}>
              {creatingStaff ? (
                <Loader size={18} className="spinner" style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                'Create Account'
              )}
            </button>
          </form>
        </div>

        {/* Staff Directory Table List */}
        <div className="card">
          <h3 style={{ marginBottom: '1.25rem', fontWeight: '700' }}>Active Garage Staff</h3>

          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center' }}>
              <div style={styles.spinner} />
              <span style={{ marginTop: '0.5rem', display: 'block' }}>Loading staff registry...</span>
            </div>
          ) : staffList.length === 0 ? (
            <p style={{ fontStyle: 'italic', color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
              No staff members registered.
            </p>
          ) : (
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Operator Name</th>
                    <th>Email Address</th>
                    <th>Date Added</th>
                    <th style={{ textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {staffList.map((st) => (
                    <tr key={st._id}>
                      <td style={{ fontWeight: '700' }}>{st.username}</td>
                      <td>{st.email}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(st.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          <button
                            disabled={deletingId === st._id}
                            onClick={() => handleDeleteStaff(st._id, st.username)}
                            className="btn btn-outline"
                            style={{ padding: '0.35rem 0.5rem', color: 'var(--error)', borderColor: 'var(--error)' }}
                            title="Delete Account"
                          >
                            {deletingId === st._id ? (
                              <Loader size={14} className="spinner" style={{ animation: 'spin 1s linear infinite' }} />
                            ) : (
                              <Trash2 size={14} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
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
  spinner: {
    width: '24px',
    height: '24px',
    border: '3px solid var(--border-color)',
    borderTopColor: 'var(--primary)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    margin: '0 auto',
  },
};
