import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Coordinates, requestUserLiveLocation, isWithinUKBoundary } from '../utils/mapUtils';
import { resetToLogin } from '../navigation/NavigationService';

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
  garageId?: string;
  garageIds?: string[];
  garageConsent?: boolean;
  garageConsentDate?: string;
}

export interface Vehicle {
  id: string;
  _id?: string;
  customerId: string;
  registrationNumber: string;
  make: string;
  model: string;
  year: string;
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
  customerEmail?: string;
  customerMobile?: string;
  registrationNumber: string;
  makeModel: string;
  date: string;
  status: 'Pending' | 'Approved' | 'Acknowledged' | 'Rejected' | 'Completed' | 'Cancelled';
  rejectionReason?: string;
  garageId?: string;
  garageName?: string;
  garageAddress?: string;
  garageCity?: string;
  garagePostcode?: string;
  garagePhone?: string;
  garageEmail?: string;
  garageLatitude?: number | string;
  garageLongitude?: number | string;
  garage?: any;
  serviceName?: string;
  services?: { name: string; category?: string; price: number; duration?: number }[];
  hasMot?: boolean;
  isDateOnly?: boolean;
  price?: number;
  duration?: number;
  slotTime?: string;
  slotNumber?: number;
  stationId?: string;
  stationName?: string;
  rescheduled?: boolean;
  cancellationReason?: string;
  cancelledBy?: string;
  cancelledAt?: string;
}

export interface AuditLog {
  id: string;
  date: string;
  activity: string;
  details: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'garage_admin' | 'staff' | 'customer';
  customerId?: string;
  garageId?: string;
}

export interface DynamicService {
  id: string;
  _id?: string;
  name: string;
  title: string;
  category: string;
  price: number;
  minPrice?: number;
  maxPrice?: number;
  garageCount?: number;
  duration?: number;
  icon: string;
  iconBg: string;
  iconColor: string;
  searchQuery: string;
  description?: string;
  isActive?: boolean;
  isFromGarage?: boolean;
}

export interface ServiceCategory {
  id?: string;
  _id?: string;
  name: string;
  description?: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  sortOrder?: number;
  isActive?: boolean;
  isDefault?: boolean;
}

