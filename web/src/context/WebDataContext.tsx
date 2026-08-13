import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export interface Customer {
  id: string;
  _id?: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  preferredContact: 'SMS' | 'Email' | 'WhatsApp';
  address?: string;
  createdDate: string;
  createdAt?: string;
}

export interface Vehicle {
  id: string;
  _id?: string;
  customerId: string;
  registrationNumber: string;
  make: string;
  model: string;
  year: string | number;
  motExpiryDate: string;
  lastServiceDate?: string;
  status: 'Active' | 'Sold' | 'Scrapped' | 'Pending' | 'Rejected';
  rejectionReason?: string;
}

export interface AlertNotification {
  id: string;
  _id?: string;
  type: 'NEW_VEHICLE' | 'SOLD' | 'BOOKED';
  customerName: string;
  customerId: string;
  registrationNumber: string;
  makeModel: string;
  date: string;
  createdAt?: string;
  status: 'Pending' | 'Approved' | 'Acknowledged' | 'Rejected';
  rejectionReason?: string;
}

export interface AuditLog {
  id: string;
  _id?: string;
  date: string;
  createdAt?: string;
  activity: string;
  details: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'staff' | 'customer';
  customerId?: string;
}

export interface ReminderTemplate {
  t45: string;
  t30: string;
  t7: string;
}

interface WebDataContextType {
  customers: Customer[];
  vehicles: Vehicle[];
  alerts: AlertNotification[];
  audits: AuditLog[];
  templates: ReminderTemplate | null;
  token: string | null;
  setToken: (token: string | null) => void;
  user: UserProfile | null;
  setUser: (user: UserProfile | null) => void;
  refreshData: () => Promise<void>;
  addCustomer: (customer: Omit<Customer, 'id' | 'createdDate'>) => Promise<string>;
  addVehicle: (vehicle: Omit<Vehicle, 'id'>) => Promise<void>;
  updateVehicleStatus: (vehicleId: string, status: 'Active' | 'Sold' | 'Scrapped' | 'Pending') => Promise<void>;
  addAlert: (alert: Omit<AlertNotification, 'id' | 'status' | 'date'> & { status?: 'Pending' | 'Approved' | 'Acknowledged' | 'Rejected', date?: string }) => Promise<void>;
  approveAlert: (alertId: string) => Promise<void>;
  acknowledgeAlert: (alertId: string) => Promise<void>;
  rejectAlert: (alertId: string, reason: string) => Promise<void>;
  addAudit: (activity: string, details: string) => Promise<void>;
  createStaffAccount: (name: string, email: string, password: string) => Promise<void>;
  fetchStaffList: () => Promise<any[]>;
  deleteStaffAccount: (staffId: string) => Promise<void>;
  rescheduleBooking: (alertId: string, date: string, slot: string) => Promise<void>;
  lookupVehicle: (vrn: string) => Promise<any>;
  saveTemplates: (templatesData: ReminderTemplate) => Promise<void>;
  triggerCronScan: () => Promise<any>;
  fetchMakes: (search?: string) => Promise<string[]>;
  fetchModels: (make: string, search?: string) => Promise<string[]>;
}

const WebDataContext = createContext<WebDataContextType | undefined>(undefined);

