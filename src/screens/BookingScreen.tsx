import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Toast from 'react-native-toast-message';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues, BASE_URL } from '../context/DataContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { validateNewVehicleForm } from '../utils/validationUtils';
import { fonts } from '../theme/theme';

export default function BookingScreen({ route, navigation }: any) {
  const { theme } = useAppTheme();
  const { customers, vehicles, alerts, addAlert, addAudit, addVehicle, lookupVehicle, user, token, cancelBooking, rescheduleBooking, authFetch } = useAppValues();

  // Find active customer
  const customerId = user?.customerId || (customers.length > 0 ? (customers[0].id || customers[0]._id) : user?.id) || '';

  // Find active customer vehicles
  const activeCustomerVehicles = vehicles.filter(v => 
    v.customerId && (
      String(v.customerId).toLowerCase() === String(customerId).toLowerCase()
    ) && v.status !== 'Sold' && v.status !== 'Scrapped'
  );

  const isReschedule = route?.params?.isReschedule || false;

  const getDaysUntilExpiry = (expiryDateStr?: string) => {
    if (!expiryDateStr) return -1;
    const expiryDate = new Date(expiryDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = expiryDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Inline Add Vehicle states
  const [showAddCarForm, setShowAddCarForm] = useState(false);
  const [newRegNo, setNewRegNo] = useState('');
  const [newMake, setNewMake] = useState('');
  const [newModel, setNewModel] = useState('');
  const [newYear, setNewYear] = useState('');
  const [newExpiry, setNewExpiry] = useState('');
  // Per-field errors from the last Save attempt - drives the red borders on the add-vehicle form
  const [newCarErrors, setNewCarErrors] = useState<Record<string, string>>({});
  const clearNewCarError = (field: string) =>
    setNewCarErrors(prev => (prev[field] ? { ...prev, [field]: '' } : prev));
  useEffect(() => {
    if (!showAddCarForm) setNewCarErrors({});
  }, [showAddCarForm]);
  const [isSearchingNewPlate, setIsSearchingNewPlate] = useState(false);
  const [newLookupInfo, setNewLookupInfo] = useState<string | null>(null);
  const [isAddingCar, setIsAddingCar] = useState(false);

  // Selected vehicle state
  const [selectedVehicle, setSelectedVehicle] = useState<any>(
    route?.params?.vehicle || activeCustomerVehicles[0] || null
  );

  // Active booking alert if rescheduling
  const activeBookingAlert = React.useMemo(() => {
    if (route?.params?.activeBooking) return route.params.activeBooking;
    if (!isReschedule || !selectedVehicle?.registrationNumber) return null;
    return alerts.find(a => 
      a.type === 'BOOKED' && 
      a.registrationNumber?.toUpperCase() === selectedVehicle?.registrationNumber?.toUpperCase() &&
      (a.status === 'Pending' || a.status === 'Approved')
    ) || null;
  }, [isReschedule, selectedVehicle?.registrationNumber, alerts, route?.params?.activeBooking]);

  const alertAny = activeBookingAlert as any;
  const targetGarageId = route?.params?.garageId || 
    (typeof alertAny?.garageId === 'object' ? (alertAny?.garageId?._id || alertAny?.garageId?.id) : alertAny?.garageId) || 
    alertAny?.garage?._id || 
    alertAny?.garage?.id || 
    null;

  const targetGarageName = route?.params?.garageName || 
    alertAny?.garageName || 
    alertAny?.stationName || 
    (typeof alertAny?.garageId === 'object' ? alertAny?.garageId?.name : null) || 
    alertAny?.garage?.name || 
    '';

  // Existing booked details if rescheduling
  const bookedDateRaw = route?.params?.bookedDate || alertAny?.date;
  const bookedDateFormatted = React.useMemo(() => {
    if (!bookedDateRaw) return null;
    const d = new Date(bookedDateRaw);
    if (isNaN(d.getTime())) return null;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, [bookedDateRaw]);

  const bookedSlotTime = route?.params?.slotTime || 
    alertAny?.slotTime || 
    (alertAny?.makeModel && alertAny.makeModel.includes(' - Slot: ') ? alertAny.makeModel.split(' - Slot: ')[1] : null) || 
    null;

  const bookedSlotNumber = route?.params?.slotNumber || alertAny?.slotNumber || null;

  // Garages list & selected garage state
  const [garages, setGarages] = useState<any[]>([]);
  const [loadingGarages, setLoadingGarages] = useState(false);
  const [selectedGarage, setSelectedGarage] = useState<any>(
    isReschedule
      ? (targetGarageId || targetGarageName ? { id: targetGarageId, _id: targetGarageId, name: targetGarageName || 'Garage' } : null)
      : null
  );

  // Selected services state with multi-service support
  const initialServices = React.useMemo(() => {
    if (Array.isArray(route?.params?.selectedServices) && route.params.selectedServices.length > 0) {
      return route.params.selectedServices;
    }
    if (Array.isArray(route?.params?.services) && route.params.services.length > 0) {
      return route.params.services;
    }
    if (Array.isArray(alertAny?.services) && alertAny.services.length > 0) {
      return alertAny.services;
    }
    return [{
      name: route?.params?.serviceName || alertAny?.serviceName || 'Vehicle Service',
      price: route?.params?.price !== undefined ? route.params.price : (alertAny?.price !== undefined ? alertAny.price : 45.00),
      duration: route?.params?.duration || alertAny?.duration || 45,
      category: route?.params?.category || alertAny?.serviceCategory || 'Servicing',
    }];
  }, [route?.params, alertAny]);

  const [selectedServices, setSelectedServices] = useState<any[]>(initialServices);
  const selectedService = selectedServices[0] || null;

  const toggleSelectService = (svc: any) => {
    setSelectedServices(prev => {
      const exists = prev.some(s => 
        (s._id && svc._id && s._id === svc._id) || 
        (s.id && svc.id && s.id === svc.id) || 
        (s.name?.trim().toLowerCase() === svc.name?.trim().toLowerCase())
      );
      if (exists) {
        if (prev.length <= 1) {
          Alert.alert('Notice', 'At least one service must remain selected.');
          return prev;
        }
        return prev.filter(s => !(
          (s._id && svc._id && s._id === svc._id) || 
          (s.id && svc.id && s.id === svc.id) || 
          (s.name?.trim().toLowerCase() === svc.name?.trim().toLowerCase())
        ));
      } else {
        return [...prev, svc];
      }
    });
  };

  const hasMot = React.useMemo(() => {
    return selectedServices.some((s: any) => {
      const sName = (s?.name || '').toLowerCase();
      const sCat = (s?.category || '').toLowerCase();
      return sName.includes('mot') || sCat.includes('mot');
    });
  }, [selectedServices]);

  const isDateOnly = !hasMot;

  const totalServicePrice = React.useMemo(() => {
    return selectedServices.reduce((sum, s) => sum + (Number(s?.price) || 0), 0);
  }, [selectedServices]);

  const totalServiceDuration = React.useMemo(() => {
    return selectedServices.reduce((sum, s) => sum + (Number(s?.duration) || 45), 0);
  }, [selectedServices]);

  const selectedServiceNames = React.useMemo(() => {
    return selectedServices.map(s => s?.name).filter(Boolean).join(' + ') || 'Service';
  }, [selectedServices]);

  const otherServices = React.useMemo(() => {
    return selectedServices.filter(s => {
      const sName = (s?.name || '').toLowerCase();
      const sCat = (s?.category || '').toLowerCase();
      return !sName.includes('mot') && !sCat.includes('mot');
    });
  }, [selectedServices]);

  const otherServicesNames = React.useMemo(() => {
    return otherServices.map(s => s?.name).filter(Boolean).join(', ');
  }, [otherServices]);

  // Fetch garages list
  useEffect(() => {
    let isMounted = true;
    const fetchGarages = async () => {
      setLoadingGarages(true);
      try {
        const response = await authFetch(`${BASE_URL}/garages`, {
          headers: {}
        });
        if (response.ok) {
          const data = await response.json();
          if (!isMounted) return;
          const approvedOnly = Array.isArray(data) ? data.filter((g: any) => g.status === 'Approved') : [];
          setGarages(approvedOnly);
          
          if (isReschedule) {
            // Find the booked garage
            let found = null;
            if (targetGarageId) {
              found = data.find((g: any) => String(g.id || g._id) === String(targetGarageId));
            }
            if (!found && targetGarageName) {
              found = data.find((g: any) => g.name?.toLowerCase().trim() === targetGarageName?.toLowerCase().trim());
            }
            if (found) {
              setSelectedGarage(found);
            } else if (targetGarageId) {
              setSelectedGarage({ id: targetGarageId, _id: targetGarageId, name: targetGarageName || 'Booked Garage' });
            } else if (data.length > 0) {
              setSelectedGarage(data[0]);
            }
          } else {
            // Normal booking mode
            const initialGarageId = route?.params?.garageId;
            if (initialGarageId) {
              const found = data.find((g: any) => String(g.id || g._id) === String(initialGarageId));
              if (found) setSelectedGarage(found);
            } else if (data.length > 0 && !selectedGarage) {
              setSelectedGarage(data[0]);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching garages in BookingScreen:', err);
      } finally {
        if (isMounted) setLoadingGarages(false);
      }
    };
    fetchGarages();
    return () => { isMounted = false; };
  }, [targetGarageId, targetGarageName, isReschedule, token]);

  // Fetch selected garage services to load MOT dynamically and full garage info
  useEffect(() => {
    const gId = selectedGarage?.id || selectedGarage?._id || targetGarageId;
    if (!gId) return;
    
    let isMounted = true;
    const fetchGarageDetails = async () => {
      try {
        const response = await authFetch(`${BASE_URL}/garages/${gId}`, {
          headers: {}
        });
        if (response.ok) {
          const data = await response.json();
          if (!isMounted || !data) return;
          
          setSelectedGarage((prev: any) => ({
            ...(prev || {}),
            ...data,
            id: data.id || data._id || gId,
            _id: data._id || data.id || gId,
            name: data.name || data.garageName || prev?.name || targetGarageName || 'Garage',
            address: data.address || prev?.address || '',
          }));

          if (data.services && data.services.length > 0) {
            const motSvc = data.services.find((s: any) => s.name?.toUpperCase().includes('MOT'));
            if (motSvc && !route?.params?.serviceName && !activeBookingAlert?.serviceName) {
              setSelectedServices([motSvc]);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching garage details for services:', err);
      }
    };
    fetchGarageDetails();
    return () => { isMounted = false; };
  }, [selectedGarage?.id, selectedGarage?._id, targetGarageId, token]);

  const customer = customers.find((c: any) => 
    (selectedVehicle && selectedVehicle.customerId && (
      String(c.id).toLowerCase() === String(selectedVehicle.customerId || '').toLowerCase() ||
      String(c._id).toLowerCase() === String(selectedVehicle.customerId || '').toLowerCase()
    )) ||
    (customerId && (
      String(c.id).toLowerCase() === String(customerId).toLowerCase() ||
      String(c._id).toLowerCase() === String(customerId).toLowerCase()
    ))
  ) || customers[0] || {
    id: customerId || user?.customerId || user?.id || '',
    _id: customerId || user?.customerId || user?.id || '',
    firstName: user?.name ? user.name.split(' ')[0] : 'Customer',
    lastName: user?.name ? user.name.split(' ').slice(1).join(' ') : '',
    email: user?.email || '',
    mobile: '',
  };

  const initialViewDate = React.useMemo(() => {
    if (isReschedule && bookedDateRaw) {
      const bDate = new Date(bookedDateRaw);
      if (!isNaN(bDate.getTime())) return bDate;
    }
    return new Date();
  }, [isReschedule, bookedDateRaw]);

  // Date and Time options for slot selection
  const [currentViewDate, setCurrentViewDate] = useState(initialViewDate);

  const getDaysInMonth = (year: number, month: number) => {
    const date = new Date(year, month, 1);
    const days = [];
    const firstDayIndex = date.getDay(); // 0 = Sun, 6 = Sat
    
    // Empty slots before 1st of month
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }
    
    const lastDay = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= lastDay; d++) {
      days.push(new Date(year, month, d));
    }
    
    return days;
  };

  const isDateSelectable = (date: Date | null) => {
    if (!date) return false;
    const currentToday = new Date();
    currentToday.setHours(0, 0, 0, 0);
    
    // Past days
    if (date < currentToday) return false;
    
    // Sundays (Garages closed)
    if (date.getDay() === 0) return false;

    // DVSA 30-day rule check
    if (selectedVehicle?.motExpiryDate) {
      const expDate = new Date(selectedVehicle.motExpiryDate);
      expDate.setHours(0, 0, 0, 0);
      const daysLeft = Math.ceil((expDate.getTime() - currentToday.getTime()) / (1000 * 60 * 60 * 24));

      if (daysLeft > 30) {
        // Only allow dates within the 30-day window leading up to expiry
        const windowStart = new Date(expDate);
        windowStart.setDate(windowStart.getDate() - 30);
        windowStart.setHours(0, 0, 0, 0);

        if (date < windowStart || date > expDate) {
          return false;
        }
      }
    }
    
    return true;
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handlePrevMonth = () => {
    const prev = new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() - 1, 1);
    const now = new Date();
    if (prev.getFullYear() < now.getFullYear() || (prev.getFullYear() === now.getFullYear() && prev.getMonth() < now.getMonth())) {
      return;
    }
    setCurrentViewDate(prev);
  };

  const handleNextMonth = () => {
    const next = new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() + 1, 1);
    setCurrentViewDate(next);
  };

  const calendarDays = getDaysInMonth(currentViewDate.getFullYear(), currentViewDate.getMonth());

  const formatLocalDate = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const getTodayISOString = () => {
    const d = new Date();
    // If today is Sunday, default to tomorrow (Monday)
    if (d.getDay() === 0) {
      d.setDate(d.getDate() + 1);
    }
    return formatLocalDate(d);
  };

  const initialSelectedDate = isReschedule && bookedDateFormatted ? bookedDateFormatted : getTodayISOString();
  const [selectedDate, setSelectedDate] = useState(initialSelectedDate);
  const [selectedTime, setSelectedTime] = useState(isReschedule && bookedSlotTime ? bookedSlotTime : '');
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [garageSlots, setGarageSlots] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  // Sync date view when rescheduling or when vehicle changes
  useEffect(() => {
    if (isReschedule) {
      if (bookedDateFormatted && bookedDateRaw) {
        const bDate = new Date(bookedDateRaw);
        if (!isNaN(bDate.getTime())) {
          setSelectedDate(bookedDateFormatted);
          setCurrentViewDate(new Date(bDate.getFullYear(), bDate.getMonth(), 1));
          if (bookedSlotTime) {
            setSelectedTime(bookedSlotTime);
          }
        }
      }
      return;
    }

    if (selectedVehicle?.motExpiryDate) {
      const expDate = new Date(selectedVehicle.motExpiryDate);
      expDate.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const daysLeft = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (daysLeft > 30) {
        const windowStart = new Date(expDate);
        windowStart.setDate(windowStart.getDate() - 30);
        if (windowStart.getDay() === 0) {
          windowStart.setDate(windowStart.getDate() + 1);
        }
        setSelectedDate(formatLocalDate(windowStart));
        setCurrentViewDate(new Date(windowStart.getFullYear(), windowStart.getMonth(), 1));
      } else {
        const todayISO = getTodayISOString();
        setSelectedDate(todayISO);
        setCurrentViewDate(new Date());
      }
    }
  }, [selectedVehicle, isReschedule, bookedDateFormatted, bookedDateRaw, bookedSlotTime]);

  const formatDateInput = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    let formatted = cleaned;
    if (cleaned.length > 4 && cleaned.length <= 6) {
      formatted = `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
    } else if (cleaned.length > 6) {
      formatted = `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`;
    }
    return formatted;
  };

  const handleLookupNewPlate = async () => {
    const vrnClean = newRegNo.trim().toUpperCase().replace(/\s+/g, '');
    if (!vrnClean) {
      Alert.alert('Registration Required', 'Please enter a vehicle registration number to look up.');
      return;
    }

    setIsSearchingNewPlate(true);
    setNewLookupInfo(null);

    try {
      const res = await lookupVehicle(vrnClean);
      if (res && res.found && res.vehicle) {
        const v = res.vehicle;
        setNewMake(v.make || '');
        setNewModel(v.model || '');
        setNewYear(v.year ? String(v.year) : '');
        setNewExpiry(v.motExpiryDate || '');
        const infoStr = `${v.make} ${v.model}${v.year ? ` (${v.year})` : ''}`;
        setNewLookupInfo(infoStr);
        setNewCarErrors({});

        Toast.show({
          type: 'success',
          text1: 'Vehicle Found on DVSA',
          text2: `${v.make} ${v.model} details autofilled!`,
        });
      } else {
        Alert.alert(
          'Vehicle Not Found',
          `No vehicle details found for "${newRegNo.trim().toUpperCase()}" in DVSA records.\n\nPlease enter the vehicle details manually.`
        );
      }
    } catch (err: any) {
      console.error('[BookingScreen] lookup error:', err);
      const isBusy = err.isBusy || (err.message && (
        err.message.toLowerCase().includes('busy') ||
        err.message.toLowerCase().includes('taking too long')
      ));
      if (isBusy) {
        Alert.alert(
          'Government API Busy',
          'Government DVSA API is busy, please check again.'
        );
      } else {
        Alert.alert(
          'Vehicle Not Found',
          'Vehicle details not found. Please check the registration plate and try again.'
        );
      }
    } finally {
      setIsSearchingNewPlate(false);
    }
  };

  const handleSaveNewCar = async () => {
    // Field-by-field validation: names only the fields that are actually missing or invalid
    const vehicleCheck = validateNewVehicleForm({
      registration: newRegNo,
      make: newMake,
      model: newModel,
      year: newYear,
      motExpiry: newExpiry,
    });
    if (!vehicleCheck.isValid) {
      setNewCarErrors(vehicleCheck.errors);
      Alert.alert(vehicleCheck.title, vehicleCheck.message);
      return;
    }

    setNewCarErrors({});

    const {
      registration: regClean,
      make: makeClean,
      model: modelClean,
      year: yearClean,
      motExpiry: expiryClean,
    } = vehicleCheck.values;

    if (!token || !token.trim()) {
      Alert.alert(
        'Sign In Required',
        'Please sign in to your account to add this vehicle.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => navigation.navigate('Login') },
        ]
      );
      return;
    }

    setIsAddingCar(true);
    try {
      const targetCustId = customer.id || customer._id || user?.customerId || user?.id || '';
      const createdVeh = await addVehicle({
        customerId: targetCustId,
        registrationNumber: regClean,
        make: makeClean,
        model: modelClean,
        year: yearClean,
        motExpiryDate: expiryClean,
        status: 'Active',
      });

      await addAlert({
        type: 'NEW_VEHICLE',
        customerName: `${customer.firstName} ${customer.lastName}`.trim() || user?.name || 'Customer',
        customerId: targetCustId,
        customerEmail: customer.email || user?.email || '',
        customerMobile: customer.mobile || '',
        registrationNumber: regClean,
        makeModel: `${makeClean} ${modelClean}`,
        status: 'Approved',
      });

      await addAudit(
        'New Vehicle Registered',
        `${customer.firstName} ${customer.lastName} registered ${makeClean} ${modelClean} (${regClean}) during booking`
      );

      const targetObj = createdVeh || {
        id: `veh_${Date.now()}`,
        _id: `veh_${Date.now()}`,
        customerId: customer.id,
        registrationNumber: regClean,
        make: makeClean,
        model: modelClean,
        year: yearClean,
        motExpiryDate: expiryClean,
        status: 'Active',
      };

      setSelectedVehicle(targetObj);
      setShowAddCarForm(false);
      setNewRegNo('');
      setNewMake('');
      setNewModel('');
      setNewYear('');
      setNewExpiry('');
      setNewLookupInfo(null);

      Toast.show({
        type: 'success',
        text1: 'Vehicle Added & Selected!',
        text2: `${regClean} is now selected for this booking.`,
      });
    } catch (err: any) {
      console.error('Failed to add vehicle in booking flow:', err);
      const isAuthError = !token || (err?.message && (
        err.message.toLowerCase().includes('token') ||
        err.message.toLowerCase().includes('sign in') ||
        err.message.toLowerCase().includes('unauthorized') ||
        err.message.toLowerCase().includes('auth')
      ));
      if (isAuthError) {
        Alert.alert(
          'Sign In Required',
          'Please sign in to your account to add this vehicle.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign In', onPress: () => navigation.navigate('Login') },
          ]
        );
      } else {
        Alert.alert('Could Not Add Vehicle', err.message || 'Failed to add vehicle. Please try again.');
      }
    } finally {
      setIsAddingCar(false);
    }
  };

  // Fetch live 45-minute slots for the selected garage and date
  const fetchGarageSlots = React.useCallback(async () => {
    const targetGarageId = selectedGarage?.id || selectedGarage?._id;
    if (!targetGarageId || !selectedDate) {
      setGarageSlots([]);
      return;
    }

    setLoadingSlots(true);
    try {
      const res = await fetch(`${BASE_URL}/garages/${targetGarageId}/slots?date=${selectedDate}`);
      if (res.ok) {
        const data = await res.json();
        setGarageSlots(data.slots || []);
      } else {
        setGarageSlots([]);
      }
    } catch (e) {
      console.error('Error fetching garage slots:', e);
      setGarageSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [selectedGarage, selectedDate]);

  useEffect(() => {
    fetchGarageSlots();
  }, [fetchGarageSlots]);

  const isTimeSlotPassed = (slotTimeStr: string) => {
    const todayISO = formatLocalDate(new Date());
    if (selectedDate !== todayISO) {
      return false;
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();

    const match12 = slotTimeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (match12) {
      let hour = parseInt(match12[1], 10);
      const min = parseInt(match12[2], 10);
      const period = match12[3].toUpperCase();
      if (period === 'PM' && hour !== 12) hour += 12;
      if (period === 'AM' && hour === 12) hour = 0;
      return currentHour > hour || (currentHour === hour && currentMin >= min);
    }

    const match24 = slotTimeStr.match(/^(\d{1,2}):(\d{2})/);
    if (match24) {
      const hour = parseInt(match24[1], 10);
      const min = parseInt(match24[2], 10);
      return currentHour > hour || (currentHour === hour && currentMin >= min);
    }

    return false;
  };

  // User requirement: "only free slots would be shown to user !"
  const freeSlots = React.useMemo(() => {
    return garageSlots.filter((s: any) => {
      if (s.isBlocked) return false;
      if (s.status === 'Full' || s.availableCount <= 0) return false;
      if (isTimeSlotPassed(s.time)) return false;
      return true;
    });
  }, [garageSlots, selectedDate]);

  useEffect(() => {
    if (freeSlots.length > 0) {
      if (!selectedSlot || !freeSlots.some((s: any) => s.time === selectedSlot.time)) {
        setSelectedSlot(freeSlots[0]);
        setSelectedTime(freeSlots[0].time);
      }
    } else {
      setSelectedSlot(null);
      setSelectedTime('');
    }
  }, [freeSlots]);

  const handleConfirmBooking = async () => {
    if (!selectedDate || (hasMot && !selectedTime)) {
      Alert.alert('Error', hasMot ? 'Please select a date and time slot.' : 'Please select an appointment date.');
      return;
    }

    if (!selectedVehicle) {
      Alert.alert('Error', 'Please select a vehicle first.');
      return;
    }

    // If vehicle is in pre-booking mode (>30 days away), ensure selected date is within the 30-day window before expiry
    if (hasMot && selectedVehicle?.motExpiryDate) {
      const expDate = new Date(selectedVehicle.motExpiryDate);
      expDate.setHours(0, 0, 0, 0);
      const currentToday = new Date();
      currentToday.setHours(0, 0, 0, 0);
      const daysLeft = Math.ceil((expDate.getTime() - currentToday.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysLeft > 30) {
        const windowStart = new Date(expDate);
        windowStart.setDate(windowStart.getDate() - 30);
        windowStart.setHours(0, 0, 0, 0);
        const selD = new Date(selectedDate);
        selD.setHours(0, 0, 0, 0);

        if (selD < windowStart || selD > expDate) {
          Alert.alert(
            'DVSA 30-Day Renewal Window',
            `Under DVSA regulations, you can pre-book MOT slots within the 30-day window before expiry (${selectedVehicle.motExpiryDate?.substring(0, 10)}).\nPlease choose an appointment date between ${windowStart.toISOString().substring(0, 10)} and ${selectedVehicle.motExpiryDate?.substring(0, 10)}.`
          );
          return;
        }
      }
    }

    if (!selectedGarage) {
      Alert.alert('Error', 'Please select a garage first.');
      return;
    }

    setLoading(true);
    try {
      const parts = selectedDate.split('-');
      const monthsList = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const displayDateStr = parts.length === 3 
        ? `${parseInt(parts[2])} ${monthsList[parseInt(parts[1]) - 1]}`
        : selectedDate;

      const isAdmin = route?.params?.isAdmin || false;
      const targetSlotTime = hasMot ? (selectedSlot?.time || selectedTime) : 'Full Day Drop-off';
      const targetCustId = customer.id || customer._id || user?.customerId || user?.id || '';

      if (isReschedule && activeBookingAlert && (activeBookingAlert.id || (activeBookingAlert as any)._id)) {
        const targetAlertId = activeBookingAlert.id || (activeBookingAlert as any)._id;
        await rescheduleBooking(
          targetAlertId,
          selectedDate,
          hasMot ? (selectedSlot?.time || selectedTime) : ''
        );
      } else {
        // Add BOOKED alert notification to Admin alerts list
        await addAlert({
          type: 'BOOKED',
          customerName: `${customer.firstName} ${customer.lastName}`.trim() || user?.name || 'Customer',
          customerId: targetCustId,
          customerEmail: customer.email || user?.email || '',
          customerMobile: customer.mobile || '',
          garageId: selectedGarage.id || selectedGarage._id,
          serviceName: selectedServiceNames,
          services: selectedServices.map((s: any) => ({
            name: s.name,
            category: s.category || (s.name?.toLowerCase().includes('mot') ? 'MOT' : 'Servicing'),
            price: Number(s.price) || 0,
            duration: Number(s.duration) || 45,
          })),
          hasMot,
          isDateOnly,
          price: totalServicePrice,
          duration: hasMot ? (selectedSlot?.slotDuration || totalServiceDuration) : totalServiceDuration,
          slotTime: targetSlotTime,
          slotNumber: hasMot ? selectedSlot?.slotNumber : undefined,
          registrationNumber: selectedVehicle.registrationNumber,
          makeModel: `${selectedVehicle.make} ${selectedVehicle.model} - ${hasMot ? `Slot: ${targetSlotTime}` : 'Workshop Drop-off'}${otherServicesNames ? ` & Service: ${otherServicesNames}` : ''}`,
          status: isAdmin ? 'Approved' : 'Pending',
          date: selectedDate,
        });
      }

      // Log to audit history
      await addAudit(
        isReschedule ? 'Booking Rescheduled' : (isAdmin ? 'Booking Confirmed' : 'Booking Requested'),
        isAdmin
          ? `Garage staff booked appointment for ${customer.firstName} ${customer.lastName}'s ${selectedVehicle.make} ${selectedVehicle.model} (${selectedVehicle.registrationNumber}) on ${displayDateStr} - ${hasMot ? `MOT Slot: ${targetSlotTime}` : 'Workshop Intake'}${otherServicesNames ? ` & Service: ${otherServicesNames}` : ''}`
          : `${customer.firstName} ${customer.lastName} ${isReschedule ? 'rescheduled' : 'requested'} appointment for ${selectedVehicle.make} ${selectedVehicle.model} (${selectedVehicle.registrationNumber}) on ${displayDateStr} - ${hasMot ? `MOT Slot: ${targetSlotTime}` : 'Workshop Intake'}${otherServicesNames ? ` & Service: ${otherServicesNames}` : ''}`
      );

      setLoading(false);

      // Show Toast Notification
      const successMessage = isReschedule
        ? `Booking rescheduled successfully for ${displayDateStr}!`
        : (isAdmin 
            ? `Booking confirmed and approved for ${customer.firstName} ${customer.lastName}!`
            : `Booking request submitted successfully for ${displayDateStr}!`);

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: successMessage,
      });

      // Navigate back
      try {
        if (route?.params?.sourceScreen) {
          navigation.navigate(route.params.sourceScreen, route.params.sourceScreenParams || {});
        } else if (navigation.canGoBack()) {
          navigation.goBack();
        } else {
          navigation.navigate('Main', { screen: 'My Portal' });
        }
      } catch (navErr) {
        console.warn('Navigation redirect failed, falling back to goBack:', navErr);
        if (navigation.canGoBack()) {
          navigation.goBack();
        } else {
          navigation.navigate('Main', { screen: 'My Portal' });
        }
      }
    } catch (err: any) {
      setLoading(false);
      Alert.alert('Error', err.message || 'Failed to confirm booking slot.');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Top Header */}
      <View style={[styles.navbar, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.text} />
          {/* <Text style={[styles.backBtnText, { color: theme.colors.text }]}>Back</Text> */}
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: theme.colors.text }]}>
          {isReschedule ? 'Reschedule Appointment' : 'Book Appointment'}
        </Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {isReschedule ? (
          <>
            {/* Vehicle Summary Card for Rescheduling */}
            <View style={[styles.vehicleCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <View style={styles.plate}>
                <Text style={styles.plateText}>{selectedVehicle?.registrationNumber}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.vehicleMakeModel, { color: theme.colors.text }]}>
                  {selectedVehicle?.make} {selectedVehicle?.model}
                </Text>
                {selectedVehicle?.motExpiryDate ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                    <MaterialCommunityIcons name="calendar-clock" size={13} color={theme.colors.placeholder} style={{ marginRight: 4 }} />
                    <Text style={[styles.vehicleSubText, { color: theme.colors.placeholder }]}>
                      MOT Expiry: {new Date(selectedVehicle.motExpiryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} ({(() => {
                        const daysLeft = getDaysUntilExpiry(selectedVehicle.motExpiryDate);
                        return daysLeft >= 0 ? `${daysLeft} days left` : `${Math.abs(daysLeft)} days ago`;
                      })()})
                    </Text>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                    <MaterialCommunityIcons name="information-outline" size={13} color={theme.colors.placeholder} style={{ marginRight: 4 }} />
                    <Text style={[styles.vehicleSubText, { color: theme.colors.placeholder }]}>
                      Rescheduling appointment for this vehicle
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* 30-Day Renewal Window Active Notice */}
            {selectedVehicle && getDaysUntilExpiry(selectedVehicle.motExpiryDate) > 30 && (
              <View style={[styles.rescheduleNotice, { backgroundColor: theme.colors.secondary + '12', borderColor: theme.colors.secondary, marginTop: 12 }]}>
                <MaterialCommunityIcons name="calendar-clock" size={20} color={theme.colors.secondary} style={{ marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bold, color: theme.colors.secondary, fontSize: 13 }}>
                    Official DVSA 30-Day Renewal Window Active
                  </Text>
                  <Text style={[styles.rescheduleNoticeText, { color: theme.colors.text, marginTop: 2 }]}>
                    {selectedVehicle?.registrationNumber} MOT Expiry is {new Date(selectedVehicle.motExpiryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} ({(() => {
                      const daysLeft = getDaysUntilExpiry(selectedVehicle.motExpiryDate);
                      return daysLeft >= 0 ? `${daysLeft} days left` : `${Math.abs(daysLeft)} days ago`;
                    })()}). You can pre-book your test slot within the last 30 days of MOT expiry to preserve your renewal anniversary.
                  </Text>
                </View>
              </View>
            )}

            {/* Locked Garage & Service Info for Rescheduling */}
            <View style={[styles.vehicleCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, marginTop: 12 }]}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: theme.colors.placeholder, textTransform: 'uppercase' }}>
                    Booked Garage (Rescheduling)
                  </Text>
                  <View style={{ backgroundColor: theme.colors.warning + '25', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                    <Text style={{ fontFamily: fonts.bold, color: theme.colors.warning, fontSize: 10 }}>LOCKED</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                  <View style={[styles.selectedGarageIconCircle, { backgroundColor: theme.colors.secondary + '15' }]}>
                    <MaterialCommunityIcons name="store" size={20} color={theme.colors.secondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.vehicleMakeModel, { color: theme.colors.text, fontSize: 15, fontWeight: 'bold', marginBottom: 2 }]}>
                      {selectedGarage?.name || targetGarageName || 'Garage'}
                    </Text>
                    {selectedGarage?.address ? (
                      <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: theme.colors.placeholder, marginBottom: 4 }} numberOfLines={1}>
                        {selectedGarage.address}{selectedGarage.city ? `, ${selectedGarage.city}` : ''}
                      </Text>
                    ) : null}
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <MaterialCommunityIcons name="wrench-clock" size={13} color={theme.colors.placeholder} style={{ marginRight: 4 }} />
                      <Text style={[styles.vehicleSubText, { color: theme.colors.placeholder }]}>
                        {selectedService.name} (£{Number(selectedService.price || 45).toFixed(2)}) • {selectedService.duration || 45}m
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Currently Booked Date & Slot Box */}
                {(bookedDateRaw || bookedSlotTime) && (
                  <View style={[styles.currentBookingBox, { backgroundColor: theme.colors.warning + '12', borderColor: theme.colors.warning + '35' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                      <MaterialCommunityIcons name="calendar-clock" size={16} color={theme.colors.warning} style={{ marginRight: 6 }} />
                      <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: theme.colors.warning }}>
                        Current Booked Appointment
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>
                      {bookedDateRaw && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 10 }}>
                          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: theme.colors.placeholder, marginRight: 4 }}>Date:</Text>
                          <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: theme.colors.text }}>
                            {new Date(bookedDateRaw).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </Text>
                        </View>
                      )}
                      {bookedSlotTime && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 10 }}>
                          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: theme.colors.placeholder, marginRight: 4 }}>Time Slot:</Text>
                          <Text style={{ fontSize: 12, fontFamily: fonts.bold, color: theme.colors.text }}>
                            {bookedSlotTime}
                          </Text>
                        </View>
                      )}
                      {bookedSlotNumber ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={{ fontSize: 12, color: theme.colors.placeholder, marginRight: 4, fontFamily: fonts.regular }}>Slot No:</Text>
                          <Text style={{ fontSize: 12, fontFamily: fonts.bold, color: theme.colors.text }}>
                            #{bookedSlotNumber}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                )}
              </View>
            </View>
          </>
        ) : (
          <>
            {/* 1. Dynamic Vehicle Selector */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: 8 }}>
              <Text style={[styles.sectionHeading, { color: theme.colors.text, marginBottom: 0 }]}>
                Select Vehicle
              </Text>
              {activeCustomerVehicles.length > 0 && (
                <TouchableOpacity
                  onPress={() => setShowAddCarForm(!showAddCarForm)}
                  style={[
                    styles.addCarToggleBtn,
                    {
                      backgroundColor: showAddCarForm ? theme.colors.border : theme.colors.primary + '15',
                      borderColor: showAddCarForm ? theme.colors.border : theme.colors.primary + '35',
                    }
                  ]}
                >
                  <MaterialCommunityIcons
                    name={showAddCarForm ? 'close' : 'plus'}
                    size={14}
                    color={showAddCarForm ? theme.colors.text : theme.colors.primary}
                    style={{ marginRight: 3 }}
                  />
                  <Text style={[
                    styles.addCarToggleText,
                    { color: showAddCarForm ? theme.colors.text : theme.colors.primary }
                  ]}>
                    {showAddCarForm ? 'Cancel' : 'Add Car'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Inline Add Vehicle Card */}
            {(showAddCarForm || activeCustomerVehicles.length === 0) && (
              <View style={[styles.inlineAddCarCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.primary + '40', marginBottom: 14 }]}>
                <View style={styles.inlineAddCarHeader}>
                  <MaterialCommunityIcons name="car-plus" size={18} color={theme.colors.primary} style={{ marginRight: 6 }} />
                  <Text style={[styles.inlineAddCarTitle, { color: theme.colors.text }]}>
                    Register & Add Vehicle for this Booking
                  </Text>
                </View>

                {/* UK Number Plate Input with Attached Lookup */}
                <Text style={[styles.formLabel, { color: theme.colors.text }]}>UK Registration Plate</Text>
                <View style={[styles.plateInputContainer, newCarErrors.registration ? { borderColor: theme.colors.error, borderWidth: 2 } : null]}>
                  <View style={styles.ukPlateStrip}>
                    <Text style={styles.ukFlagEmoji}>🇬🇧</Text>
                    <Text style={styles.ukStripLabel}>UK</Text>
                  </View>
                  <TextInput
                    value={newRegNo}
                    onChangeText={(txt) => { setNewRegNo(txt.toUpperCase()); clearNewCarError('registration'); }}
                    placeholder="eg AB19 CDE"
                    placeholderTextColor="#6B7280"
                    style={styles.plateInputField}
                    autoCapitalize="characters"
                    maxLength={8}
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    style={[styles.plateLookupBtn, { backgroundColor: theme.colors.primary }]}
                    onPress={handleLookupNewPlate}
                    disabled={isSearchingNewPlate}
                    activeOpacity={0.8}
                  >
                    {isSearchingNewPlate ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="magnify" size={15} color="#FFFFFF" style={{ marginRight: 3 }} />
                        <Text style={styles.plateLookupBtnText}>LOOKUP</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
                {newCarErrors.registration ? (
                  <Text style={[styles.fieldErrorText, { color: theme.colors.error }]}>{newCarErrors.registration}</Text>
                ) : null}

                {/* Lookup Info Banner */}
                {newLookupInfo && (
                  <View style={styles.lookupSuccessBanner}>
                    <MaterialCommunityIcons name="check-decagram" size={16} color="#10B981" style={{ marginRight: 6 }} />
                    <Text style={styles.lookupSuccessText}>
                      DVSA Verified: Autofilled details for {newLookupInfo}
                    </Text>
                  </View>
                )}

                {/* Make & Model Row */}
                <View style={styles.formRow}>
                  <View style={styles.formCol}>
                    <Text style={[styles.formLabel, { color: theme.colors.text }]}>Make</Text>
                    <TextInput
                      value={newMake}
                      onChangeText={(t) => { setNewMake(t); clearNewCarError('make'); }}
                      placeholder="e.g. FORD"
                      placeholderTextColor={theme.colors.placeholder}
                      autoCapitalize="characters"
                      style={[styles.formInputField, { color: theme.colors.text, borderColor: newCarErrors.make ? theme.colors.error : theme.colors.border, backgroundColor: theme.colors.background }]}
                    />
                    {newCarErrors.make ? (
                      <Text style={[styles.fieldErrorText, { color: theme.colors.error }]}>{newCarErrors.make}</Text>
                    ) : null}
                  </View>
                  <View style={styles.formCol}>
                    <Text style={[styles.formLabel, { color: theme.colors.text }]}>Model</Text>
                    <TextInput
                      value={newModel}
                      onChangeText={(t) => { setNewModel(t); clearNewCarError('model'); }}
                      placeholder="e.g. FOCUS"
                      placeholderTextColor={theme.colors.placeholder}
                      autoCapitalize="characters"
                      style={[styles.formInputField, { color: theme.colors.text, borderColor: newCarErrors.model ? theme.colors.error : theme.colors.border, backgroundColor: theme.colors.background }]}
                    />
                    {newCarErrors.model ? (
                      <Text style={[styles.fieldErrorText, { color: theme.colors.error }]}>{newCarErrors.model}</Text>
                    ) : null}
                  </View>
                </View>

                {/* Year & MOT Expiry Row */}
                <View style={styles.formRow}>
                  <View style={styles.formCol}>
                    <Text style={[styles.formLabel, { color: theme.colors.text }]}>Year</Text>
                    <TextInput
                      value={newYear}
                      onChangeText={(t) => { setNewYear(t); clearNewCarError('year'); }}
                      placeholder="e.g. 2019"
                      placeholderTextColor={theme.colors.placeholder}
                      keyboardType="numeric"
                      maxLength={4}
                      style={[styles.formInputField, { color: theme.colors.text, borderColor: newCarErrors.year ? theme.colors.error : theme.colors.border, backgroundColor: theme.colors.background }]}
                    />
                    {newCarErrors.year ? (
                      <Text style={[styles.fieldErrorText, { color: theme.colors.error }]}>{newCarErrors.year}</Text>
                    ) : null}
                  </View>
                  <View style={styles.formCol}>
                    <Text style={[styles.formLabel, { color: theme.colors.text }]}>MOT Expiry (YYYY-MM-DD)</Text>
                    <TextInput
                      value={newExpiry}
                      onChangeText={(t) => { setNewExpiry(formatDateInput(t)); clearNewCarError('motExpiry'); }}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={theme.colors.placeholder}
                      keyboardType="numeric"
                      maxLength={10}
                      style={[styles.formInputField, { color: theme.colors.text, borderColor: newCarErrors.motExpiry ? theme.colors.error : theme.colors.border, backgroundColor: theme.colors.background }]}
                    />
                    {newCarErrors.motExpiry ? (
                      <Text style={[styles.fieldErrorText, { color: theme.colors.error }]}>{newCarErrors.motExpiry}</Text>
                    ) : null}
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                  {activeCustomerVehicles.length > 0 && (
                    <TouchableOpacity
                      style={[styles.cancelCarFormBtn, { borderColor: theme.colors.border }]}
                      onPress={() => setShowAddCarForm(false)}
                    >
                      <Text style={[styles.cancelCarFormText, { color: theme.colors.text }]}>Cancel</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.saveCarSubmitBtn, { backgroundColor: theme.colors.primary, flex: 1 }]}
                    onPress={handleSaveNewCar}
                    disabled={isAddingCar}
                  >
                    {isAddingCar ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="check" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                        <Text style={styles.saveCarSubmitBtnText}>Save & Select Car</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Vehicle Selector Carousel */}
            {activeCustomerVehicles.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                {activeCustomerVehicles.map(v => {
                  const isSelected = selectedVehicle && (v.registrationNumber === selectedVehicle.registrationNumber);
                  const daysLeft = getDaysUntilExpiry(v.motExpiryDate);
                  return (
                    <TouchableOpacity
                      key={v.id || v._id || v.registrationNumber}
                      onPress={() => setSelectedVehicle(v)}
                      style={[
                        styles.vehicleSelectorCard,
                        { 
                          backgroundColor: theme.colors.card, 
                          borderColor: isSelected 
                            ? (theme.dark ? theme.colors.secondary : theme.colors.primary) 
                            : theme.colors.border,
                          borderWidth: isSelected ? 2 : 1.5,
                          paddingVertical: 10,
                          paddingHorizontal: 12
                        }
                      ]}
                    >
                      <View style={[styles.plate, { marginRight: 8, height: 30, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }]}>
                        <Text style={[styles.plateText, { fontSize: 11 }]}>{v.registrationNumber}</Text>
                      </View>
                      <View style={{ flex: 1, marginRight: 4 }}>
                        <Text style={[styles.vehicleMakeModel, { color: theme.colors.text, fontSize: 13, fontWeight: 'bold' }]} numberOfLines={1}>
                          {v.make} {v.model}
                        </Text>
                        {v.motExpiryDate && (
                          <Text style={{ fontSize: 10, color: theme.colors.placeholder, marginTop: 1, fontFamily: fonts.regular }} numberOfLines={1}>
                            MOT: {new Date(v.motExpiryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ({daysLeft >= 0 ? `${daysLeft}d left` : `${Math.abs(daysLeft)}d ago`})
                          </Text>
                        )}
                      </View>
                      {isSelected && (
                        <MaterialCommunityIcons 
                          name="check-circle" 
                          size={18} 
                          color={theme.dark ? theme.colors.secondary : theme.colors.primary} 
                          style={{ marginLeft: 4 }} 
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* 2. Dynamic Garage Selector */}
            <Text style={[styles.sectionHeading, { color: theme.colors.text, marginBottom: 8 }]}>
              Select Garage
            </Text>
            {loadingGarages ? (
              <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 12 }} />
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                {garages.map(g => {
                  const isSelected = selectedGarage && (g.id === selectedGarage.id || g._id === selectedGarage._id);
                  return (
                    <TouchableOpacity
                      key={g.id || g._id}
                      onPress={() => setSelectedGarage(g)}
                      style={[
                        styles.garageSelectorCard,
                        { 
                          backgroundColor: theme.colors.card, 
                          borderColor: isSelected 
                            ? (theme.dark ? theme.colors.secondary : theme.colors.primary) 
                            : theme.colors.border,
                          borderWidth: isSelected ? 2 : 1.5
                        }
                      ]}
                    >
                      <MaterialCommunityIcons 
                        name="store" 
                        size={20} 
                        color={isSelected ? (theme.dark ? theme.colors.secondary : theme.colors.primary) : theme.colors.placeholder} 
                        style={{ marginRight: 8 }} 
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.colors.text, fontSize: 13, fontFamily: fonts.bold }} numberOfLines={1}>
                          {g.name}
                        </Text>
                        <Text style={{ color: theme.colors.placeholder, fontSize: 11, marginTop: 1, fontFamily: fonts.regular }} numberOfLines={1}>
                          {g.address}
                        </Text>
                      </View>
                      {isSelected && (
                        <MaterialCommunityIcons 
                          name="check-circle" 
                          size={18} 
                          color={theme.dark ? theme.colors.secondary : theme.colors.primary} 
                          style={{ marginLeft: 6 }} 
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* 3. Service Selection (Multi-select supported) */}
            {selectedGarage && (
              <View style={[styles.vehicleCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, marginBottom: 14 }]}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={{ fontSize: 11, color: theme.colors.placeholder, fontFamily: fonts.bold, textTransform: 'uppercase' }}>
                      Selected Services ({selectedServices.length})
                    </Text>
                    <View style={{ backgroundColor: theme.colors.primary + '15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                      <Text style={{ fontSize: 11, fontFamily: fonts.bold, color: theme.colors.primary }}>
                        Total: £{totalServicePrice.toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  {/* Summary of currently selected services */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                    {selectedServices.map((svc: any) => {
                      const isMot = (svc.name || '').toLowerCase().includes('mot') || (svc.category || '').toLowerCase().includes('mot');
                      return (
                        <View
                          key={svc._id || svc.id || svc.name}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: isMot ? (theme.dark ? theme.colors.secondary + '25' : theme.colors.secondary + '20') : theme.colors.primary + '15',
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            borderRadius: 16,
                            borderWidth: 1,
                            borderColor: isMot ? theme.colors.secondary : theme.colors.primary + '40',
                          }}
                        >
                          <MaterialCommunityIcons
                            name={isMot ? 'car-wrench' : 'wrench'}
                            size={14}
                            color={isMot ? theme.colors.secondary : theme.colors.primary}
                            style={{ marginRight: 5 }}
                          />
                          <Text style={{ fontSize: 12, color: theme.colors.text, fontFamily: fonts.bold }}>
                            {svc.name}
                          </Text>
                          <Text style={{ fontSize: 11, color: theme.colors.primary, fontFamily: fonts.bold, marginLeft: 4 }}>
                            (£{Number(svc.price || 0).toFixed(0)})
                          </Text>
                        </View>
                      );
                    })}
                  </View>

                  {/* Toggle list of all garage services */}
                  {selectedGarage.services && selectedGarage.services.filter((s: any) => s.isActive !== false).length > 0 && (
                    <View style={{ marginTop: 6, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: theme.colors.border }}>
                      <Text style={{ fontSize: 10, color: theme.colors.placeholder, fontFamily: fonts.bold, textTransform: 'uppercase', marginBottom: 8 }}>
                        Tap services to add or remove for this booking:
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {selectedGarage.services
                          .filter((s: any) => s.isActive !== false)
                          .map((svc: any) => {
                            const isChosen = selectedServices.some((s: any) =>
                              (s._id && svc._id && s._id === svc._id) ||
                              (s.id && svc.id && s.id === svc.id) ||
                              (s.name?.trim().toLowerCase() === svc.name?.trim().toLowerCase())
                            );
                            return (
                              <TouchableOpacity
                                key={svc._id || svc.id || svc.name}
                                onPress={() => toggleSelectService(svc)}
                                activeOpacity={0.7}
                                style={[
                                  {
                                    paddingHorizontal: 10,
                                    paddingVertical: 7,
                                    borderRadius: 8,
                                    borderWidth: 1.5,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    backgroundColor: isChosen
                                      ? (theme.colors.primary + '18')
                                      : theme.colors.background,
                                    borderColor: isChosen
                                      ? theme.colors.primary
                                      : theme.colors.border,
                                  }
                                ]}
                              >
                                <MaterialCommunityIcons
                                  name={isChosen ? 'check-circle' : 'circle-outline'}
                                  size={16}
                                  color={isChosen ? theme.colors.primary : theme.colors.placeholder}
                                  style={{ marginRight: 6 }}
                                />
                                <View>
                                  <Text style={{
                                    fontSize: 12,
                                    color: theme.colors.text,
                                    fontFamily: isChosen ? fonts.bold : fonts.medium
                                  }}>
                                    {svc.name}
                                  </Text>
                                  <Text style={{
                                    fontSize: 10,
                                    color: isChosen ? theme.colors.primary : theme.colors.placeholder,
                                    fontFamily: fonts.bold
                                  }}>
                                    £{Number(svc.price || 0).toFixed(2)} • {svc.duration || 45} mins
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                      </View>
                    </View>
                  )}

                  {/* Mode explanation banner */}
                  <View style={{
                    marginTop: 10,
                    padding: 8,
                    borderRadius: 6,
                    backgroundColor: hasMot ? theme.colors.secondary + '12' : theme.colors.primary + '10',
                    flexDirection: 'row',
                    alignItems: 'center'
                  }}>
                    <MaterialCommunityIcons
                      name={hasMot ? 'clock-check-outline' : 'calendar-clock'}
                      size={16}
                      color={hasMot ? theme.colors.secondary : theme.colors.primary}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={{ fontSize: 11, color: theme.colors.text, fontFamily: fonts.medium, flex: 1 }}>
                      {hasMot && otherServices.length > 0
                        ? `MOT slot required for the test; additional service (${otherServicesNames}) will be completed on the same date.`
                        : hasMot
                        ? 'MOT test requires a specific 45-minute lane time slot.'
                        : 'Workshop drop-off intake (08:00 - 18:00) on chosen date. No 45-minute slot needed.'}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </>
        )}

        {isReschedule && (
          <View style={[styles.rescheduleNotice, { backgroundColor: theme.colors.warning + '15', borderColor: theme.colors.warning }]}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <MaterialCommunityIcons name="alert-circle-outline" size={20} color={theme.colors.warning} style={{ marginRight: 8, marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.rescheduleNoticeText, { color: theme.colors.text }]}>
                  You are rescheduling your existing booking. The new date and slot will replace your current reservation upon confirmation.
                </Text>
                {activeBookingAlert && (
                  <TouchableOpacity
                    onPress={() => {
                      const reg = selectedVehicle?.registrationNumber || 'Vehicle';
                      Alert.alert(
                        'Cancel Booking?',
                        `Are you sure you want to cancel your current booking for ${reg} instead of rescheduling?`,
                        [
                          { text: 'Keep Booking', style: 'cancel' },
                          {
                            text: 'Yes, Cancel Booking',
                            style: 'destructive',
                            onPress: async () => {
                              try {
                                setLoading(true);
                                await cancelBooking(activeBookingAlert.id || (activeBookingAlert as any)._id, 'Cancelled via booking screen');
                                Alert.alert('Booking Cancelled', 'Your booking has been cancelled successfully.', [
                                  { text: 'OK', onPress: () => navigation.goBack() }
                                ]);
                              } catch (err: any) {
                                Alert.alert('Cancellation Failed', err?.message || 'Could not cancel booking.');
                              } finally {
                                setLoading(false);
                              }
                            }
                          }
                        ]
                      );
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      marginTop: 8,
                      alignSelf: 'flex-start',
                      paddingVertical: 5,
                      paddingHorizontal: 10,
                      borderRadius: 6,
                      backgroundColor: theme.colors.error + '15',
                      borderWidth: 1,
                      borderColor: theme.colors.error,
                    }}
                  >
                    <MaterialCommunityIcons name="calendar-remove" size={14} color={theme.colors.error} style={{ marginRight: 4 }} />
                    <Text style={{ fontSize: 11.5, fontFamily: fonts.bold, color: theme.colors.error }}>
                      Or Cancel Booking Completely
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Date Selector Section */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginTop: 12 }}>
          <MaterialCommunityIcons name="calendar-month-outline" size={16} color={theme.colors.placeholder} style={{ marginRight: 6 }} />
          <Text style={[styles.sectionHeading, { color: theme.colors.text, marginBottom: 0 }]}>1. Select Appointment Date</Text>
        </View>
        <View style={[styles.calendarCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          {/* Header */}
          <View style={styles.calendarHeader}>
            <TouchableOpacity onPress={handlePrevMonth} style={styles.calNavBtn}>
              <MaterialCommunityIcons name="chevron-left" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={[styles.calendarTitle, { color: theme.colors.text }]}>
              {monthNames[currentViewDate.getMonth()]} {currentViewDate.getFullYear()}
            </Text>
            <TouchableOpacity onPress={handleNextMonth} style={styles.calNavBtn}>
              <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          {/* Weekday labels */}
          <View style={styles.weekdayRow}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, index) => (
              <Text key={d} style={[styles.weekdayText, { color: index === 0 ? theme.colors.error : theme.colors.placeholder }]}>
                {d}
              </Text>
            ))}
          </View>

          {/* Days Grid */}
          <View style={styles.daysGrid}>
            {calendarDays.map((day, idx) => {
              if (!day) {
                return <View key={`empty-${idx}`} style={styles.dayCell} />;
              }

              const isoString = formatLocalDate(day);
              const isSelected = selectedDate === isoString;
              const selectable = isDateSelectable(day);
              const isBookedOriginalDate = isReschedule && bookedDateFormatted === isoString;
              
              const todayObj = new Date();
              const isToday = day.getDate() === todayObj.getDate() && 
                              day.getMonth() === todayObj.getMonth() && 
                              day.getFullYear() === todayObj.getFullYear();

              return (
                <TouchableOpacity
                  key={isoString}
                  disabled={!selectable}
                  onPress={() => setSelectedDate(isoString)}
                  style={[
                    styles.dayCell,
                    isSelected && { backgroundColor: theme.colors.secondary, borderRadius: 18 },
                    !isSelected && isBookedOriginalDate && { borderWidth: 1.5, borderColor: theme.colors.warning, backgroundColor: theme.colors.warning + '18', borderRadius: 18 },
                    isToday && !isSelected && !isBookedOriginalDate && { borderWidth: 1, borderColor: theme.colors.secondary, borderRadius: 18 }
                  ]}
                >
                  <Text
                    style={[
                      styles.dayCellText,
                      { color: theme.colors.text },
                      isSelected && { color: '#FFFFFF', fontFamily: fonts.bold },
                      !isSelected && isBookedOriginalDate && { color: theme.colors.warning, fontFamily: fonts.bold },
                      !selectable && { color: theme.colors.placeholder + '40' }
                    ]}
                  >
                    {day.getDate()}
                  </Text>
                  {isBookedOriginalDate && !isSelected && (
                    <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: theme.colors.warning, marginTop: 1 }} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Time Selector Section (Only for MOT; Date-Only Workshop Intake for Other Services) */}
        {hasMot ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, marginTop: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="clock-outline" size={16} color={theme.colors.placeholder} style={{ marginRight: 6 }} />
                <Text style={[styles.sectionHeading, { color: theme.colors.text, marginBottom: 0 }]}>
                  2. Choose MOT Time Slot (45 Mins)
                </Text>
              </View>
              {loadingSlots && <ActivityIndicator size="small" color={theme.colors.secondary} />}
            </View>

            {otherServices.length > 0 && (
              <View style={{
                backgroundColor: theme.colors.primary + '15',
                borderColor: theme.colors.primary + '40',
                borderWidth: 1,
                borderRadius: 8,
                padding: 10,
                marginBottom: 10,
                flexDirection: 'row',
                alignItems: 'center'
              }}>
                <MaterialCommunityIcons name="information" size={20} color={theme.colors.primary} style={{ marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.text, fontSize: 12, fontFamily: fonts.bold }}>
                    Same Date for All Services ({selectedDate})
                  </Text>
                  <Text style={{ color: theme.colors.placeholder, fontSize: 11, marginTop: 2, fontFamily: fonts.regular, lineHeight: 15 }}>
                    The 45-minute slot selected below is for your MOT test. Other services ({otherServicesNames}) will be completed during workshop hours on this same date.
                  </Text>
                </View>
              </View>
            )}

            {!selectedGarage ? (
              <View style={[styles.emptySlotsNotice, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <MaterialCommunityIcons name="store-clock-outline" size={22} color={theme.colors.placeholder} />
                <Text style={{ marginLeft: 8, color: theme.colors.placeholder, fontSize: 13, fontFamily: fonts.regular }}>
                  Please select a garage above to view available time slots.
                </Text>
              </View>
            ) : loadingSlots ? (
              <View style={[styles.emptySlotsNotice, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <ActivityIndicator size="small" color={theme.colors.secondary} style={{ marginRight: 8 }} />
                <Text style={{ color: theme.colors.placeholder, fontSize: 13, fontFamily: fonts.medium }}>
                  Checking available slots for {selectedGarage.name}...
                </Text>
              </View>
            ) : freeSlots.length === 0 ? (
              <View style={[styles.emptySlotsNotice, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <MaterialCommunityIcons name="calendar-remove" size={24} color={theme.colors.error} />
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={{ color: theme.colors.text, fontSize: 13.5, fontFamily: fonts.bold }}>
                    No Free Slots Available
                  </Text>
                  <Text style={{ color: theme.colors.placeholder, fontSize: 12, marginTop: 2, lineHeight: 16, fontFamily: fonts.regular }}>
                    All appointment slots are fully booked or closed on this date at {selectedGarage.name}. Please choose another date on the calendar above.
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.timePickerContainer}>
                {freeSlots.map((slot: any) => {
                  const isSelected = selectedTime === slot.time;
                  return (
                    <TouchableOpacity
                      key={slot.time}
                      onPress={() => {
                        setSelectedSlot(slot);
                        setSelectedTime(slot.time);
                      }}
                      style={[
                        styles.timeCard,
                        {
                          backgroundColor: isSelected ? theme.colors.secondary + '18' : theme.colors.card,
                          borderColor: isSelected ? theme.colors.secondary : theme.colors.border,
                          borderWidth: isSelected ? 2 : 1.5,
                        },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Text style={[styles.timeLabel, { color: theme.colors.text, fontSize: 14, fontFamily: fonts.bold }]}>
                            {slot.time}
                          </Text>
                          {isSelected ? (
                            <MaterialCommunityIcons name="check-circle" size={16} color={theme.colors.secondary} />
                          ) : (
                            <View style={[styles.freeTag, { backgroundColor: '#10B98115' }]}>
                              <Text style={{ color: '#10B981', fontSize: 10, fontFamily: fonts.bold }}>
                                {slot.availableCount} Open
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.timeText, { color: theme.colors.placeholder, fontSize: 11, marginTop: 2, fontFamily: fonts.medium }]}>
                          {slot.slotLabel || `${slot.time} - ${slot.endTime || '45m'}`}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginTop: 14 }}>
              <MaterialCommunityIcons name="store-clock-outline" size={16} color={theme.colors.placeholder} style={{ marginRight: 6 }} />
              <Text style={[styles.sectionHeading, { color: theme.colors.text, marginBottom: 0 }]}>
                2. Workshop Intake & Drop-off
              </Text>
            </View>
            <View style={[styles.emptySlotsNotice, { backgroundColor: theme.colors.card, borderColor: theme.colors.secondary + '40', padding: 14 }]}>
              <MaterialCommunityIcons name="car-wrench" size={26} color={theme.colors.secondary} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{ color: theme.colors.text, fontSize: 13.5, fontFamily: fonts.bold }}>
                  Full-Day Workshop Drop-off (08:00 - 18:00)
                </Text>
                <Text style={{ color: theme.colors.placeholder, fontSize: 12, marginTop: 3, lineHeight: 17, fontFamily: fonts.regular }}>
                  No fixed 45-minute lane slot is needed for {selectedServiceNames}. Bring your vehicle to {selectedGarage?.name || 'the garage'} on {selectedDate}. The garage will carry out your service during workshop hours.
                </Text>
              </View>
            </View>
          </>
        )}

        {/* Notes/Comments Section */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginTop: 14 }}>
          <MaterialCommunityIcons name="note-text-outline" size={16} color={theme.colors.placeholder} style={{ marginRight: 6 }} />
          <Text style={[styles.sectionHeading, { color: theme.colors.text, marginBottom: 0 }]}>3. Special Requests / Notes (Optional)</Text>
        </View>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="E.g., Rear brakes squealing, please check them during test."
          placeholderTextColor={theme.colors.placeholder}
          multiline
          numberOfLines={4}
          style={[
            styles.notesInput,
            {
              color: theme.colors.text,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.card,
            },
          ]}
        />

        {/* Summary Card Before Confirmation */}
        <View style={[styles.vehicleCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, marginTop: 14, marginBottom: 4 }]}>
          <Text style={{ fontSize: 11, color: theme.colors.placeholder, fontFamily: fonts.bold, textTransform: 'uppercase', marginBottom: 8 }}>
            Booking Summary
          </Text>
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 12, color: theme.colors.placeholder, fontFamily: fonts.medium }}>Date (Shared):</Text>
              <Text style={{ fontSize: 12, color: theme.colors.text, fontFamily: fonts.bold }}>{selectedDate || 'Not selected'}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 12, color: theme.colors.placeholder, fontFamily: fonts.medium }}>Services:</Text>
              <Text style={{ fontSize: 12, color: theme.colors.text, fontFamily: fonts.bold, flexShrink: 1, textAlign: 'right' }}>
                {selectedServiceNames}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 12, color: theme.colors.placeholder, fontFamily: fonts.medium }}>
                {hasMot ? 'MOT Slot:' : 'Workshop Intake:'}
              </Text>
              <Text style={{ fontSize: 12, color: theme.colors.primary, fontFamily: fonts.bold }}>
                {hasMot ? (selectedTime || 'Select a slot') : 'Full-Day Drop-off (08:00 - 18:00)'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: theme.colors.border, paddingTop: 6, marginTop: 2 }}>
              <Text style={{ fontSize: 13, color: theme.colors.text, fontFamily: fonts.bold }}>Total Price:</Text>
              <Text style={{ fontSize: 14, color: theme.colors.primary, fontFamily: fonts.bold }}>
                £{totalServicePrice.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          <TouchableOpacity
            onPress={handleConfirmBooking}
            disabled={loading}
            style={[
              styles.submitBtn, 
              { 
                backgroundColor: isReschedule ? theme.colors.warning : theme.colors.secondary,
                elevation: 1,
              }
            ]}
          >
            {loading ? (
              <ActivityIndicator color={theme.dark ? theme.colors.background : '#FFFFFF'} size="small" />
            ) : (
              <View style={styles.btnContent}>
                <MaterialCommunityIcons 
                  name="calendar-check" 
                  size={20} 
                  color={theme.dark ? theme.colors.background : '#FFFFFF'} 
                  style={{ marginRight: 8 }} 
                />
                <Text style={[styles.submitBtnText, { color: theme.dark ? theme.colors.background : '#FFFFFF' }]}>
                  {isReschedule ? 'Confirm Rescheduling' : 'Confirm Appointment Booking'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 46,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 60,
  },
  backBtnText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    marginLeft: 4,
  },
  navTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  scrollContent: {
    padding: 12,
    paddingBottom: 24,
  },
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    gap: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
  },
  selectedGarageIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  plate: {
    backgroundColor: '#FFD300',
    borderWidth: 1.5,
    borderColor: '#000',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  plateText: {
    fontFamily: fonts.bold,
    color: '#000',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  vehicleMakeModel: {
    fontFamily: fonts.bold,
    fontSize: 14,
    marginBottom: 1,
  },
  vehicleSubText: {
    fontFamily: fonts.regular,
    fontSize: 11,
  },
  sectionHeading: {
    fontFamily: fonts.bold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  calendarCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  calNavBtn: {
    padding: 2,
  },
  calendarTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
    paddingBottom: 4,
    marginBottom: 6,
  },
  weekdayText: {
    fontFamily: fonts.semiBold,
    width: '14.2%',
    textAlign: 'center',
    fontSize: 10,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 6,
  },
  dayCell: {
    width: '14.2%',
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayCellText: {
    fontFamily: fonts.medium,
    fontSize: 11,
  },
  timePickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
    marginBottom: 12,
  },
  timeCard: {
    width: '48.5%',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  timeLabel: {
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  timeText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    marginTop: 1,
  },
  freeTag: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  emptySlotsNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
    marginBottom: 12,
  },
  notesInput: {
    fontFamily: fonts.regular,
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    fontSize: 12,
    height: 70,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  actionContainer: {
    marginBottom: 12,
  },
  submitBtn: {
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  submitBtnText: {
    fontFamily: fonts.bold,
    color: '#FFFFFF',
    fontSize: 13,
  },
  rescheduleNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  rescheduleNoticeText: {
    fontFamily: fonts.regular,
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
  },
  vehicleSelectorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    marginRight: 10,
    minWidth: 200,
  },
  garageSelectorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    marginRight: 10,
    width: 220,
  },
  currentBookingBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  addCarToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  addCarToggleText: {
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  inlineAddCarCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    marginVertical: 10,
  },
  inlineAddCarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  inlineAddCarTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  plateInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    backgroundColor: '#FFD300',
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 10,
  },
  ukPlateStrip: {
    width: 32,
    height: '100%',
    backgroundColor: '#0A4E9B',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 2,
  },
  ukFlagEmoji: {
    fontFamily: fonts.regular,
    fontSize: 10,
  },
  ukStripLabel: {
    fontFamily: fonts.bold,
    color: '#FFFFFF',
    fontSize: 8,
  },
  plateInputField: {
    fontFamily: fonts.bold,
    flex: 1,
    fontSize: 15,
    color: '#000000',
    textAlign: 'center',
    height: '100%',
    padding: 0,
    letterSpacing: 1,
  },
  plateLookupBtn: {
    height: '100%',
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  plateLookupBtnText: {
    fontFamily: fonts.bold,
    color: '#FFFFFF',
    fontSize: 11,
  },
  lookupSuccessBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B98115',
    borderColor: '#10B98140',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  lookupSuccessText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: '#10B981',
    flex: 1,
  },
  formRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  formCol: {
    flex: 1,
  },
  formLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    marginBottom: 4,
  },
  fieldErrorText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    marginTop: 4,
  },
  formInputField: {
    fontFamily: fonts.medium,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontSize: 13,
  },
  cancelCarFormBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelCarFormText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  saveCarSubmitBtn: {
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  saveCarSubmitBtnText: {
    fontFamily: fonts.bold,
    color: '#FFFFFF',
    fontSize: 13,
  },
});
