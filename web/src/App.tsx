import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { WebDataProvider, useWebData } from './context/WebDataContext';
import { ToastProvider, useToast } from './components/Toast';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import { Menu, X } from 'lucide-react';

// Screens imports
import MOTChecker from './screens/MOTChecker';
import Login from './screens/Login';
import Signup from './screens/Signup';
import CustomerPortal from './screens/CustomerPortal';
import BookingScreen from './screens/BookingScreen';
import TokenPortal from './screens/TokenPortal';
import AdminDashboard from './screens/AdminDashboard';
import AdminCustomers from './screens/AdminCustomers';
import AdminCustomerDetail from './screens/AdminCustomerDetail';
import AdminReminders from './screens/AdminReminders';
import AdminAlerts from './screens/AdminAlerts';
import StaffManagement from './screens/StaffManagement';
import AdminProfileSettings from './screens/AdminProfileSettings';
import BookedMots from './screens/BookedMots';

// Layout component for Admin Views
function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, user, setToken, setUser } = useWebData();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Authenticate user check
  useEffect(() => {
    if (!token || !user) {
      navigate('/login');
      return;
    }
    if (user.role !== 'admin' && user.role !== 'staff') {
      navigate('/customer');
    }
  }, [token, user, navigate]);

  // Determine dynamic title for header
  const getHeaderTitle = () => {
    const path = location.pathname;
    if (path === '/admin') return 'Dashboard Overview';
    if (path === '/admin/booked-mots') return "Booked MOT's";
    if (path === '/admin/customers') return 'Customer Directory';
    if (path.startsWith('/admin/customer/')) return 'Customer Detailed Profile';
    if (path === '/admin/reminders') return 'Reminders & Reports';
    if (path === '/admin/alerts') return 'Action Notifications';
    if (path === '/admin/staff') return 'Staff Management';
    if (path === '/admin/profile') return 'Settings & Preferences';
    if (path === '/admin/book') return 'MOT Assisted Booking Desk';
    return 'Admin Panel';
  };

  const handleSignOut = () => {
    setToken(null);
    setUser(null);
    navigate('/login');
  };

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  return (
    <div className="app-container">
      {/* Mobile Toggle bar */}
      <div style={styles.mobileBar}>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} style={styles.toggleBtn}>
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <span style={styles.mobileTitle}>MOT Garage Desk</span>
      </div>

      {/* Sidebar Panel */}
      <div style={{
        ...styles.sidebarWrapper,
        display: mobileMenuOpen ? 'block' : 'none',
      }} className="mobile-sidebar-show">
        <Sidebar onLogout={handleSignOut} />
      </div>

      <div style={styles.desktopSidebar}>
        <Sidebar onLogout={handleSignOut} />
      </div>

      {/* Main View Area */}
      <div className="main-content">
        <Header title={getHeaderTitle()} />
        <main style={{ marginTop: '1.5rem', flex: 1 }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// Inline CSS for App layout handles
const styles: Record<string, React.CSSProperties> = {
  mobileBar: {
    display: 'none',
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: '60px',
    backgroundColor: '#0F172A',
    color: '#FFFFFF',
    alignItems: 'center',
    padding: '0 1rem',
    zIndex: 101,
    borderBottom: '1px solid #1E293B',
  },
  toggleBtn: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#FFFFFF',
    cursor: 'pointer',
    padding: '0.25rem',
    display: 'flex',
    alignItems: 'center',
  },
  mobileTitle: {
    fontWeight: '800',
    fontFamily: 'Outfit',
    fontSize: '1.05rem',
    marginLeft: '1rem',
  },
  sidebarWrapper: {
    position: 'fixed',
    top: '60px',
    left: 0,
    bottom: 0,
    width: '260px',
    zIndex: 99,
  },
  desktopSidebar: {
    display: 'block',
  },
};

// Add responsive mobile overrides to document head dynamically
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.innerHTML = `
    @media (max-width: 768px) {
      .app-container {
        flex-direction: column;
      }
      .mobile-sidebar-show {
        display: block !important;
        top: 60px !important;
      }
      .main-content {
        margin-left: 0 !important;
        padding-top: 5rem !important;
      }
      /* Hide desktop sidebar */
      div[style*="display: block"] {
        display: none !important;
      }
      div[style*="position: fixed"] {
        display: block !important;
      }
      header[style*="height: 70px"] {
        display: none !important;
      }
      div[style*="display: none"] {
        display: flex !important;
      }
    }
  `;
  document.head.appendChild(style);
}

export default function App() {
  return (
    <BrowserRouter>
      <WebDataProvider>
        <ToastProvider>
          <Routes>
            {/* Public/Auth Routes */}
            <Route path="/" element={<MOTChecker />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/update" element={<TokenPortal />} />

            {/* Customer Portal Routes */}
            <Route path="/customer" element={<CustomerPortal />} />
            <Route path="/customer/book" element={<BookingScreen />} />

            {/* Admin Portal Dashboard Routes */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="booked-mots" element={<BookedMots />} />
              <Route path="customers" element={<AdminCustomers />} />
              <Route path="customer/:id" element={<AdminCustomerDetail />} />
              <Route path="reminders" element={<AdminReminders />} />
              <Route path="alerts" element={<AdminAlerts />} />
              <Route path="staff" element={<StaffManagement />} />
              <Route path="profile" element={<AdminProfileSettings />} />
              <Route path="book" element={<BookingScreen />} />
            </Route>
          </Routes>
        </ToastProvider>
      </WebDataProvider>
    </BrowserRouter>
  );
}