// Web App BASE_URL defaults to http://localhost:5000/api
export const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const decodeToken = (tokenStr: string | null) => {
  if (!tokenStr) return null;
  try {
    const payload = tokenStr.split('.')[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(base64);
    return JSON.parse(decoded);
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
};

const formatDoc = (doc: any) => {
  if (!doc) return null;
  return { ...doc, id: doc._id || doc.id };
};

export const WebDataProvider = ({ children }: { children: ReactNode }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [alerts, setAlerts] = useState<AlertNotification[]>([]);
  const [audits, setAudits] = useState<AuditLog[]>([]);
  const [templates, setTemplates] = useState<ReminderTemplate | null>(null);
  
  const [token, setTokenState] = useState<string | null>(() => {
    return localStorage.getItem('user_token');
  });

  const [user, setUserState] = useState<UserProfile | null>(() => {
    const stored = localStorage.getItem('user_profile');
    return stored ? JSON.parse(stored) : null;
  });

  const setUser = (newUser: UserProfile | null) => {
    setUserState(newUser);
    if (newUser) {
      localStorage.setItem('user_profile', JSON.stringify(newUser));
    } else {
      localStorage.removeItem('user_profile');
    }
  };

  const setToken = (newToken: string | null) => {
    setTokenState(newToken);
    if (newToken) {
      localStorage.setItem('user_token', newToken);
    } else {
      localStorage.removeItem('user_token');
      localStorage.removeItem('user_profile');
      setCustomers([]);
      setVehicles([]);
      setAudits([]);
      setAlerts([]);
      setTemplates(null);
    }
  };

  const refreshData = async (activeToken?: string | null) => {
    const currentToken = activeToken !== undefined ? activeToken : token;
    if (!currentToken) {
      console.log('[WEB DATA CONTEXT] Skipping data fetch: No token provided.');
      return;
    }
    try {
      const headers = {
        'Authorization': `Bearer ${currentToken}`
      };

      const decoded = decodeToken(currentToken);
      const role = decoded?.role || 'customer';
      const customerId = decoded?.customerId;

      console.log(`[WEB DATA CONTEXT] Fetching data for role: ${role}`);

      if (role === 'admin' || role === 'staff') {
        const [customersRes, vehiclesRes, auditsRes, alertsRes, templatesRes] = await Promise.all([
          fetch(`${BASE_URL}/customers`, { headers }),
          fetch(`${BASE_URL}/vehicles`, { headers }),
          fetch(`${BASE_URL}/audit`, { headers }),
          fetch(`${BASE_URL}/alerts`, { headers }),
          fetch(`${BASE_URL}/reminders/templates`, { headers }),
        ]);

        if (customersRes.ok) {
          const data = await customersRes.json();
          setCustomers(data.map(formatDoc));
        }
        if (vehiclesRes.ok) {
          const data = await vehiclesRes.json();
          setVehicles(data.map(formatDoc));
        }
        if (auditsRes.ok) {
          const data = await auditsRes.json();
          setAudits(data.map((d: any) => ({
            ...formatDoc(d),
            date: d.createdAt ? new Date(d.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : d.date
          })));
        }
        if (alertsRes.ok) {
          const data = await alertsRes.json();
          setAlerts(data.map((d: any) => ({
            ...formatDoc(d),
            date: d.date ? new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : d.date
          })));
        }
        if (templatesRes.ok) {
          const data = await templatesRes.json();
          setTemplates({
            t45: data.t45 || '',
            t30: data.t30 || '',
            t7: data.t7 || ''
          });
        }
      } else {
        // Customer: only fetch their own customer profile and alerts
        const promises = [
          fetch(`${BASE_URL}/alerts`, { headers })
        ];
        if (customerId) {
          promises.push(fetch(`${BASE_URL}/customers/${customerId}`, { headers }));
        }

        const [alertsRes, customerRes] = await Promise.all(promises);

        if (alertsRes && alertsRes.ok) {
          const data = await alertsRes.json();
          setAlerts(data.map((d: any) => ({
            ...formatDoc(d),
            date: d.date ? new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : d.date
          })));
        }
        if (customerRes && customerRes.ok) {
          const customerData = await customerRes.json();
          const mappedCust = formatDoc(customerData);
          setCustomers([mappedCust]);
          setVehicles((customerData.vehicles || []).map(formatDoc));
        }
        setAudits([]); // Clear audits for customer
        setTemplates(null);
      }
    } catch (error) {
      console.error('[WEB DATA CONTEXT] Error fetching backend data:', error);
    }
  };

  useEffect(() => {
    if (token) {
      refreshData();
    }
  }, [token]);

  const addCustomer = async (customerData: Omit<Customer, 'id' | 'createdDate'>): Promise<string> => {
    try {
      const response = await fetch(`${BASE_URL}/customers`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(customerData)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create customer');
      }
      await refreshData();
      const customerObj = data.customer || data;
      return customerObj._id || customerObj.id;
    } catch (error) {
      console.error('[WEB DATA CONTEXT] addCustomer error:', error);
      throw error;
    }
  };

  const addVehicle = async (vehicleData: Omit<Vehicle, 'id'>): Promise<void> => {
    try {
      const response = await fetch(`${BASE_URL}/vehicles`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(vehicleData)
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add vehicle');
      }
      await refreshData();
    } catch (error) {
      console.error('[WEB DATA CONTEXT] addVehicle error:', error);
      throw error;
    }
  };

  const updateVehicleStatus = async (vehicleId: string, status: 'Active' | 'Sold' | 'Scrapped' | 'Pending'): Promise<void> => {
    try {
      const response = await fetch(`${BASE_URL}/vehicles/${vehicleId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update vehicle status');
      }
      await refreshData();
    } catch (error) {
      console.error('[WEB DATA CONTEXT] updateVehicleStatus error:', error);
      throw error;
    }
  };

  const addAlert = async (alertData: Omit<AlertNotification, 'id' | 'status' | 'date'> & { status?: 'Pending' | 'Approved' | 'Acknowledged' | 'Rejected', date?: string }): Promise<void> => {
    try {
      const response = await fetch(`${BASE_URL}/alerts`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(alertData)
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit notification');
      }
      await refreshData();
    } catch (error) {
      console.error('[WEB DATA CONTEXT] addAlert error:', error);
      throw error;
    }
  };

  const approveAlert = async (alertId: string): Promise<void> => {
    try {
      const response = await fetch(`${BASE_URL}/alerts/${alertId}/approve`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to approve notification');
      }
      await refreshData();
    } catch (error) {
      console.error('[WEB DATA CONTEXT] approveAlert error:', error);
      throw error;
    }
  };

  const acknowledgeAlert = async (alertId: string): Promise<void> => {
    try {
      const response = await fetch(`${BASE_URL}/alerts/${alertId}/acknowledge`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to acknowledge notification');
      }
      await refreshData();
    } catch (error) {
      console.error('[WEB DATA CONTEXT] acknowledgeAlert error:', error);
      throw error;
    }
  };

  const rejectAlert = async (alertId: string, reason: string): Promise<void> => {
    try {
      const response = await fetch(`${BASE_URL}/alerts/${alertId}/reject`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reason })
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reject booking request');
      }
      await refreshData();
    } catch (error) {
      console.error('[WEB DATA CONTEXT] rejectAlert error:', error);
      throw error;
    }
  };

  const addAudit = async (activity: string, details: string): Promise<void> => {
    try {
      const response = await fetch(`${BASE_URL}/audit`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ activity, details })
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to log audit activity');
      }
      await refreshData();
    } catch (error) {
      console.error('[WEB DATA CONTEXT] addAudit error:', error);
      throw error;
    }
  };

  const createStaffAccount = async (name: string, email: string, password: string): Promise<void> => {
    try {
      const response = await fetch(`${BASE_URL}/auth/create-staff`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name, email, password })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create staff account');
      }
      await refreshData();
    } catch (error) {
      console.error('[WEB DATA CONTEXT] createStaffAccount error:', error);
      throw error;
    }
  };

  const fetchStaffList = async (): Promise<any[]> => {
    const decoded = decodeToken(token);
    const role = decoded?.role || user?.role || 'customer';
    if (role !== 'admin') {
      console.log('[WEB DATA CONTEXT] Skipping staff list fetch: Insufficient permissions.');
      return [];
    }

    try {
      const response = await fetch(`${BASE_URL}/auth/staff`, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch staff list');
      }
      return data;
    } catch (error) {
      console.error('[WEB DATA CONTEXT] fetchStaffList error:', error);
      throw error;
    }
  };

  const deleteStaffAccount = async (staffId: string): Promise<void> => {
    try {
      const response = await fetch(`${BASE_URL}/auth/staff/${staffId}`, {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete staff account');
      }
    } catch (error) {
      console.error('[WEB DATA CONTEXT] deleteStaffAccount error:', error);
      throw error;
    }
  };

  const rescheduleBooking = async (alertId: string, date: string, slot: string): Promise<void> => {
    try {
      const response = await fetch(`${BASE_URL}/alerts/${alertId}/reschedule`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ date, slot })
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reschedule booking');
      }
      await refreshData();
    } catch (error) {
      console.error('[WEB DATA CONTEXT] rescheduleBooking error:', error);
      throw error;
    }
  };

  const lookupVehicle = async (vrn: string): Promise<any> => {
    try {
      const response = await fetch(`${BASE_URL}/vehicles/dvla/${encodeURIComponent(vrn)}`, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to lookup vehicle');
      }
      return data;
    } catch (error) {
      console.error('[WEB DATA CONTEXT] lookupVehicle error:', error);
      throw error;
    }
  };

  const saveTemplates = async (templatesData: ReminderTemplate): Promise<void> => {
    try {
      const response = await fetch(`${BASE_URL}/reminders/templates`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(templatesData)
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save templates');
      }
      await refreshData();
    } catch (error) {
      console.error('[WEB DATA CONTEXT] saveTemplates error:', error);
      throw error;
    }
  };

  const triggerCronScan = async (): Promise<any> => {
    try {
      const response = await fetch(`${BASE_URL}/reminders/trigger-cron`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to trigger cron scanner');
      }
      await refreshData();
      return data;
    } catch (error) {
      console.error('[WEB DATA CONTEXT] triggerCronScan error:', error);
      throw error;
    }
  };

  const fetchMakes = async (search = ''): Promise<string[]> => {
    try {
      const response = await fetch(`${BASE_URL}/vehicles/makes?limit=100&search=${encodeURIComponent(search)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch makes');
      const data = await response.json();
      return data.makes || [];
    } catch (error) {
      console.error('[WEB DATA CONTEXT] fetchMakes error:', error);
      return [];
    }
  };

  const fetchModels = async (make: string, search = ''): Promise<string[]> => {
    if (!make) return [];
    try {
      const response = await fetch(`${BASE_URL}/vehicles/models?limit=100&make=${encodeURIComponent(make)}&search=${encodeURIComponent(search)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch models');
      const data = await response.json();
      return data.models || [];
    } catch (error) {
      console.error('[WEB DATA CONTEXT] fetchModels error:', error);
      return [];
    }
  };

  return (
    <WebDataContext.Provider
      value={{
        customers,
        vehicles,
        alerts,
        audits,
        templates,
        token,
        setToken,
        user,
        setUser,
        refreshData,
        addCustomer,
        addVehicle,
        updateVehicleStatus,
        addAlert,
        approveAlert,
        acknowledgeAlert,
        rejectAlert,
        addAudit,
        createStaffAccount,
        fetchStaffList,
        deleteStaffAccount,
        rescheduleBooking,
        lookupVehicle,
        saveTemplates,
        triggerCronScan,
        fetchMakes,
        fetchModels
      }}
    >
      {children}
    </WebDataContext.Provider>
  );
};

export const useWebData = () => {
  const context = useContext(WebDataContext);
  if (!context) {
    throw new Error('useWebData must be used within a WebDataProvider');
  }
  return context;
};