interface DataContextType {
  customers: Customer[];
  vehicles: Vehicle[];
  alerts: AlertNotification[];
  audits: AuditLog[];
  token: string | null;
  refreshToken: string | null;
  setToken: (token: string | null) => void;
  setRefreshToken: (token: string | null) => void;
  setTokens: (accessToken: string | null, refreshToken: string | null) => void;
  refreshAccessToken: () => Promise<string | null>;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  logout: () => Promise<void>;
  user: UserProfile | null;
  setUser: (user: UserProfile | null) => void;
  refreshData: () => Promise<void>;
  addCustomer: (customer: Omit<Customer, 'id' | 'createdDate'>) => Promise<string>;
  addVehicle: (vehicle: Omit<Vehicle, 'id'>) => Promise<any>;
  updateVehicleStatus: (vehicleId: string, status: 'Active' | 'Sold' | 'Scrapped' | 'Pending') => Promise<void>;
  addAlert: (alert: Omit<AlertNotification, 'id' | 'status' | 'date'> & { status?: 'Pending' | 'Approved' | 'Acknowledged' | 'Rejected' | 'Completed' | 'Cancelled', date?: string, registrationNumber?: string, makeModel?: string }) => Promise<void>;
  approveAlert: (alertId: string) => Promise<void>;
  acknowledgeAlert: (alertId: string) => Promise<void>;
  rejectAlert: (alertId: string, reason: string) => Promise<void>;
  addAudit: (activity: string, details: string) => Promise<void>;
  createStaffAccount: (name: string, email: string, password: string) => Promise<void>;
  fetchStaffList: () => Promise<any[]>;
  deleteStaffAccount: (staffId: string) => Promise<void>;
  rescheduleBooking: (alertId: string, date: string, slot: string) => Promise<void>;
  cancelBooking: (alertId: string, reason?: string) => Promise<void>;
  lookupVehicle: (vrn: string) => Promise<any>;
  userLocation: Coordinates | null;
  setUserLocation: (coords: Coordinates | null) => Promise<void>;
  isOutsideUK: boolean;
  refreshLocation: () => Promise<Coordinates | null>;
  services: DynamicService[];
  fetchServices: () => Promise<DynamicService[]>;
  serviceCategories: ServiceCategory[];
  fetchServiceCategories: () => Promise<ServiceCategory[]>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const BASE_URL = 'https://api.ondoorcarservice.com/api';

const decodeToken = (tokenStr: string | null) => {
  if (!tokenStr) return null;
  try {
    const parts = tokenStr.split('.');
    if (parts.length < 2) return null;
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let str = '';
    for (let i = 0; i < base64.length; i += 4) {
      const enc1 = chars.indexOf(base64.charAt(i));
      const enc2 = chars.indexOf(base64.charAt(i + 1));
      const enc3 = chars.indexOf(base64.charAt(i + 2));
      const enc4 = chars.indexOf(base64.charAt(i + 3));
      if (enc1 === -1 || enc2 === -1) break;
      const chr1 = (enc1 << 2) | (enc2 >> 4);
      str += String.fromCharCode(chr1);
      if (enc3 !== 64 && enc3 !== -1) {
        const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
        str += String.fromCharCode(chr2);
      }
      if (enc4 !== 64 && enc4 !== -1) {
        const chr3 = ((enc3 & 3) << 6) | enc4;
        str += String.fromCharCode(chr3);
      }
    }
    return JSON.parse(str);
  } catch (error) {
    console.error('[DATA CONTEXT] Error decoding token:', error);
    return null;
  }
};

const isTokenExpired = (tokenStr: string | null): boolean => {
  if (!tokenStr) return true;
  const decoded = decodeToken(tokenStr);
  if (!decoded || !decoded.exp) return false;
  // Buffer by 30 seconds
  return decoded.exp * 1000 < (Date.now() + 30000);
};
 
export const DataProvider = ({ children }: { children: ReactNode }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [alerts, setAlerts] = useState<AlertNotification[]>([]);
  const [audits, setAudits] = useState<AuditLog[]>([]);
  const [token, setTokenState] = useState<string | null>(null);
  const [refreshToken, setRefreshTokenState] = useState<string | null>(null);
  const [user, setUserState] = useState<UserProfile | null>(null);
  const [userLocation, setUserLocationState] = useState<Coordinates | null>(null);
  const [services, setServices] = useState<DynamicService[]>([]);
  const [serviceCategories, setServiceCategories] = useState<ServiceCategory[]>([]);

  const fetchServiceCategories = async (): Promise<ServiceCategory[]> => {
    try {
      const res = await fetch(`${BASE_URL}/service-categories`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data.categories) ? data.categories : [];
        if (list.length > 0) {
          setServiceCategories(list);
          return list;
        }
      }
    } catch (e) {
      console.log('[DATA CONTEXT] Error fetching service categories:', e);
    }
    return serviceCategories;
  };

  const fetchServices = async (): Promise<DynamicService[]> => {
    try {
      const res = await fetch(`${BASE_URL}/services`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.services || []);
        if (list.length > 0) {
          const mapped: DynamicService[] = list.map((s: any) => ({
            id: (s._id || s.id || s.name).toString(),
            _id: s._id,
            name: s.name || s.title,
            title: s.title || s.name,
            category: s.category || 'Servicing',
            price: s.price !== undefined ? Number(s.price) : 45,
            minPrice: s.minPrice !== undefined ? Number(s.minPrice) : (s.price !== undefined ? Number(s.price) : 45),
            maxPrice: s.maxPrice !== undefined ? Number(s.maxPrice) : undefined,
            garageCount: s.garageCount !== undefined ? Number(s.garageCount) : undefined,
            duration: s.duration || 45,
            icon: s.icon || 'wrench',
            iconBg: s.iconBg || '#1677FF15',
            iconColor: s.iconColor || '#1677FF',
            searchQuery: s.searchQuery || s.title || s.name,
            description: s.description || '',
            isActive: s.isActive !== false,
            isFromGarage: s.isFromGarage,
          }));
          setServices(mapped);
          return mapped;
        }
      }
    } catch (e) {
      console.log('[DATA CONTEXT] Error fetching dynamic services:', e);
    }
    return [];
  };

  const setUserLocation = async (coords: Coordinates | null) => {
    setUserLocationState(coords);
    try {
      if (coords) {
        await AsyncStorage.setItem('@user_selected_location', JSON.stringify(coords));
      } else {
        await AsyncStorage.removeItem('@user_selected_location');
      }
    } catch (e) {
      console.error('[DATA CONTEXT] Error saving user location:', e);
    }
  };

  const refreshLocation = async (): Promise<Coordinates | null> => {
    try {
      const coords = await requestUserLiveLocation();
      if (coords) {
        await setUserLocation(coords);
        return coords;
      }
    } catch (e) {
      console.error('[DATA CONTEXT] Error refreshing user live location:', e);
    }
    return null;
  };

  const isOutsideUK = userLocation ? !isWithinUKBoundary(userLocation) : false;

  const setUser = (newUser: UserProfile | null) => {
    setUserState(newUser);
    if (newUser) {
      AsyncStorage.setItem('user_profile', JSON.stringify(newUser)).catch(err => console.error(err));
    } else {
      AsyncStorage.removeItem('user_profile').catch(err => console.error(err));
    }
  };
  const setRefreshToken = useCallback((newRefreshToken: string | null) => {
    setRefreshTokenState(newRefreshToken);
    if (newRefreshToken) {
      AsyncStorage.setItem('user_refresh_token', newRefreshToken).catch(err => console.error(err));
    } else {
      AsyncStorage.removeItem('user_refresh_token').catch(err => console.error(err));
    }
  }, []);

  const setToken = useCallback((newToken: string | null) => {
    setTokenState(newToken);
    if (newToken) {
      AsyncStorage.setItem('user_token', newToken).catch(err => console.error(err));
    } else {
      AsyncStorage.removeItem('user_token').catch(err => console.error(err));
      AsyncStorage.removeItem('user_refresh_token').catch(err => console.error(err));
      AsyncStorage.removeItem('user_profile').catch(err => console.error(err));
      AsyncStorage.removeItem('@cached_vehicles').catch(err => console.error(err));
      AsyncStorage.removeItem('@cached_alerts').catch(err => console.error(err));
      AsyncStorage.removeItem('@cached_customers').catch(err => console.error(err));
      setRefreshTokenState(null);
      setUserState(null);
      setCustomers([]);
      setVehicles([]);
      setAudits([]);
      setAlerts([]);
    }
  }, []);

  const setTokens = useCallback((newToken: string | null, newRefreshToken: string | null) => {
    setTokenState(newToken);
    setRefreshTokenState(newRefreshToken);
    if (newToken) {
      AsyncStorage.setItem('user_token', newToken).catch(err => console.error(err));
    } else {
      AsyncStorage.removeItem('user_token').catch(err => console.error(err));
    }
    if (newRefreshToken) {
      AsyncStorage.setItem('user_refresh_token', newRefreshToken).catch(err => console.error(err));
    } else {
      AsyncStorage.removeItem('user_refresh_token').catch(err => console.error(err));
    }
    if (!newToken && !newRefreshToken) {
      AsyncStorage.removeItem('user_profile').catch(err => console.error(err));
      AsyncStorage.removeItem('@cached_vehicles').catch(err => console.error(err));
      AsyncStorage.removeItem('@cached_alerts').catch(err => console.error(err));
      AsyncStorage.removeItem('@cached_customers').catch(err => console.error(err));
      setUserState(null);
      setCustomers([]);
      setVehicles([]);
      setAudits([]);
      setAlerts([]);
    }
  }, []);

  // Mutex/singleton to prevent multiple concurrent refresh calls
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

  const handleSessionExpired = useCallback(() => {
    console.warn('[AUTH] Session expired. Clearing session and navigating to login.');
    setTokens(null, null);
    setUserState(null);
    resetToLogin();
    Alert.alert(
      'Session Expired',
      'Your session has expired. Please log in again to continue.'
    );
  }, [setTokens]);

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const refreshTask = (async (): Promise<string | null> => {
      try {
        let currentRefreshToken = refreshToken;
        if (!currentRefreshToken) {
          currentRefreshToken = await AsyncStorage.getItem('user_refresh_token');
        }

        if (!currentRefreshToken) {
          console.warn('[AUTH] No refresh token found. Cannot refresh session.');
          return null;
        }

        console.log('[AUTH] Calling refresh token endpoint...');
        const res = await fetch(`${BASE_URL}/auth/refresh-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: currentRefreshToken })
        });

        const data = await res.json();
        if (res.ok && (data.accessToken || data.token)) {
          const newAccessToken = data.accessToken || data.token;
          const newRefreshToken = data.refreshToken || currentRefreshToken;

          console.log('[AUTH] Access token refreshed successfully.');
          setTokens(newAccessToken, newRefreshToken);
          if (data.user) {
            setUserState(prev => ({ ...prev, ...data.user }));
            AsyncStorage.setItem('user_profile', JSON.stringify(data.user)).catch(e => console.error(e));
          }
          return newAccessToken;
        } else {
          console.warn('[AUTH] Refresh token rejected by server:', data.error);
          return null;
        }
      } catch (err) {
        console.error('[AUTH] Exception while refreshing token:', err);
        return null;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = refreshTask;
    return refreshTask;
  }, [refreshToken, setTokens]);

  const authFetch = useCallback(async (url: string, options: RequestInit = {}): Promise<Response> => {
    const rawHeaders: Record<string, string> = {};
    if (options.headers) {
      if (options.headers instanceof Headers) {
        options.headers.forEach((value, key) => { rawHeaders[key] = value; });
      } else if (Array.isArray(options.headers)) {
        options.headers.forEach(([k, v]) => { rawHeaders[k] = v; });
      } else {
        Object.assign(rawHeaders, options.headers);
      }
    }

    let activeToken = token;
    if (!activeToken) {
      activeToken = await AsyncStorage.getItem('user_token');
    }

    if (activeToken && !rawHeaders['Authorization']) {
      rawHeaders['Authorization'] = `Bearer ${activeToken}`;
    }

    let response = await fetch(url, { ...options, headers: rawHeaders });

    if (response.status === 401) {
      console.log(`[AUTH] 401 Unauthorized for ${url}. Attempting access token refresh...`);
      const newAccessToken = await refreshAccessToken();
      if (newAccessToken) {
        rawHeaders['Authorization'] = `Bearer ${newAccessToken}`;
        response = await fetch(url, { ...options, headers: rawHeaders });
      } else {
        console.warn(`[AUTH] Failed to refresh token for ${url}. Triggering session expiration.`);
        handleSessionExpired();
      }
    }

    return response;
  }, [token, refreshAccessToken, handleSessionExpired]);

  const logout = useCallback(async () => {
    try {
      const activeRefreshToken = refreshToken || await AsyncStorage.getItem('user_refresh_token');
      if (activeRefreshToken) {
        await fetch(`${BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: activeRefreshToken })
        }).catch(err => console.warn('Logout request warning:', err));
      }
    } finally {
      setTokens(null, null);
      setUserState(null);
      resetToLogin();
    }
  }, [refreshToken, setTokens]);

  const refreshData = async (activeToken?: string | null) => {
    let currentToken = activeToken !== undefined ? activeToken : token;
    if (!currentToken) {
      currentToken = await AsyncStorage.getItem('user_token');
    }
    const currentRefreshToken = refreshToken || await AsyncStorage.getItem('user_refresh_token');

    if (!currentToken && !currentRefreshToken) {
      console.log('[DATA CONTEXT] Skipping data fetch: No token or refresh token available.');
      return;
    }

    try {
      console.log(`[DATA CONTEXT] Fetching data from: ${BASE_URL}`);

      const decoded = currentToken ? decodeToken(currentToken) : null;
      const role = decoded?.role || user?.role || 'customer';
      let customerId = decoded?.customerId || user?.customerId;

      // Fallback: If customerId is not in token or user state, attempt to load from stored user
      if (!customerId && role === 'customer') {
        try {
          const storedUser = await AsyncStorage.getItem('user_profile');
          if (storedUser) {
            const parsed = JSON.parse(storedUser);
            if (parsed?.customerId) customerId = parsed.customerId;
          }
        } catch (_) {}
      }

      console.log(`[DATA CONTEXT] Fetching data for role: ${role}, customerId: ${customerId}`);

      if (role === 'admin' || role === 'staff') {
        const [customersRes, vehiclesRes, auditsRes, alertsRes] = await Promise.all([
          authFetch(`${BASE_URL}/customers`),
          authFetch(`${BASE_URL}/vehicles`),
          authFetch(`${BASE_URL}/audit`),
          authFetch(`${BASE_URL}/alerts`),
        ]);

        if (customersRes.ok) {
          const customersData = await customersRes.json();
          setCustomers(customersData);
          AsyncStorage.setItem('@cached_customers', JSON.stringify(customersData)).catch(() => {});
        }
        if (vehiclesRes.ok) {
          const vehiclesData = await vehiclesRes.json();
          setVehicles(vehiclesData);
          AsyncStorage.setItem('@cached_vehicles', JSON.stringify(vehiclesData)).catch(() => {});
        }
        if (auditsRes.ok) {
          const auditsData = await auditsRes.json();
          setAudits(auditsData);
        }
        if (alertsRes.ok) {
          const alertsData = await alertsRes.json();
          setAlerts(alertsData);
          AsyncStorage.setItem('@cached_alerts', JSON.stringify(alertsData)).catch(() => {});
        }
      } else {
        // Customer: fetch alerts and customer profile (which includes vehicles)
        const promises: Promise<Response>[] = [
          authFetch(`${BASE_URL}/alerts`)
        ];

        if (customerId) {
          promises.push(authFetch(`${BASE_URL}/customers/${customerId}`));
        } else {
          // If customerId is unknown, fetch all customers matching current token
          promises.push(authFetch(`${BASE_URL}/customers`));
        }

        const [alertsRes, customerRes] = await Promise.all(promises);

        if (alertsRes && alertsRes.ok) {
          const alertsData = await alertsRes.json();
          const list = Array.isArray(alertsData) ? alertsData : [];
          setAlerts(list);
          AsyncStorage.setItem('@cached_alerts', JSON.stringify(list)).catch(() => {});
        }

        if (customerRes) {
          if (customerRes.ok) {
            const customerData = await customerRes.json();
            if (Array.isArray(customerData)) {
              if (customerData.length > 0) {
                const singleCust = customerData[0];
                setCustomers([singleCust]);
                setVehicles(singleCust.vehicles || []);
                AsyncStorage.setItem('@cached_customers', JSON.stringify([singleCust])).catch(() => {});
                AsyncStorage.setItem('@cached_vehicles', JSON.stringify(singleCust.vehicles || [])).catch(() => {});
              }
            } else {
              setCustomers([customerData]);
              setVehicles(customerData.vehicles || []);
              AsyncStorage.setItem('@cached_customers', JSON.stringify([customerData])).catch(() => {});
              AsyncStorage.setItem('@cached_vehicles', JSON.stringify(customerData.vehicles || [])).catch(() => {});
            }
          } else if (customerRes.status === 404) {
            console.log('[DATA CONTEXT] Customer profile not found.');
          }
        }
        setAudits([]); // Clear audits for customer
      }

      // Fetch dynamic services
      await fetchServices();
    } catch (error) {
      console.error('[DATA CONTEXT] Error fetching backend data:', error);
    }
  };

  useEffect(() => {
    const loadStoredAuth = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('user_token');
        const storedRefreshToken = await AsyncStorage.getItem('user_refresh_token');
        const storedUserJson = await AsyncStorage.getItem('user_profile');
        const cachedVehiclesJson = await AsyncStorage.getItem('@cached_vehicles');
        const cachedAlertsJson = await AsyncStorage.getItem('@cached_alerts');
        const cachedCustomersJson = await AsyncStorage.getItem('@cached_customers');

        // Immediately restore cached data so user sees bookings & vehicles instantly on app launch
        if (cachedVehiclesJson) {
          try {
            const parsedVehs = JSON.parse(cachedVehiclesJson);
            if (Array.isArray(parsedVehs)) setVehicles(parsedVehs);
          } catch (_) {}
        }
        if (cachedAlertsJson) {
          try {
            const parsedAlerts = JSON.parse(cachedAlertsJson);
            if (Array.isArray(parsedAlerts)) setAlerts(parsedAlerts);
          } catch (_) {}
        }
        if (cachedCustomersJson) {
          try {
            const parsedCusts = JSON.parse(cachedCustomersJson);
            if (Array.isArray(parsedCusts)) setCustomers(parsedCusts);
          } catch (_) {}
        }

        if (storedRefreshToken) {
          if (storedToken && !isTokenExpired(storedToken)) {
            setTokenState(storedToken);
            setRefreshTokenState(storedRefreshToken);
            if (storedUserJson) {
              setUserState(JSON.parse(storedUserJson));
            }
            refreshData(storedToken);
          } else {
            console.log('[DATA CONTEXT] Stored token expired/absent. Refreshing session...');
            try {
              const refRes = await fetch(`${BASE_URL}/auth/refresh-token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken: storedRefreshToken })
              });
              if (refRes.ok) {
                const refData = await refRes.json();
                const newAccess = refData.accessToken || refData.token;
                const newRefresh = refData.refreshToken || storedRefreshToken;
                setTokens(newAccess, newRefresh);
                if (refData.user) {
                  setUserState(refData.user);
                  AsyncStorage.setItem('user_profile', JSON.stringify(refData.user)).catch(e => console.error(e));
                }
                refreshData(newAccess);
              } else {
                console.warn('[DATA CONTEXT] Stored refresh token is expired or invalid. Clearing session.');
                setTokens(null, null);
              }
            } catch (refErr) {
              console.warn('[DATA CONTEXT] Network error refreshing token on launch:', refErr);
            }
          }
        } else if (storedToken && !isTokenExpired(storedToken)) {
          setTokenState(storedToken);
          if (storedUserJson) {
            setUserState(JSON.parse(storedUserJson));
          }
          refreshData(storedToken);
        }
      } catch (err) {
        console.error('[DATA CONTEXT] Error loading stored auth details:', err);
      }
    };

    fetchServices();

    const loadStoredLocation = async () => {
      try {
        const savedLoc = await AsyncStorage.getItem('@user_selected_location');
        if (savedLoc) {
          const parsed = JSON.parse(savedLoc);
          if (parsed && typeof parsed.latitude === 'number') {
            setUserLocationState(parsed);
            return;
          }
        }
      } catch (err) {
        console.error('[DATA CONTEXT] Error loading stored location:', err);
      }

      // If no stored location, detect live location in background
      try {
        const live = await requestUserLiveLocation();
        if (live) {
          setUserLocationState(live);
        }
      } catch (err) {
        console.error('[DATA CONTEXT] Error detecting initial live location:', err);
      }
    };

    loadStoredAuth();
    loadStoredLocation();
  }, []);

  useEffect(() => {
    if (token) {
      refreshData();
    }
  }, [token]);

  const addCustomer = async (customerData: Omit<Customer, 'id' | 'createdDate'>): Promise<string> => {
    try {
      const response = await authFetch(`${BASE_URL}/customers`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(customerData)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create customer');
      }
      await refreshData();
      return data.customer?.id || data.customer?._id || data.id || data._id || `c_${Date.now()}`;
    } catch (error) {
      console.error('[DATA CONTEXT] addCustomer error:', error);
      throw error;
    }
  };

  const addVehicle = async (vehicleData: Omit<Vehicle, 'id'>): Promise<any> => {
    try {
      if (!token && !refreshToken) {
        throw new Error('Please sign in to your account to add a vehicle.');
      }
      const response = await authFetch(`${BASE_URL}/vehicles`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(vehicleData)
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401 || (data.error && (data.error.toLowerCase().includes('token') || data.error.toLowerCase().includes('auth')))) {
          throw new Error('Please sign in to your account to add a vehicle.');
        }
        throw new Error(data.error || 'Failed to add vehicle');
      }
      await refreshData();
      return data.vehicle;
    } catch (error) {
      console.error('[DATA CONTEXT] addVehicle error:', error);
      throw error;
    }
  };

  const updateVehicleStatus = async (vehicleId: string, status: 'Active' | 'Sold' | 'Scrapped' | 'Pending'): Promise<void> => {
    try {
      const response = await authFetch(`${BASE_URL}/vehicles/${vehicleId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update vehicle status');
      }
      await refreshData();
    } catch (error) {
      console.error('[DATA CONTEXT] updateVehicleStatus error:', error);
      throw error;
    }
  };

  const addAlert = async (alertData: Omit<AlertNotification, 'id' | 'status' | 'date'> & { status?: 'Pending' | 'Approved' | 'Acknowledged' | 'Rejected' | 'Completed' | 'Cancelled', date?: string, registrationNumber?: string, makeModel?: string }): Promise<void> => {
    try {
      const response = await authFetch(`${BASE_URL}/alerts`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(alertData)
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit notification');
      }
      await refreshData();
    } catch (error) {
      console.error('[DATA CONTEXT] addAlert error:', error);
      throw error;
    }
  };

  const approveAlert = async (alertId: string): Promise<void> => {
    try {
      const response = await authFetch(`${BASE_URL}/alerts/${alertId}/approve`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to approve notification');
      }
      await refreshData();
    } catch (error) {
      console.error('[DATA CONTEXT] approveAlert error:', error);
      throw error;
    }
  };

  const acknowledgeAlert = async (alertId: string): Promise<void> => {
    try {
      const response = await authFetch(`${BASE_URL}/alerts/${alertId}/acknowledge`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to acknowledge notification');
      }
      await refreshData();
    } catch (error) {
      console.error('[DATA CONTEXT] acknowledgeAlert error:', error);
      throw error;
    }
  };

  const addAudit = async (activity: string, details: string): Promise<void> => {
    try {
      const response = await authFetch(`${BASE_URL}/audit`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ activity, details })
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to log audit activity');
      }
      await refreshData();
    } catch (error) {
      console.error('[DATA CONTEXT] addAudit error:', error);
      throw error;
    }
  };

  const createStaffAccount = async (name: string, email: string, password: string): Promise<void> => {
    try {
      const response = await authFetch(`${BASE_URL}/auth/create-staff`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, email, password })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create staff account');
      }
      await refreshData();
    } catch (error) {
      console.error('[DATA CONTEXT] createStaffAccount error:', error);
      throw error;
    }
  };

  const fetchStaffList = async (): Promise<any[]> => {
    const decoded = decodeToken(token);
    const role = decoded?.role || user?.role || 'customer';
    if (role !== 'admin') {
      console.log('[DATA CONTEXT] Skipping staff list fetch: Insufficient permissions (role is not admin).');
      return [];
    }

    try {
      const response = await authFetch(`${BASE_URL}/auth/staff`, {
        method: 'GET'
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch staff list');
      }
      return data;
    } catch (error) {
      console.error('[DATA CONTEXT] fetchStaffList error:', error);
      throw error;
    }
  };

  const deleteStaffAccount = async (staffId: string): Promise<void> => {
    try {
      const response = await authFetch(`${BASE_URL}/auth/staff/${staffId}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete staff account');
      }
    } catch (error) {
      console.error('[DATA CONTEXT] deleteStaffAccount error:', error);
      throw error;
    }
  };

  const rescheduleBooking = async (alertId: string, date: string, slot: string): Promise<void> => {
    try {
      const response = await authFetch(`${BASE_URL}/alerts/${alertId}/reschedule`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ date, slot })
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reschedule booking');
      }
      await refreshData();
    } catch (error) {
      console.error('[DATA CONTEXT] rescheduleBooking error:', error);
      throw error;
    }
  };

  const cancelBooking = async (alertId: string, reason?: string): Promise<void> => {
    try {
      const response = await authFetch(`${BASE_URL}/alerts/${alertId}/cancel`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: reason || '' })
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to cancel booking');
      }
      await refreshData();
    } catch (error) {
      console.error('[DATA CONTEXT] cancelBooking error:', error);
      throw error;
    }
  };

  const rejectAlert = async (alertId: string, reason: string): Promise<void> => {
    try {
      const response = await authFetch(`${BASE_URL}/alerts/${alertId}/reject`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reject booking request');
      }
      await refreshData();
    } catch (error) {
      console.error('[DATA CONTEXT] rejectAlert error:', error);
      throw error;
    }
  };

  const lookupVehicle = async (vrn: string): Promise<any> => {
    let timeoutId: any = null;
    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 12000);

      const response = await fetch(`${BASE_URL}/vehicles/dvla/${encodeURIComponent(vrn)}`, {
        method: 'GET',
        headers,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      let data: any = {};
      try {
        data = await response.json();
      } catch (jsonErr) {
        // If server returned non-JSON (like 502/503/504 HTML error page)
        const busyErr: any = new Error('Government DVSA API is busy, please check again.');
        busyErr.isBusy = true;
        throw busyErr;
      }

      if (!response.ok) {
        // 404 Not Found or explicit VRN invalid -> Vehicle genuinely not found in DVSA registry
        if (
          response.status === 404 ||
          (response.status === 400 && data.error && (
            data.error.toLowerCase().includes('not found') ||
            data.error.toLowerCase().includes('invalid uk registration') ||
            data.error.toLowerCase().includes('invalid')
          ))
        ) {
          const notFoundErr: any = new Error('Vehicle details not found. Please check the registration plate and try again.');
          notFoundErr.isNotFound = true;
          throw notFoundErr;
        }

        // ANY 5xx status (500, 502, 503, 504) or DVSA/busy/unavailable error message -> DVSA is busy
        if (
          response.status >= 500 ||
          (data.error && (
            data.error.toLowerCase().includes('busy') ||
            data.error.toLowerCase().includes('dvsa') ||
            data.error.toLowerCase().includes('unavailable') ||
            data.error.toLowerCase().includes('timeout') ||
            data.error.toLowerCase().includes('temporarily')
          ))
        ) {
          const busyErr: any = new Error('Government DVSA API is busy, please check again.');
          busyErr.isBusy = true;
          throw busyErr;
        }

        const notFoundErr: any = new Error(data.error || 'Vehicle details not found. Please check the registration plate and try again.');
        notFoundErr.isNotFound = true;
        throw notFoundErr;
      }
      return data;
    } catch (error: any) {
      if (timeoutId) clearTimeout(timeoutId);
      console.error('[DATA CONTEXT] lookupVehicle error:', error);
      if (error.isNotFound || error.isBusy) {
        throw error;
      }

      const errMsg = (error?.message || '').toLowerCase();
      const errName = (error?.name || '').toLowerCase();
      const isNetworkFailure =
        errName === 'aborterror' ||
        errMsg.includes('network request failed') ||
        errMsg.includes('network') ||
        errMsg.includes('timeout') ||
        errMsg.includes('timed out') ||
        errMsg.includes('socket') ||
        errMsg.includes('connection') ||
        errMsg.includes('connect') ||
        errMsg.includes('fetch') ||
        errMsg.includes('offline') ||
        errMsg.includes('abort') ||
        errMsg.includes('failed to fetch') ||
        errMsg.includes('econnrefused') ||
        errMsg.includes('etimedout') ||
        errMsg.includes('json');

      if (isNetworkFailure) {
        const busyErr: any = new Error('Government DVSA API is busy, please check again.');
        busyErr.isBusy = true;
        throw busyErr;
      }

      // Default safe fallback for DVSA live lookup failures
      const busyErr: any = new Error('Government DVSA API is busy, please check again.');
      busyErr.isBusy = true;
      throw busyErr;
    }
  };

  return (
    <DataContext.Provider
      value={{
        customers,
        vehicles,
        alerts,
        audits,
        token,
        refreshToken,
        setToken,
        setRefreshToken,
        setTokens,
        refreshAccessToken,
        authFetch,
        logout,
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
        cancelBooking,
        lookupVehicle,
        userLocation,
        setUserLocation,
        isOutsideUK,
        refreshLocation,
        services,
        fetchServices,
        serviceCategories,
        fetchServiceCategories,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useAppValues = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useAppValues must be used within a DataProvider');
  }
  return context;
};
