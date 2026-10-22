import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
  Modal,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Linking,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Toast from 'react-native-toast-message';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues, BASE_URL } from '../context/DataContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { openGarageDirections } from '../utils/mapUtils';
import { isServiceMatch } from '../components/FilterServiceBottomSheet';
import { validateMotExpiryDate } from '../utils/validationUtils';

const GarageLogo = ({ uri, name, style, theme }: any) => {
  const [error, setError] = useState(false);

  if (error || !uri) {
    return (
      <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.secondary + '20' }]}>
        <Text style={[styles.avatarText, { color: theme.colors.secondary }]}>
          {name ? name[0].toUpperCase() : 'G'}
        </Text>
      </View>
    );
  }

  return (
    <Image 
      source={{ uri }} 
      style={style} 
      onError={() => setError(true)} 
    />
  );
};

const GarageCarouselImage = ({ uri, style, width }: any) => {
  const [error, setError] = useState(false);

  if (error || !uri) {
    return (
      <View style={[style, { width, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6' }]}>
        <MaterialCommunityIcons name="image-off-outline" size={32} color="#9CA3AF" />
      </View>
    );
  }

  return (
    <Image 
      source={{ uri }} 
      style={style} 
      onError={() => setError(true)} 
    />
  );
};

export default function GarageDetailScreen({ route, navigation }: any) {
  const { theme } = useAppTheme();
  const { token, user, customers, vehicles, alerts = [], addAlert, addAudit, addVehicle, refreshData, lookupVehicle } = useAppValues();
  const { garageId } = route.params;
  const { width: screenWidth } = Dimensions.get('window');

  const [garage, setGarage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Booking Flow States
  const [isBookingModalVisible, setIsBookingModalVisible] = useState(false);
  const [selectedServices, setSelectedServices] = useState<any[]>([]);
  const selectedMotService = selectedServices[0] || null;
  const setSelectedMotService = (svc: any) => {
    if (!svc) setSelectedServices([]);
    else setSelectedServices([svc]);
  };
  const [selectedVehicle, setSelectedVehicle] = useState<any>(route?.params?.vehicle || route?.params?.selectedVehicle || null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [currentViewDate, setCurrentViewDate] = useState<Date>(() => new Date());
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [garageSlots, setGarageSlots] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submittingBooking, setSubmittingBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  // Multi-Service Select Helpers
  const hasMot = useMemo(() => {
    return selectedServices.some((s: any) => {
      const c = (s?.category || '').toLowerCase();
      const n = (s?.name || '').toLowerCase();
      return c.includes('mot') || n.includes('mot');
    });
  }, [selectedServices]);

  const isDateOnly = !hasMot;

  const totalSelectedPrice = useMemo(() => {
    return selectedServices.reduce((sum, s) => sum + (Number(s?.price) || 0), 0);
  }, [selectedServices]);

  const totalSelectedDuration = useMemo(() => {
    return selectedServices.reduce((sum, s) => sum + (Number(s?.duration) || 45), 0);
  }, [selectedServices]);

  const selectedServiceNames = useMemo(() => {
    return selectedServices.map(s => s?.name).filter(Boolean).join(', ');
  }, [selectedServices]);

  const isServiceSelected = useCallback((service: any) => {
    if (!service) return false;
    const targetId = service._id || service.id;
    const targetName = service.name;
    return selectedServices.some(s => (targetId && (s._id === targetId || s.id === targetId)) || s.name === targetName);
  }, [selectedServices]);

  const toggleSelectService = useCallback((service: any) => {
    if (!service) return;
    const targetId = service._id || service.id;
    const targetName = service.name;
    setSelectedServices(prev => {
      const exists = prev.some(s => (targetId && (s._id === targetId || s.id === targetId)) || s.name === targetName);
      if (exists) {
        return prev.filter(s => !((targetId && (s._id === targetId || s.id === targetId)) || s.name === targetName));
      } else {
        return [...prev, service];
      }
    });
  }, []);

  const removeServiceFromSelection = useCallback((service: any) => {
    const targetId = service._id || service.id;
    const targetName = service.name;
    setSelectedServices(prev => prev.filter(s => !((targetId && (s._id === targetId || s.id === targetId)) || s.name === targetName)));
  }, []);
  const [isInfoModalVisible, setIsInfoModalVisible] = useState(false);
  const [isGalleryModalVisible, setIsGalleryModalVisible] = useState(false);
  const [selectedGalleryIndex, setSelectedGalleryIndex] = useState(0);

  // Inline Add Vehicle in Booking Modal states
  const [showAddCarForm, setShowAddCarForm] = useState(false);
  const [newRegNo, setNewRegNo] = useState('');
  const [newMake, setNewMake] = useState('');
  const [newModel, setNewModel] = useState('');
  const [newYear, setNewYear] = useState('');
  const [newExpiry, setNewExpiry] = useState('');
  const [isSearchingNewPlate, setIsSearchingNewPlate] = useState(false);
  const [newLookupInfo, setNewLookupInfo] = useState<string | null>(null);
  const [isAddingCar, setIsAddingCar] = useState(false);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);

  // All photos associated with the garage for info & full gallery modal
  const displayGarageImages = useMemo(() => {
    if (!garage) return [];
    const list: string[] = [];
    if (Array.isArray(garage.images)) {
      garage.images.forEach((img: any) => {
        if (typeof img === 'string' && img.trim() && !list.includes(img.trim())) {
          list.push(img.trim());
        }
      });
    }
    if (garage.coverImage && typeof garage.coverImage === 'string' && garage.coverImage.trim() && !list.includes(garage.coverImage.trim())) {
      list.unshift(garage.coverImage.trim());
    }
    if (garage.logoUrl && typeof garage.logoUrl === 'string' && garage.logoUrl.trim() && !list.includes(garage.logoUrl.trim())) {
      list.push(garage.logoUrl.trim());
    }
    if (list.length === 0) {
      list.push('https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=800&fit=crop');
    }
    return list;
  }, [garage]);

  const fetchGarageDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${BASE_URL}/garages/${garageId}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        throw new Error('Failed to load garage details.');
      }
      const data = await response.json();
      setGarage(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Could not connect to server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGarageDetails();
  }, [garageId, token]);

  // Active customer & vehicles resolution
  const customerId = user?.customerId || user?.id || 'c1';
  const customer: any = customers.find((c) =>
    String(c.id).toLowerCase() === String(customerId).toLowerCase() ||
    String(c._id).toLowerCase() === String(customerId).toLowerCase()
  ) || {
    id: customerId,
    _id: customerId,
    firstName: user?.name?.split(' ')[0] || 'Customer',
    lastName: user?.name?.split(' ').slice(1).join(' ') || '',
    email: user?.email || '',
    mobile: '',
  };

  const activeCustomerVehicles = useMemo(() => {
    return vehicles.filter((v) =>
      (
        (v.customerId && (
          String(v.customerId).toLowerCase() === String(customer.id).toLowerCase() ||
          String(v.customerId).toLowerCase() === String(customer._id || '').toLowerCase() ||
          String(v.customerId).toLowerCase() === String(user?.id || '').toLowerCase()
        )) ||
        (!v.customerId && user?.role === 'customer')
      ) && v.status !== 'Sold' && v.status !== 'Scrapped'
    );
  }, [vehicles, customer, user]);

  const getDaysUntilExpiry = (expiryDateStr?: string) => {
    if (!expiryDateStr) return -1;
    const expiryDate = new Date(expiryDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = expiryDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  useEffect(() => {
    if (!selectedVehicle) {
      if (route?.params?.vehicle) {
        setSelectedVehicle(route.params.vehicle);
      } else if (activeCustomerVehicles.length > 0) {
        // Automatically pre-select the first vehicle that is fully eligible
        const eligibleVeh = activeCustomerVehicles.find(v => {
          const days = getDaysUntilExpiry(v.motExpiryDate);
          const isPending = v.status === 'Pending' || v.status === 'Rejected';
          const hasBooking = alerts.some(a => 
            a.type === 'BOOKED' && 
            a.registrationNumber?.toUpperCase() === v.registrationNumber?.toUpperCase() && 
            (a.status === 'Pending' || a.status === 'Approved')
          );
          return days <= 30 && !isPending && !hasBooking;
        });
        setSelectedVehicle(eligibleVeh || activeCustomerVehicles[0]);
      }
    }
  }, [route?.params?.vehicle, activeCustomerVehicles, selectedVehicle, alerts]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const formatLocalDate = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const getDaysInMonth = (year: number, month: number) => {
    const date = new Date(year, month, 1);
    const days: (Date | null)[] = [];
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

  const isDateSelectable = useCallback((date: Date | null) => {
    if (!date) return false;
    const currentToday = new Date();
    currentToday.setHours(0, 0, 0, 0);

    const d = new Date(date);
    d.setHours(0, 0, 0, 0);

    // Never allow past days
    if (d < currentToday) return false;

    // Working days check according to garage workingDays
    const workingDays = garage?.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const daysMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = daysMap[d.getDay()];
    const isWorkingDay = workingDays.some((w: string) => w.toLowerCase() === dayName.toLowerCase());
    if (!isWorkingDay) return false;

    // DVSA 30-day pre-booking rule check
    if (selectedVehicle?.motExpiryDate) {
      const expDate = new Date(selectedVehicle.motExpiryDate);
      expDate.setHours(0, 0, 0, 0);
      const daysLeft = Math.ceil((expDate.getTime() - currentToday.getTime()) / (1000 * 60 * 60 * 24));

      if (daysLeft > 30) {
        // Only allow dates within the 30-day window leading up to expiry
        const windowStart = new Date(expDate);
        windowStart.setDate(windowStart.getDate() - 30);
        windowStart.setHours(0, 0, 0, 0);

        if (d < windowStart || d > expDate) {
          return false;
        }
      }
    }

    return true;
  }, [garage?.workingDays, selectedVehicle]);

  const getFirstSelectableDate = useCallback((forVehicle?: any) => {
    const veh = forVehicle !== undefined ? forVehicle : selectedVehicle;
    const currentToday = new Date();
    currentToday.setHours(0, 0, 0, 0);

    const workingDays = garage?.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const daysMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    let start = new Date(currentToday);
    if (veh?.motExpiryDate) {
      const expDate = new Date(veh.motExpiryDate);
      expDate.setHours(0, 0, 0, 0);
      const daysLeft = Math.ceil((expDate.getTime() - currentToday.getTime()) / (1000 * 60 * 60 * 24));
      if (daysLeft > 30) {
        const windowStart = new Date(expDate);
        windowStart.setDate(windowStart.getDate() - 30);
        windowStart.setHours(0, 0, 0, 0);
        if (windowStart > start) {
          start = windowStart;
        }
      }
    }

    // Scan up to 90 days ahead for the first valid working day
    for (let i = 0; i < 90; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dayName = daysMap[d.getDay()];
      const isWorkingDay = workingDays.some((w: string) => w.toLowerCase() === dayName.toLowerCase());
      if (isWorkingDay) {
        return d;
      }
    }
    return currentToday;
  }, [garage?.workingDays, selectedVehicle]);

  const handlePrevMonth = () => {
    const prev = new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() - 1, 1);
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    if (prev < currentMonthStart) {
      return;
    }
    setCurrentViewDate(prev);
  };

  const handleNextMonth = () => {
    const next = new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() + 1, 1);
    setCurrentViewDate(next);
  };

  const isPrevMonthDisabled = useMemo(() => {
    const now = new Date();
    return currentViewDate.getFullYear() === now.getFullYear() && currentViewDate.getMonth() <= now.getMonth();
  }, [currentViewDate]);

  const calendarDays = useMemo(() => {
    return getDaysInMonth(currentViewDate.getFullYear(), currentViewDate.getMonth());
  }, [currentViewDate]);

  // Fetch live 45-min slots for selected date
  const fetchSlotsForDate = useCallback(async (dateStr: string) => {
    const targetId = garage?.id || garage?._id || garageId;
    if (!targetId || !dateStr) return;
    setLoadingSlots(true);
    try {
      const res = await fetch(`${BASE_URL}/garages/${targetId}/slots?date=${dateStr}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
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
  }, [garage, garageId, token]);

  // Sync selectedDate and currentViewDate if selectedVehicle changes or date becomes invalid
  useEffect(() => {
    if (selectedVehicle) {
      const firstValid = getFirstSelectableDate(selectedVehicle);
      const firstValidStr = formatLocalDate(firstValid);
      if (selectedDate) {
        const parts = selectedDate.split('-').map(Number);
        if (parts.length === 3) {
          const curDate = new Date(parts[0], parts[1] - 1, parts[2]);
          if (!isDateSelectable(curDate)) {
            setSelectedDate(firstValidStr);
            setCurrentViewDate(new Date(firstValid.getFullYear(), firstValid.getMonth(), 1));
          }
        } else {
          setSelectedDate(firstValidStr);
          setCurrentViewDate(new Date(firstValid.getFullYear(), firstValid.getMonth(), 1));
        }
      } else {
        setSelectedDate(firstValidStr);
        setCurrentViewDate(new Date(firstValid.getFullYear(), firstValid.getMonth(), 1));
      }
    }
  }, [selectedVehicle, isDateSelectable, getFirstSelectableDate, selectedDate]);

  useEffect(() => {
    if (selectedDate && isBookingModalVisible) {
      fetchSlotsForDate(selectedDate);
    }
  }, [selectedDate, isBookingModalVisible, fetchSlotsForDate]);

  const isTimeSlotPassed = (slotTimeStr: string, dateStr: string) => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const todayISO = `${y}-${m}-${d}`;
    if (dateStr !== todayISO) return false;

    const currentHour = today.getHours();
    const currentMin = today.getMinutes();

    const match24 = slotTimeStr.match(/^(\d{1,2}):(\d{2})/);
    if (match24) {
      const hour = parseInt(match24[1], 10);
      const min = parseInt(match24[2], 10);
      return currentHour > hour || (currentHour === hour && currentMin >= min);
    }
    return false;
  };

  const freeSlots = useMemo(() => {
    return garageSlots.filter((s: any) => {
      if (s.isBlocked) return false;
      if (s.status === 'Full' || (s.availableCount !== undefined && s.availableCount <= 0)) return false;
      if (isTimeSlotPassed(s.time, selectedDate)) return false;
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
      console.error('[GarageDetailScreen] lookup error:', err);
      Alert.alert(
        'Lookup Failed',
        err.message || `Could not find registration "${newRegNo.trim().toUpperCase()}". Please enter vehicle details manually.`
      );
    } finally {
      setIsSearchingNewPlate(false);
    }
  };

  const handleSaveNewCar = async () => {
    const regClean = newRegNo.trim().toUpperCase();
    const makeClean = newMake.trim().toUpperCase();
    const modelClean = newModel.trim().toUpperCase();
    const yearClean = newYear.trim();
    const expiryClean = newExpiry.trim();

    if (!regClean || !makeClean || !modelClean || !yearClean || !expiryClean) {
      Alert.alert('Missing Details', 'Please fill in registration, make, model, year, and MOT expiry date.');
      return;
    }

    if (!/^\d{4}$/.test(yearClean)) {
      Alert.alert('Invalid Year', 'Please enter a valid 4-digit manufacture year (e.g. 2019).');
      return;
    }

    const expiryCheck = validateMotExpiryDate(expiryClean);
    if (expiryCheck.error) {
      Alert.alert('Validation Error', expiryCheck.error);
      return;
    }

    setIsAddingCar(true);
    try {
      const createdVeh = await addVehicle({
        customerId: customer.id,
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
        customerId: customer.id,
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
      Alert.alert('Registration Failed', err.message || 'Could not add vehicle. Please check the details and try again.');
    } finally {
      setIsAddingCar(false);
    }
  };

  const handleOpenBookingModal = (service?: any) => {
    if (!token) {
      Alert.alert(
        'Authentication Required',
        'Please sign in to book your appointment.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => navigation.navigate('Login') }
        ]
      );
      return;
    }

    if (service) {
      if (!isServiceSelected(service)) {
        setSelectedServices(prev => [...prev, service]);
      }
    } else if (selectedServices.length === 0 && allActiveServices.length > 0) {
      setSelectedServices([allActiveServices[0]]);
    }

    setBookingSuccess(false);
    setIsBookingModalVisible(true);

    let targetVehicle = selectedVehicle;
    if (activeCustomerVehicles.length === 0) {
      setShowAddCarForm(true);
    } else if (!selectedVehicle) {
      const eligibleVeh = activeCustomerVehicles.find(v => {
        const days = getDaysUntilExpiry(v.motExpiryDate);
        const isPending = v.status === 'Pending' || v.status === 'Rejected';
        const hasBooking = alerts.some(a => 
          a.type === 'BOOKED' && 
          a.registrationNumber?.toUpperCase() === v.registrationNumber?.toUpperCase() && 
          (a.status === 'Pending' || a.status === 'Approved')
        );
        return days <= 30 && !isPending && !hasBooking;
      });
      targetVehicle = eligibleVeh || activeCustomerVehicles[0];
      setSelectedVehicle(targetVehicle);
    }

    const firstValid = getFirstSelectableDate(targetVehicle);
    const firstDate = formatLocalDate(firstValid);
    if (firstDate) {
      setSelectedDate(firstDate);
      setCurrentViewDate(new Date(firstValid.getFullYear(), firstValid.getMonth(), 1));
      fetchSlotsForDate(firstDate);
    }
  };

  const handleConfirmBooking = async () => {
    if (selectedServices.length === 0) {
      Alert.alert('No Services Selected', 'Please select at least one service to book.');
      return;
    }

    if (!selectedVehicle) {
      Alert.alert('Error', 'Please select a vehicle to book.');
      return;
    }

    if (selectedVehicle.status === 'Pending') {
      Alert.alert(
        'Registration Pending Approval',
        `The registration for ${selectedVehicle.registrationNumber} is currently pending approval by garage staff. You can book once it is verified.`
      );
      return;
    }

    if (selectedVehicle.status === 'Rejected') {
      Alert.alert(
        'Vehicle Registration Rejected',
        `The registration for ${selectedVehicle.registrationNumber} was rejected by garage staff.`
      );
      return;
    }

    const pendingBooking = alerts.find(a => 
      a.type === 'BOOKED' && 
      a.registrationNumber?.toUpperCase() === selectedVehicle.registrationNumber?.toUpperCase() &&
      a.status === 'Pending'
    );
    if (pendingBooking) {
      Alert.alert(
        'Booking Pending Approval',
        `An appointment request for ${selectedVehicle.registrationNumber} is already awaiting confirmation by garage staff.`
      );
      return;
    }

    const activeBooking = alerts.find(a => 
      a.type === 'BOOKED' && 
      a.registrationNumber?.toUpperCase() === selectedVehicle.registrationNumber?.toUpperCase() &&
      a.status === 'Approved'
    );
    if (activeBooking) {
      Alert.alert(
        'Vehicle Already Booked',
        `${selectedVehicle.registrationNumber} already has an active booking.`
      );
      return;
    }

    const daysLeft = getDaysUntilExpiry(selectedVehicle.motExpiryDate);
    // If vehicle is in pre-booking mode (>30 days away) and booking contains MOT, ensure booking date is within the 30-day window before expiry
    if (hasMot && daysLeft > 30) {
      const expDate = new Date(selectedVehicle.motExpiryDate);
      const minDate = new Date(expDate);
      minDate.setDate(minDate.getDate() - 30);
      minDate.setHours(0, 0, 0, 0);
      const selD = new Date(selectedDate);
      selD.setHours(0, 0, 0, 0);
      if (selD < minDate) {
        Alert.alert(
          'Pre-Booking Window',
          `Under DVSA rules, MOT pre-booking slots must be within 30 days of your expiry date (${formatDisplayDate(selectedVehicle.motExpiryDate)}).\nPlease select an appointment date on or after ${formatDisplayDate(minDate.toISOString())}.`
        );
        return;
      }
    }

    if (!selectedDate) {
      Alert.alert('Error', 'Please select an appointment date.');
      return;
    }

    if (hasMot && !selectedTime) {
      Alert.alert('Error', 'Please select an available MOT test slot.');
      return;
    }

    setSubmittingBooking(true);
    try {
      const targetGarageId = garage.id || garage._id || garageId;
      const targetPrice = totalSelectedPrice;
      const targetDuration = totalSelectedDuration;
      const targetSlotTime = hasMot ? (selectedSlot?.time || selectedTime) : 'Full Day Drop-off';

      await addAlert({
        type: 'BOOKED',
        customerName: `${customer.firstName} ${customer.lastName}`.trim() || user?.name || 'Customer',
        customerId: customer.id,
        garageId: targetGarageId,
        serviceName: selectedServiceNames,
        services: selectedServices.map((s: any) => ({
          name: s.name,
          category: s.category || 'Servicing',
          price: Number(s.price) || 0,
          duration: Number(s.duration) || 45,
        })),
        hasMot,
        isDateOnly: !hasMot,
        price: targetPrice,
        duration: targetDuration,
        slotTime: targetSlotTime,
        slotNumber: hasMot ? selectedSlot?.slotNumber : undefined,
        registrationNumber: selectedVehicle.registrationNumber,
        makeModel: `${selectedVehicle.make} ${selectedVehicle.model}`.trim(),
        status: 'Pending',
        date: selectedDate,
      });

      await addAudit(
        hasMot ? 'MOT & Service Booking Requested' : 'Workshop Service Booking Requested',
        `${customer.firstName} ${customer.lastName} requested ${selectedServiceNames} for ${selectedVehicle.make} ${selectedVehicle.model} (${selectedVehicle.registrationNumber}) at ${garage.name} on ${selectedDate} (${hasMot ? `Slot: ${targetSlotTime}` : 'Workshop Drop-off'})`
      );

      setSubmittingBooking(false);
      setBookingSuccess(true);
      refreshData();

      Toast.show({
        type: 'success',
        text1: 'Booking Requested!',
        text2: hasMot 
          ? `MOT slot requested for ${selectedDate} at ${targetSlotTime}`
          : `Workshop drop-off requested for ${selectedDate}`,
      });
    } catch (err: any) {
      setSubmittingBooking(false);
      console.error('Booking confirmation failed:', err);
      Alert.alert('Booking Error', err.message || 'Could not confirm booking. Please try again.');
    }
  };

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${parseInt(parts[2], 10)} ${months[parseInt(parts[1], 10) - 1]} ${parts[0]}`;
    }
    return dateStr;
  };

  // Helper for category badge icons and colors
  const getCategoryIcon = (category: string = '', name: string = '') => {
    const c = (category + ' ' + name).toLowerCase();
    if (c.includes('mot')) return 'shield-check';
    if (c.includes('tyre') || c.includes('wheel') || c.includes('tracking')) return 'tire';
    if (c.includes('brake') || c.includes('pad') || c.includes('disc')) return 'car-brake-alert';
    if (c.includes('diag') || c.includes('scan') || c.includes('code') || c.includes('engine management')) return 'engine';
    if (c.includes('air con') || c.includes('ac ') || c.includes('regas') || c.includes('climate')) return 'snowflake';
    if (c.includes('oil') || c.includes('filter') || c.includes('fluid')) return 'oil';
    if (c.includes('exhaust') || c.includes('dpf') || c.includes('emission')) return 'car-windshield';
    if (c.includes('repair') || c.includes('clutch') || c.includes('engine') || c.includes('suspension')) return 'wrench';
    return 'car-wrench';
  };

  const getCategoryTheme = (category: string = '', name: string = '') => {
    const c = (category + ' ' + name).toLowerCase();
    if (c.includes('mot')) return { bg: '#10B98115', text: '#10B981', border: '#10B98140' };
    if (c.includes('brake')) return { bg: '#EF444415', text: '#EF4444', border: '#EF444440' };
    if (c.includes('diag')) return { bg: '#8B5CF615', text: '#8B5CF6', border: '#8B5CF640' };
    if (c.includes('air con') || c.includes('ac')) return { bg: '#06B6D415', text: '#06B6D4', border: '#06B6D440' };
    if (c.includes('tyre') || c.includes('wheel')) return { bg: '#F59E0B15', text: '#F59E0B', border: '#F59E0B40' };
    if (c.includes('repair')) return { bg: '#EC489915', text: '#EC4899', border: '#EC489940' };
    return { bg: theme.colors.secondary + '15', text: theme.colors.secondary, border: theme.colors.secondary + '40' };
  };

  // Target service selected from Home / GarageList
  const targetServiceQuery = route?.params?.serviceName || route?.params?.serviceFilter || route?.params?.serviceTitle || '';

  // State for services category filtering & search
  const [selectedServiceCategory, setSelectedServiceCategory] = useState<string>('All');
  const [serviceSearchText, setServiceSearchText] = useState<string>('');

  // Extract all active garage services
  const allActiveServices = useMemo(() => {
    if (!garage?.services || !Array.isArray(garage.services) || garage.services.length === 0) {
      return [];
    }
    const active = garage.services.filter((s: any) => s.isActive !== false);
    return active.length > 0 ? active : garage.services;
  }, [garage?.services]);

  // Unique categories list
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    allActiveServices.forEach((s: any) => {
      if (s.category && s.category.trim()) {
        cats.add(s.category.trim());
      } else {
        cats.add('Servicing');
      }
    });
    return ['All', ...Array.from(cats)];
  }, [allActiveServices]);

  // Filtered services by category & search query
  const displayServices = useMemo(() => {
    let list = allActiveServices.filter((s: any) => {
      const sCat = (s.category || 'Servicing').trim();
      const matchCat = selectedServiceCategory === 'All' || sCat.toLowerCase() === selectedServiceCategory.toLowerCase();
      
      const q = serviceSearchText.trim().toLowerCase();
      if (!q) return matchCat;

      const isMotSearch = /\bmot\b/i.test(q);
      const isMotService = /\bmot\b/i.test(s.name || '') || /\bmot\b/i.test(sCat);
      if (isMotSearch && isMotService) {
        return matchCat;
      }

      const matchQuery =
        isServiceMatch(s, q) ||
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.description && s.description.toLowerCase().includes(q)) ||
        (s.category && s.category.toLowerCase().includes(q));
      
      return matchCat && matchQuery;
    });

    // If a target service was selected from Home/GarageList, sort matching service(s) to top!
    if (targetServiceQuery && !serviceSearchText) {
      list = [...list].sort((a: any, b: any) => {
        const aMatch = isServiceMatch(a, targetServiceQuery) ? 1 : 0;
        const bMatch = isServiceMatch(b, targetServiceQuery) ? 1 : 0;
        return bMatch - aMatch;
      });
    }

    return list;
  }, [allActiveServices, selectedServiceCategory, serviceSearchText, targetServiceQuery]);

  // Flow B Support: Auto-open booking modal if arriving with autoOpenBooking param
  useEffect(() => {
    if (garage && route?.params?.autoOpenBooking && !hasAutoOpened && allActiveServices.length > 0) {
      setHasAutoOpened(true);
      const targetQuery = route?.params?.serviceName || route?.params?.serviceFilter || '';
      const matchedSvc = allActiveServices.find((s: any) =>
        targetQuery ? isServiceMatch(s, targetQuery) : false
      ) || allActiveServices[0];
      if (matchedSvc) {
        handleOpenBookingModal(matchedSvc);
      }
    }
  }, [garage, route?.params?.autoOpenBooking, route?.params?.serviceName, route?.params?.serviceFilter, hasAutoOpened, allActiveServices]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.topHeaderBar, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBackBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.topHeaderTitle, { color: theme.colors.text }]} numberOfLines={1}>Loading Garage...</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={{ marginTop: 12, color: theme.colors.text }}>Loading garage details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !garage) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.topHeaderBar, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBackBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.topHeaderTitle, { color: theme.colors.text }]} numberOfLines={1}>Garage Details</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={theme.colors.error} />
          <Text style={{ marginTop: 12, fontSize: 16, color: theme.colors.text, textAlign: 'center' }}>
            {error || 'Garage details not found.'}
          </Text>
          <TouchableOpacity style={[styles.retryButton, { backgroundColor: theme.colors.primary }]} onPress={fetchGarageDetails}>
            <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* 1. Top Header Bar: Garage Name as title & Info Icon */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: theme.colors.card }}>
        <View style={[styles.topHeaderBar, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.headerBackBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.text} />
          </TouchableOpacity>

          <Text style={[styles.topHeaderTitle, { color: theme.colors.text }]} numberOfLines={1}>
            {garage?.name || 'Garage Profile'}
          </Text>

          <TouchableOpacity
            onPress={() => setIsInfoModalVisible(true)}
            style={styles.headerInfoBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialCommunityIcons name="information-outline" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Horizontal Padded Content Container */}
        <View style={styles.contentContainer}>
          {/* Garage Services & Pricing Catalog - Starts directly with Services & Pricing */}
          <View style={styles.servicesSection}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <View>
                <Text style={[styles.sectionTitle, { color: theme.colors.text, marginBottom: 2 }]}>
                  Services & Pricing
                </Text>
                <Text style={{ fontSize: 12, color: theme.colors.placeholder }}>
                  {allActiveServices.length} {allActiveServices.length === 1 ? 'service' : 'services'} available to book
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.primary + '15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                <MaterialCommunityIcons name="shield-check" size={14} color={theme.colors.primary} style={{ marginRight: 4 }} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.primary }}>DVSA Certified</Text>
              </View>
            </View>

            {/* Category Filter Tabs */}
            {availableCategories.length > 1 && (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                style={{ marginVertical: 8 }}
                contentContainerStyle={{ gap: 8 }}
              >
                {availableCategories.map((cat) => {
                  const isSelected = selectedServiceCategory === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => {
                        setSelectedServiceCategory(cat);
                        setServiceSearchText('');
                      }}
                      style={[
                        styles.categoryPill,
                        {
                          backgroundColor: isSelected ? theme.colors.primary : theme.colors.card,
                          borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                        }
                      ]}
                    >
                      <Text style={[
                        styles.categoryPillText,
                        { color: isSelected ? '#FFFFFF' : theme.colors.text, fontWeight: isSelected ? '700' : '600' }
                      ]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* Search Input for Services if 3+ services */}
            {allActiveServices.length > 3 && (
              <View style={[styles.serviceSearchBox, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <MaterialCommunityIcons name="magnify" size={16} color={theme.colors.placeholder} style={{ marginRight: 6 }} />
                <TextInput
                  value={serviceSearchText}
                  onChangeText={setServiceSearchText}
                  placeholder="Search services (e.g. Brake, Service, MOT, AC)..."
                  placeholderTextColor={theme.colors.placeholder}
                  style={[styles.serviceSearchInput, { color: theme.colors.text }]}
                />
                {serviceSearchText.length > 0 && (
                  <TouchableOpacity onPress={() => setServiceSearchText('')}>
                    <MaterialCommunityIcons name="close-circle" size={16} color={theme.colors.placeholder} />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Services Cards List */}
            {displayServices.length === 0 ? (
              <View style={[styles.serviceEmptyBox, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <MaterialCommunityIcons name="wrench-outline" size={28} color={theme.colors.placeholder} />
                <Text style={[styles.serviceEmptyText, { color: theme.colors.placeholder }]}>
                  No services matching "{serviceSearchText}".
                </Text>
              </View>
            ) : (
              displayServices.map((service: any) => {
                const catTheme = getCategoryTheme(service.category, service.name);
                const catIcon = getCategoryIcon(service.category, service.name);
                const isMot = (service.category || '').toLowerCase().includes('mot') || (service.name || '').toLowerCase().includes('mot');
                const isSelectedService = Boolean(targetServiceQuery && isServiceMatch(service, targetServiceQuery));

                return (
                  <View 
                    key={service._id || service.id || service.name} 
                    style={[
                      styles.serviceCard, 
                      { 
                        backgroundColor: theme.colors.card, 
                        borderColor: isSelectedService ? theme.colors.primary : theme.colors.border,
                        borderWidth: isSelectedService ? 1.5 : 1,
                      }
                    ]}
                  >
                    {/* Selected Service Badge Indicator */}
                    {isSelectedService && (
                      <View style={{ marginBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ backgroundColor: theme.colors.primary + '18', borderColor: theme.colors.primary + '40', borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2.5, borderRadius: 6, flexDirection: 'row', alignItems: 'center' }}>
                          <MaterialCommunityIcons name="star-circle" size={13} color={theme.colors.primary} style={{ marginRight: 4 }} />
                          <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.primary }}>Selected Service</Text>
                        </View>
                      </View>
                    )}

                    {/* Top Row: Icon, Name & Category Badge */}
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                      <View style={[styles.serviceIconCircle, { backgroundColor: catTheme.bg }]}>
                        <MaterialCommunityIcons name={catIcon} size={22} color={catTheme.text} />
                      </View>
                      
                      <View style={styles.serviceInfo}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                          <Text style={[styles.serviceName, { color: theme.colors.text }]}>
                            {service.name}
                          </Text>
                          <View style={[styles.categoryBadge, { backgroundColor: catTheme.bg, borderColor: catTheme.border }]}>
                            <Text style={[styles.categoryBadgeText, { color: catTheme.text }]}>
                              {service.category || (isMot ? 'MOT' : 'Servicing')}
                            </Text>
                          </View>
                        </View>

                        {/* Timing / Duration */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, flexWrap: 'wrap', gap: 10 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <MaterialCommunityIcons name="clock-time-four-outline" size={13} color={theme.colors.placeholder} style={{ marginRight: 4 }} />
                            <Text style={[styles.serviceMeta, { color: theme.colors.placeholder }]}>
                              {service.duration || 45} mins
                            </Text>
                          </View>

                          {service.availability && Array.isArray(service.availability) && service.availability.length > 0 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <MaterialCommunityIcons name="calendar-check-outline" size={13} color={theme.colors.placeholder} style={{ marginRight: 4 }} />
                              <Text style={[styles.serviceMeta, { color: theme.colors.placeholder }]}>
                                {service.availability.length === 7 
                                  ? 'All Week' 
                                  : `${service.availability.length} Days/wk`}
                              </Text>
                            </View>
                          )}
                        </View>

                        {/* Description */}
                        {service.description ? (
                          <Text style={[styles.serviceDescText, { color: theme.colors.placeholder }]} numberOfLines={3}>
                            {service.description}
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    {/* Bottom Action Row: Pricing, Multi-Select Checkbox & Book Button */}
                    <View style={[styles.serviceCardBottomRow, { borderTopColor: theme.colors.border + '50' }]}>
                      <View>
                        <Text style={{ fontSize: 10, color: theme.colors.placeholder, fontWeight: '700', textTransform: 'uppercase' }}>
                          Standard Rate
                        </Text>
                        <Text style={[styles.servicePriceText, { color: theme.colors.text }]}>
                          £{service.price ? Number(service.price).toFixed(2) : '0.00'}
                        </Text>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <TouchableOpacity
                          style={[
                            styles.serviceSelectToggleBtn,
                            {
                              backgroundColor: isServiceSelected(service) ? theme.colors.primary + '18' : theme.colors.card,
                              borderColor: isServiceSelected(service) ? theme.colors.primary : theme.colors.border,
                            }
                          ]}
                          onPress={() => toggleSelectService(service)}
                          activeOpacity={0.7}
                        >
                          <MaterialCommunityIcons
                            name={isServiceSelected(service) ? "checkbox-marked-circle" : "plus-circle-outline"}
                            size={16}
                            color={isServiceSelected(service) ? theme.colors.primary : theme.colors.placeholder}
                            style={{ marginRight: 4 }}
                          />
                          <Text style={[
                            styles.serviceSelectToggleText,
                            { color: isServiceSelected(service) ? theme.colors.primary : theme.colors.text, fontWeight: isServiceSelected(service) ? '700' : '600' }
                          ]}>
                            {isServiceSelected(service) ? 'Selected' : 'Select'}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.bookBtn, { backgroundColor: theme.colors.primary }]}
                          onPress={() => handleOpenBookingModal(service)}
                          activeOpacity={0.8}
                        >
                          <MaterialCommunityIcons name="calendar-plus" size={15} color="#FFFFFF" style={{ marginRight: 4 }} />
                          <Text style={styles.bookBtnText}>
                            Book Now
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>

      {/* Floating Bottom Bar when services are selected */}
      {selectedServices.length > 0 && !isBookingModalVisible && (
        <View style={[styles.floatingBottomBar, { backgroundColor: theme.colors.card, borderTopColor: theme.colors.border }]}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="check-circle" size={16} color={theme.colors.primary} style={{ marginRight: 5 }} />
              <Text style={[styles.floatingBarTitle, { color: theme.colors.text }]}>
                {selectedServices.length} {selectedServices.length === 1 ? 'Service' : 'Services'} Selected
              </Text>
            </View>
            <Text style={[styles.floatingBarSubtitle, { color: theme.colors.primary, fontWeight: '700' }]}>
              Total: £{totalSelectedPrice.toFixed(2)} • {hasMot ? '45-Min MOT Slot' : 'Workshop Drop-off'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.floatingBarActionBtn, { backgroundColor: theme.colors.primary }]}
            onPress={() => handleOpenBookingModal()}
            activeOpacity={0.85}
          >
            <Text style={styles.floatingBarActionText}>Book Garage</Text>
            <MaterialCommunityIcons name="arrow-right" size={16} color="#FFFFFF" style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        </View>
      )}

      {/* Garage Info Modal */}
      <Modal
        visible={isInfoModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsInfoModalVisible(false)}
      >
        <View style={styles.infoModalOverlay}>
          <View style={[styles.infoModalContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            {/* Modal Header */}
            <View style={[styles.infoModalHeader, { borderBottomColor: theme.colors.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <MaterialCommunityIcons name="information" size={22} color={theme.colors.primary} style={{ marginRight: 8 }} />
                <Text style={[styles.infoModalTitle, { color: theme.colors.text }]} numberOfLines={1}>
                  Garage Information
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsInfoModalVisible(false)}
                style={[styles.infoModalCloseBtn, { backgroundColor: theme.colors.background }]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialCommunityIcons name="close" size={20} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.infoModalBody}>
              {/* Garage Quick Summary - Click image to view all photos */}
              <View style={styles.infoModalSummaryRow}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    setSelectedGalleryIndex(0);
                    setIsGalleryModalVisible(true);
                  }}
                  style={styles.infoModalLogoTouch}
                >
                  <GarageLogo
                    uri={garage.logoUrl || (garage.images && garage.images.length > 0 ? garage.images[0] : null)}
                    name={garage.name}
                    style={styles.infoModalLogo}
                    theme={theme}
                  />
                  <View style={styles.photoCountBadge}>
                    <MaterialCommunityIcons name="camera" size={11} color="#FFFFFF" />
                    <Text style={styles.photoCountBadgeText}>
                      {displayGarageImages.length}
                    </Text>
                  </View>
                </TouchableOpacity>

                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.infoModalGarageName, { color: theme.colors.text }]}>
                    {garage.name}
                  </Text>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                      setSelectedGalleryIndex(0);
                      setIsGalleryModalVisible(true);
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}
                  >
                    <MaterialCommunityIcons name="image-multiple-outline" size={13} color={theme.colors.primary} />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.primary, marginLeft: 3 }}>
                      {displayGarageImages.length > 1 ? `View all ${displayGarageImages.length} photos` : 'View photo'}
                    </Text>
                  </TouchableOpacity>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    <MaterialCommunityIcons name="star" size={16} color="#F59E0B" />
                    <Text style={[styles.ratingText, { color: theme.colors.text, marginLeft: 4 }]}>
                      {garage.rating ? garage.rating.toFixed(1) : '4.5'}
                    </Text>
                    {garage.city ? (
                      <Text style={{ color: theme.colors.placeholder, marginLeft: 8, fontSize: 12 }}>
                        • {garage.city}
                      </Text>
                    ) : null}
                  </View>
                  {garage.vtsNumber ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                      <MaterialCommunityIcons name="shield-check" size={13} color="#10B981" style={{ marginRight: 4 }} />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#10B981' }}>
                        DVLA VTS: {garage.vtsNumber}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {/* Photos Preview strip in Info Modal */}
              {displayGarageImages.length > 0 && (
                <View style={[styles.infoModalBlock, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={[styles.infoModalBlockTitle, { color: theme.colors.placeholder }]}>
                      GARAGE PHOTOS ({displayGarageImages.length})
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedGalleryIndex(0);
                        setIsGalleryModalVisible(true);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.primary }}>
                        See All
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {displayGarageImages.map((imgUri, idx) => (
                      <TouchableOpacity
                        key={`thumb-preview-${idx}`}
                        activeOpacity={0.8}
                        onPress={() => {
                          setSelectedGalleryIndex(idx);
                          setIsGalleryModalVisible(true);
                        }}
                        style={styles.infoThumbWrap}
                      >
                        <Image source={{ uri: imgUri }} style={styles.infoThumbImg} resizeMode="cover" />
                        <View style={styles.infoThumbOverlay}>
                          <Text style={styles.infoThumbOverlayText}>{idx + 1}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Description */}
              {garage.description ? (
                <View style={[styles.infoModalBlock, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                  <Text style={[styles.infoModalBlockTitle, { color: theme.colors.placeholder }]}>ABOUT</Text>
                  <Text style={[styles.infoModalDesc, { color: theme.colors.text }]}>
                    {garage.description}
                  </Text>
                </View>
              ) : null}

              {/* Address / Location */}
              <View style={[styles.infoModalBlock, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                <Text style={[styles.infoModalBlockTitle, { color: theme.colors.placeholder }]}>ADDRESS</Text>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 4 }}>
                  <MaterialCommunityIcons name="map-marker" size={18} color={theme.colors.secondary} style={{ marginRight: 8, marginTop: 2 }} />
                  <Text style={[styles.infoModalText, { color: theme.colors.text, flex: 1 }]}>
                    {garage.address}{garage.city ? `, ${garage.city}` : ''} {garage.postcode || ''}
                  </Text>
                </View>

                {/* Get Directions Button */}
                <TouchableOpacity
                  style={[styles.infoDirectionsBtn, { backgroundColor: theme.colors.primary }]}
                  onPress={() => {
                    openGarageDirections({
                      name: garage.name,
                      address: garage.address,
                      city: garage.city,
                      postcode: garage.postcode,
                      latitude: garage.latitude || (garage.location?.coordinates ? garage.location.coordinates[1] : null),
                      longitude: garage.longitude || (garage.location?.coordinates ? garage.location.coordinates[0] : null),
                    });
                  }}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="directions" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.infoDirectionsBtnText}>Get Directions</Text>
                </TouchableOpacity>
              </View>

              {/* Contact Telephone */}
              {garage.phone ? (
                <View style={[styles.infoModalBlock, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                  <Text style={[styles.infoModalBlockTitle, { color: theme.colors.placeholder }]}>CONTACT TELEPHONE</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <MaterialCommunityIcons name="phone-outline" size={18} color={theme.colors.secondary} style={{ marginRight: 8 }} />
                      <Text style={[styles.infoModalText, { color: theme.colors.text }]}>
                        {garage.phone}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => Linking.openURL(`tel:${garage.phone}`)}
                      style={[styles.callBtn, { backgroundColor: theme.colors.secondary + '15', borderColor: theme.colors.secondary + '40' }]}
                    >
                      <MaterialCommunityIcons name="phone" size={14} color={theme.colors.secondary} style={{ marginRight: 4 }} />
                      <Text style={[styles.callBtnText, { color: theme.colors.secondary }]}>Call</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              {/* Opening Hours & Working Days */}
              <View style={[styles.infoModalBlock, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                <Text style={[styles.infoModalBlockTitle, { color: theme.colors.placeholder }]}>OPERATING HOURS</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <MaterialCommunityIcons name="clock-outline" size={18} color={theme.colors.secondary} style={{ marginRight: 8 }} />
                  <Text style={[styles.infoModalText, { color: theme.colors.text }]}>
                    {garage.openingTime || '08:00'} - {garage.closingTime || '18:00'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                  <MaterialCommunityIcons name="calendar-range" size={18} color={theme.colors.secondary} style={{ marginRight: 8 }} />
                  <Text style={[styles.infoModalText, { color: theme.colors.text }]}>
                    {garage.workingDays ? garage.workingDays.join(', ') : 'Monday - Friday'}
                  </Text>
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity
              onPress={() => setIsInfoModalVisible(false)}
              style={[styles.infoModalDoneBtn, { backgroundColor: theme.colors.primary }]}
              activeOpacity={0.85}
            >
              <Text style={styles.infoModalDoneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Full-Screen All Images Gallery Modal */}
      <Modal
        visible={isGalleryModalVisible}
        animationType="fade"
        transparent={false}
        onRequestClose={() => setIsGalleryModalVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0F19' }}>
          {/* Top Bar with title, index counter, and close button */}
          <View style={styles.galleryTopBar}>
            <TouchableOpacity
              onPress={() => setIsGalleryModalVisible(false)}
              style={styles.galleryCloseBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <MaterialCommunityIcons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.galleryCounterPill}>
              <MaterialCommunityIcons name="camera" size={13} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.galleryCounterText}>
                {selectedGalleryIndex + 1} / {displayGarageImages.length}
              </Text>
            </View>

            <View style={{ width: 40 }} />
          </View>

          {/* Main Large Image Display with Left / Right Navigation */}
          <View style={styles.galleryMainImageContainer}>
            <Image
              source={{ uri: displayGarageImages[selectedGalleryIndex] }}
              style={styles.galleryMainImage}
              resizeMode="contain"
            />

            {/* Left Nav Arrow */}
            {selectedGalleryIndex > 0 && (
              <TouchableOpacity
                onPress={() => setSelectedGalleryIndex(prev => Math.max(0, prev - 1))}
                style={[styles.galleryNavArrow, styles.galleryNavArrowLeft]}
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="chevron-left" size={32} color="#FFFFFF" />
              </TouchableOpacity>
            )}

            {/* Right Nav Arrow */}
            {selectedGalleryIndex < displayGarageImages.length - 1 && (
              <TouchableOpacity
                onPress={() => setSelectedGalleryIndex(prev => Math.min(displayGarageImages.length - 1, prev + 1))}
                style={[styles.galleryNavArrow, styles.galleryNavArrowRight]}
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="chevron-right" size={32} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>

          {/* Garage Name Caption */}
          <View style={styles.galleryCaptionBar}>
            <Text style={styles.galleryGarageTitle} numberOfLines={1}>
              {garage?.name || 'Garage Photos'}
            </Text>
            <Text style={styles.galleryGarageSubtitle} numberOfLines={1}>
              {garage?.address ? `${garage.address}${garage.city ? `, ${garage.city}` : ''}` : 'Workshop & Facilities'}
            </Text>
          </View>

          {/* Bottom Thumbnails Strip */}
          {displayGarageImages.length > 1 && (
            <View style={styles.galleryThumbnailContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.galleryThumbnailScroll}
              >
                {displayGarageImages.map((thumbUri, idx) => {
                  const isActive = idx === selectedGalleryIndex;
                  return (
                    <TouchableOpacity
                      key={`gallery-strip-${idx}`}
                      onPress={() => setSelectedGalleryIndex(idx)}
                      activeOpacity={0.8}
                      style={[
                        styles.galleryStripThumbTouch,
                        isActive && styles.galleryStripThumbActive,
                      ]}
                    >
                      <Image source={{ uri: thumbUri }} style={styles.galleryStripThumbImg} resizeMode="cover" />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </SafeAreaView>
      </Modal>

      {/* Complete MOT Booking Flow Modal */}
      <Modal
        visible={isBookingModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setIsBookingModalVisible(false)}
      >
        <SafeAreaView style={[styles.modalSafeArea, { backgroundColor: theme.colors.background }]}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
            style={{ flex: 1 }}
          >
            {/* Modal Header */}
            <View style={[styles.modalHeader, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalHeaderTitle, { color: theme.colors.text }]}>
                  Book Appointment
                </Text>
                <Text style={[styles.modalHeaderSubtitle, { color: theme.colors.placeholder }]} numberOfLines={1}>
                  {garage.name} • {selectedServices.length > 1 ? `${selectedServices.length} Services Selected` : (selectedMotService?.name || 'Automotive Service')}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.modalCloseBtn, { backgroundColor: theme.colors.background }]}
                onPress={() => setIsBookingModalVisible(false)}
              >
                <MaterialCommunityIcons name="close" size={20} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            {bookingSuccess ? (
              /* Booking Success Celebration Screen */
              <ScrollView contentContainerStyle={styles.successContainer}>
                <View style={styles.successIconCircle}>
                  <MaterialCommunityIcons name="check-bold" size={40} color="#FFFFFF" />
                </View>
                <Text style={[styles.successTitle, { color: theme.colors.text }]}>
                  Booking Request Sent!
                </Text>
                <Text style={[styles.successSubtitle, { color: theme.colors.placeholder }]}>
                  Your appointment request for {selectedServiceNames || selectedMotService?.name || 'services'} has been submitted to {garage.name}. Garage staff will review and confirm your request.
                </Text>

                <View style={[styles.summaryCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, width: '100%', marginVertical: 20 }]}>
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: theme.colors.placeholder }]}>Vehicle:</Text>
                    <Text style={[styles.summaryValue, { color: theme.colors.text, fontWeight: 'bold' }]}>
                      {selectedVehicle?.registrationNumber} ({selectedVehicle?.make} {selectedVehicle?.model})
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: theme.colors.placeholder }]}>Garage:</Text>
                    <Text style={[styles.summaryValue, { color: theme.colors.text }]}>{garage.name}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: theme.colors.placeholder }]}>Services:</Text>
                    <Text style={[styles.summaryValue, { color: theme.colors.text, fontWeight: 'bold' }]}>
                      {selectedServiceNames || selectedMotService?.name || 'Services'}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: theme.colors.placeholder }]}>Appointment:</Text>
                    <Text style={[styles.summaryValue, { color: theme.colors.primary, fontWeight: 'bold' }]}>
                      {hasMot ? `${formatDisplayDate(selectedDate)} at ${selectedTime}` : `${formatDisplayDate(selectedDate)} (Full-Day Drop-off)`}
                    </Text>
                  </View>
                  <View style={[styles.summaryRow, { borderBottomWidth: 0 }]}>
                    <Text style={[styles.summaryLabel, { color: theme.colors.placeholder }]}>Total Fee:</Text>
                    <Text style={[styles.summaryValue, { color: theme.colors.primary, fontWeight: 'bold' }]}>
                      £{totalSelectedPrice.toFixed(2)}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.primaryActionBtn, { backgroundColor: theme.colors.primary, width: '100%', marginBottom: 10 }]}
                  onPress={() => {
                    setIsBookingModalVisible(false);
                    navigation.navigate('Main', { screen: 'My Portal' });
                  }}
                >
                  <Text style={styles.primaryActionBtnText}>View in My Portal</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.secondaryActionBtn, { borderColor: theme.colors.border, width: '100%' }]}
                  onPress={() => setIsBookingModalVisible(false)}
                >
                  <Text style={[styles.secondaryActionBtnText, { color: theme.colors.text }]}>Done</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : (
              /* Booking Flow Form */
              <ScrollView 
                contentContainerStyle={styles.modalScrollContent} 
                keyboardShouldPersistTaps="handled"
              >
                {/* 0. Selected Services & Multi-Service Selection */}
                <View style={styles.flowSection}>
                  <View style={styles.flowSectionHeader}>
                    <MaterialCommunityIcons name="wrench-clock" size={18} color={theme.colors.primary} style={{ marginRight: 6 }} />
                    <Text style={[styles.flowSectionTitle, { color: theme.colors.text }]}>
                      Selected Services ({selectedServices.length})
                    </Text>
                  </View>

                  {/* List of Selected Service Cards */}
                  {selectedServices.map((svc: any) => {
                    const svcCatTheme = getCategoryTheme(svc.category, svc.name);
                    const isMotSvc = (svc.category || '').toLowerCase().includes('mot') || (svc.name || '').toLowerCase().includes('mot');

                    return (
                      <View 
                        key={svc._id || svc.id || svc.name}
                        style={[
                          styles.selectedServiceBanner,
                          { 
                            backgroundColor: theme.colors.card, 
                            borderColor: theme.colors.primary + '50',
                            borderWidth: 1.5,
                            marginBottom: 8,
                          }
                        ]}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                          <View style={{ flex: 1, paddingRight: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                              <Text style={[styles.serviceName, { color: theme.colors.text, fontSize: 14 }]}>
                                {svc.name}
                              </Text>
                              <View style={[
                                styles.categoryBadge, 
                                { 
                                  backgroundColor: svcCatTheme.bg,
                                  borderColor: svcCatTheme.border
                                }
                              ]}>
                                <Text style={[
                                  styles.categoryBadgeText, 
                                  { color: svcCatTheme.text }
                                ]}>
                                  {svc.category || (isMotSvc ? 'MOT' : 'Servicing')}
                                </Text>
                              </View>
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 10 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <MaterialCommunityIcons name="clock-time-four-outline" size={12} color={theme.colors.placeholder} style={{ marginRight: 3 }} />
                                <Text style={{ fontSize: 11, color: theme.colors.placeholder, fontWeight: '600' }}>
                                  {svc.duration || 45} mins
                                </Text>
                              </View>
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <MaterialCommunityIcons name={isMotSvc ? "clock-check" : "calendar-today"} size={12} color={theme.colors.placeholder} style={{ marginRight: 3 }} />
                                <Text style={{ fontSize: 11, color: theme.colors.placeholder }}>
                                  {isMotSvc ? '45-Min Bay Slot' : 'Workshop Drop-off'}
                                </Text>
                              </View>
                            </View>
                          </View>

                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={{ alignItems: 'flex-end' }}>
                              <Text style={[styles.servicePriceText, { color: theme.colors.primary, fontSize: 16 }]}>
                                £{svc.price ? Number(svc.price).toFixed(2) : '0.00'}
                              </Text>
                            </View>
                            {selectedServices.length > 1 && (
                              <TouchableOpacity
                                onPress={() => removeServiceFromSelection(svc)}
                                style={{ padding: 4, borderRadius: 12, backgroundColor: theme.colors.border + '40' }}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <MaterialCommunityIcons name="close" size={14} color={theme.colors.placeholder} />
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      </View>
                    );
                  })}

                  {/* Quick Totals Strip */}
                  <View style={[styles.multiServiceTotalStrip, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <MaterialCommunityIcons 
                        name={hasMot ? "clock-alert-outline" : "calendar-check-outline"} 
                        size={15} 
                        color={hasMot ? "#3B82F6" : "#10B981"} 
                        style={{ marginRight: 6 }} 
                      />
                      <Text style={{ fontSize: 12, color: theme.colors.text, fontWeight: '600' }}>
                        {hasMot ? 'Includes 45-Min MOT Test Slot' : 'Date-Only Workshop Drop-off'}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: theme.colors.primary }}>
                      £{totalSelectedPrice.toFixed(2)}
                    </Text>
                  </View>

                  {/* Add More Services from Garage Quick Chips */}
                  {allActiveServices.filter((s: any) => !isServiceSelected(s)).length > 0 && (
                    <View style={{ marginTop: 8 }}>
                      <Text style={{ fontSize: 10, color: theme.colors.placeholder, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 }}>
                        + Add more services to this booking:
                      </Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                        {allActiveServices
                          .filter((svc: any) => !isServiceSelected(svc))
                          .map((svc: any) => (
                            <TouchableOpacity
                              key={svc._id || svc.id || svc.name}
                              onPress={() => toggleSelectService(svc)}
                              style={[
                                styles.serviceSwitchChip,
                                {
                                  backgroundColor: theme.colors.card,
                                  borderColor: theme.colors.border,
                                }
                              ]}
                            >
                              <MaterialCommunityIcons name="plus" size={12} color={theme.colors.primary} style={{ marginRight: 2 }} />
                              <Text style={[styles.serviceSwitchChipText, { color: theme.colors.text }]}>
                                {svc.name} • £{svc.price ? Number(svc.price).toFixed(0) : '0'}
                              </Text>
                            </TouchableOpacity>
                          ))}
                      </ScrollView>
                    </View>
                  )}
                </View>

                {/* 1. Vehicle Selection Section */}
                <View style={styles.flowSection}>
                  <View style={styles.flowSectionHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <MaterialCommunityIcons name="car-cog" size={18} color={theme.colors.primary} style={{ marginRight: 6 }} />
                      <Text style={[styles.flowSectionTitle, { color: theme.colors.text }]}>
                        1. Select or Add Vehicle
                      </Text>
                    </View>
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
                  <Text style={[styles.flowSectionSubtitle, { color: theme.colors.placeholder }]}>
                    Choose an active vehicle or register a new car for this appointment
                  </Text>

                  {/* Inline Add Vehicle Card */}
                  {(showAddCarForm || activeCustomerVehicles.length === 0) && (
                    <View style={[styles.inlineAddCarCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.primary + '40' }]}>
                      <View style={styles.inlineAddCarHeader}>
                        <MaterialCommunityIcons name="car-plus" size={18} color={theme.colors.primary} style={{ marginRight: 6 }} />
                        <Text style={[styles.inlineAddCarTitle, { color: theme.colors.text }]}>
                          Register & Add Vehicle for this Booking
                        </Text>
                      </View>

                      {/* UK Number Plate Input with Attached Lookup */}
                      <Text style={[styles.formLabel, { color: theme.colors.text }]}>UK Registration Plate</Text>
                      <View style={styles.plateInputContainer}>
                        <View style={styles.ukPlateStrip}>
                          <Text style={styles.ukFlagEmoji}>🇬🇧</Text>
                          <Text style={styles.ukStripLabel}>UK</Text>
                        </View>
                        <TextInput
                          value={newRegNo}
                          onChangeText={(txt) => setNewRegNo(txt.toUpperCase())}
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
                            onChangeText={setNewMake}
                            placeholder="e.g. FORD"
                            placeholderTextColor={theme.colors.placeholder}
                            autoCapitalize="characters"
                            style={[styles.formInputField, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
                          />
                        </View>
                        <View style={styles.formCol}>
                          <Text style={[styles.formLabel, { color: theme.colors.text }]}>Model</Text>
                          <TextInput
                            value={newModel}
                            onChangeText={setNewModel}
                            placeholder="e.g. FOCUS"
                            placeholderTextColor={theme.colors.placeholder}
                            autoCapitalize="characters"
                            style={[styles.formInputField, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
                          />
                        </View>
                      </View>

                      {/* Year & MOT Expiry Row */}
                      <View style={styles.formRow}>
                        <View style={styles.formCol}>
                          <Text style={[styles.formLabel, { color: theme.colors.text }]}>Year</Text>
                          <TextInput
                            value={newYear}
                            onChangeText={setNewYear}
                            placeholder="e.g. 2019"
                            placeholderTextColor={theme.colors.placeholder}
                            keyboardType="numeric"
                            maxLength={4}
                            style={[styles.formInputField, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
                          />
                        </View>
                        <View style={styles.formCol}>
                          <Text style={[styles.formLabel, { color: theme.colors.text }]}>MOT Expiry (YYYY-MM-DD)</Text>
                          <TextInput
                            value={newExpiry}
                            onChangeText={(t) => setNewExpiry(formatDateInput(t))}
                            placeholder="YYYY-MM-DD"
                            placeholderTextColor={theme.colors.placeholder}
                            keyboardType="numeric"
                            maxLength={10}
                            style={[styles.formInputField, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
                          />
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

                  {/* Registered Customer Vehicles List */}
                  {activeCustomerVehicles.length > 0 && (
                    <View style={{ marginTop: 8 }}>
                      {activeCustomerVehicles.map((veh) => {
                        const isSelected = selectedVehicle?.registrationNumber?.toUpperCase() === veh.registrationNumber?.toUpperCase();
                        const daysLeft = getDaysUntilExpiry(veh.motExpiryDate);
                        const isPendingApproval = veh.status === 'Pending';
                        const isRejected = veh.status === 'Rejected';
                        const pendingBookingAlert = alerts.find(a => 
                          a.type === 'BOOKED' && 
                          a.registrationNumber?.toUpperCase() === veh.registrationNumber?.toUpperCase() && 
                          a.status === 'Pending'
                        );
                        const activeBookingAlert = alerts.find(a => 
                          a.type === 'BOOKED' && 
                          a.registrationNumber?.toUpperCase() === veh.registrationNumber?.toUpperCase() && 
                          a.status === 'Approved'
                        );

                        const isEligible = !isPendingApproval && !isRejected && !pendingBookingAlert && !activeBookingAlert;

                        // Resolve badge appearance
                        let badgeText = '';
                        let badgeBg = theme.colors.placeholder + '20';
                        let badgeColor = theme.colors.placeholder;
                        let statusIconName = isEligible ? 'calendar-clock' : 'clock-alert-outline';

                        if (isPendingApproval) {
                          badgeText = 'Pending Approval';
                          badgeBg = theme.colors.warning + '18';
                          badgeColor = theme.colors.warning;
                          statusIconName = 'clock-outline';
                        } else if (isRejected) {
                          badgeText = 'Rejected';
                          badgeBg = theme.colors.error + '18';
                          badgeColor = theme.colors.error;
                          statusIconName = 'close-circle-outline';
                        } else if (pendingBookingAlert) {
                          badgeText = 'Booking Pending';
                          badgeBg = theme.colors.warning + '18';
                          badgeColor = theme.colors.warning;
                          statusIconName = 'calendar-clock';
                        } else if (activeBookingAlert) {
                          badgeText = 'Already Booked';
                          badgeBg = theme.colors.primary + '18';
                          badgeColor = theme.colors.primary;
                          statusIconName = 'calendar-check';
                        } else if (daysLeft <= 0) {
                          badgeText = 'Expired (Book ASAP)';
                          badgeBg = theme.colors.error + '18';
                          badgeColor = theme.colors.error;
                          statusIconName = 'alert-circle';
                        } else if (daysLeft <= 30) {
                          badgeText = `${daysLeft}d left (Book Now)`;
                          badgeBg = theme.colors.success + '18';
                          badgeColor = theme.colors.success;
                          statusIconName = 'check-circle-outline';
                        } else {
                          badgeText = `Pre-Book (${daysLeft}d left)`;
                          badgeBg = theme.colors.primary + '18';
                          badgeColor = theme.colors.primary;
                          statusIconName = 'calendar-clock';
                        }

                        let rightIcon = 'radiobox-blank';
                        let rightIconColor = theme.colors.placeholder;
                        if (isPendingApproval) {
                          rightIcon = 'clock-outline';
                          rightIconColor = theme.colors.warning;
                        } else if (pendingBookingAlert) {
                          rightIcon = 'calendar-clock';
                          rightIconColor = theme.colors.warning;
                        } else if (activeBookingAlert) {
                          rightIcon = 'check-circle';
                          rightIconColor = theme.colors.primary;
                        } else if (isRejected) {
                          rightIcon = 'close-circle-outline';
                          rightIconColor = theme.colors.error;
                        } else if (isSelected) {
                          rightIcon = 'radiobox-marked';
                          rightIconColor = theme.colors.primary;
                        }

                        return (
                          <TouchableOpacity
                            key={veh.id || veh.registrationNumber}
                            style={[
                              styles.vehicleSelectItem,
                              { 
                                backgroundColor: isSelected 
                                  ? (theme.dark ? theme.colors.primary + '18' : theme.colors.primary + '0A') 
                                  : theme.colors.card, 
                                borderColor: isSelected 
                                  ? theme.colors.primary 
                                  : (isEligible ? theme.colors.border : theme.colors.placeholder + '30'),
                                borderWidth: isSelected ? 2 : 1,
                                opacity: isEligible ? 1 : 0.7,
                                elevation: 0,
                                shadowOpacity: 0,
                              }
                            ]}
                            onPress={() => {
                              if (isPendingApproval) {
                                Alert.alert(
                                  'Registration Pending Approval',
                                  `The registration for ${veh.registrationNumber} is currently pending approval by garage staff. You can book an MOT test once it is verified.`
                                );
                                return;
                              }
                              if (isRejected) {
                                Alert.alert(
                                  'Vehicle Registration Rejected',
                                  `The registration for ${veh.registrationNumber} was rejected by garage staff. You cannot book an MOT for this vehicle.`
                                );
                                return;
                              }
                              if (pendingBookingAlert) {
                                Alert.alert(
                                  'Booking Pending Approval',
                                  `An MOT appointment request for ${veh.registrationNumber} on ${formatDisplayDate(pendingBookingAlert.date) || pendingBookingAlert.date} is already awaiting confirmation by garage staff.`
                                );
                                return;
                              }
                              if (activeBookingAlert) {
                                Alert.alert(
                                  'Vehicle Already Booked',
                                  `${veh.registrationNumber} already has an active MOT booking on ${formatDisplayDate(activeBookingAlert.date) || activeBookingAlert.date}.`
                                );
                                return;
                              }
                              setSelectedVehicle(veh);
                            }}
                          >
                            <View style={styles.plateContainerSmall}>
                              <View style={styles.ukStripSmall}>
                                <Text style={styles.ukStripTextSmall}>UK</Text>
                              </View>
                              <Text style={styles.plateTextSmall}>{veh.registrationNumber}</Text>
                            </View>

                            <View style={styles.vehicleSelectInfo}>
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={[styles.vehicleSelectMake, { color: theme.colors.text }]}>
                                  {veh.make} {veh.model}
                                </Text>
                                <View style={[
                                  styles.eligibilityBadge, 
                                  { backgroundColor: badgeBg }
                                ]}>
                                  <Text style={[
                                    styles.eligibilityBadgeText, 
                                    { color: badgeColor }
                                  ]}>
                                    {badgeText}
                                  </Text>
                                </View>
                              </View>
                              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                                <MaterialCommunityIcons 
                                  name={statusIconName} 
                                  size={12} 
                                  color={badgeColor} 
                                  style={{ marginRight: 4 }} 
                                />
                                <Text style={[styles.vehicleSelectExpiry, { color: theme.colors.placeholder }]}>
                                  MOT Expiry: {formatDisplayDate(veh.motExpiryDate) || 'N/A'} {veh.motExpiryDate ? `(${daysLeft >= 0 ? `${daysLeft} days left` : `${Math.abs(daysLeft)} days ago`})` : ''}
                                </Text>
                              </View>
                            </View>

                            <MaterialCommunityIcons
                              name={rightIcon}
                              size={22}
                              color={rightIconColor}
                            />
                          </TouchableOpacity>
                        );
                      })}

                      {/* Add Another Vehicle dashed button under list */}
                      {!showAddCarForm && (
                        <TouchableOpacity
                          style={[styles.addAnotherCarDashedBtn, { borderColor: theme.colors.primary + '50', backgroundColor: theme.colors.primary + '08' }]}
                          onPress={() => setShowAddCarForm(true)}
                          activeOpacity={0.7}
                        >
                          <MaterialCommunityIcons name="plus-circle-outline" size={17} color={theme.colors.primary} />
                          <Text style={[styles.addAnotherCarText, { color: theme.colors.primary }]}>
                            + Add Another Vehicle
                          </Text>
                        </TouchableOpacity>
                      )}

                      {/* Selected Vehicle Inline Status Warning */}
                      {selectedVehicle && (
                        selectedVehicle.status === 'Pending' ? (
                          <View style={[styles.inlineNotice, { backgroundColor: theme.colors.warning + '15', borderColor: theme.colors.warning + '40' }]}>
                            <MaterialCommunityIcons name="clock-outline" size={18} color={theme.colors.warning} style={{ marginRight: 8 }} />
                            <Text style={[styles.inlineNoticeText, { color: theme.colors.text }]}>
                              <Text style={{ fontWeight: 'bold' }}>Registration Pending:</Text> {selectedVehicle.registrationNumber} is awaiting verification by garage staff before an MOT test can be booked.
                            </Text>
                          </View>
                        ) : alerts.some(a => a.type === 'BOOKED' && a.registrationNumber?.toUpperCase() === selectedVehicle.registrationNumber?.toUpperCase() && a.status === 'Pending') ? (
                          <View style={[styles.inlineNotice, { backgroundColor: theme.colors.warning + '15', borderColor: theme.colors.warning + '40' }]}>
                            <MaterialCommunityIcons name="calendar-clock" size={18} color={theme.colors.warning} style={{ marginRight: 8 }} />
                            <Text style={[styles.inlineNoticeText, { color: theme.colors.text }]}>
                              <Text style={{ fontWeight: 'bold' }}>Booking Pending:</Text> An MOT booking request for {selectedVehicle.registrationNumber} is already awaiting garage staff approval.
                            </Text>
                          </View>
                        ) : alerts.some(a => a.type === 'BOOKED' && a.registrationNumber?.toUpperCase() === selectedVehicle.registrationNumber?.toUpperCase() && a.status === 'Approved') ? (
                          <View style={[styles.inlineNotice, { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary + '40' }]}>
                            <MaterialCommunityIcons name="calendar-check" size={18} color={theme.colors.primary} style={{ marginRight: 8 }} />
                            <Text style={[styles.inlineNoticeText, { color: theme.colors.text }]}>
                              <Text style={{ fontWeight: 'bold' }}>Already Booked:</Text> {selectedVehicle.registrationNumber} already has an active confirmed MOT appointment.
                            </Text>
                          </View>
                        ) : getDaysUntilExpiry(selectedVehicle.motExpiryDate) > 30 ? (
                          <View style={[styles.inlineNotice, { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary + '30' }]}>
                            <MaterialCommunityIcons name="calendar-clock" size={18} color={theme.colors.primary} style={{ marginRight: 8 }} />
                            <Text style={[styles.inlineNoticeText, { color: theme.colors.text }]}>
                              <Text style={{ fontWeight: 'bold' }}>Pre-Booking Active:</Text> Showing slots within the 30-day renewal window ({selectedVehicle.registrationNumber} expires {formatDisplayDate(selectedVehicle.motExpiryDate)}).
                            </Text>
                          </View>
                        ) : getDaysUntilExpiry(selectedVehicle.motExpiryDate) <= 0 ? (
                          <View style={[styles.inlineNotice, { backgroundColor: theme.colors.error + '15', borderColor: theme.colors.error + '30' }]}>
                            <MaterialCommunityIcons name="alert-circle" size={18} color={theme.colors.error} style={{ marginRight: 8 }} />
                            <Text style={[styles.inlineNoticeText, { color: theme.colors.text }]}>
                              <Text style={{ fontWeight: 'bold' }}>MOT Expired:</Text> {selectedVehicle.registrationNumber} certificate has expired. Book the earliest available slot as soon as possible.
                            </Text>
                          </View>
                        ) : null
                      )}

                    </View>
                  )}
                </View>

                {/* 2. Date Selection Section */}
                <View style={styles.flowSection}>
                  <View style={styles.flowSectionHeader}>
                    <MaterialCommunityIcons name="calendar-month" size={18} color={theme.colors.primary} style={{ marginRight: 6 }} />
                    <Text style={[styles.flowSectionTitle, { color: theme.colors.text }]}>
                      {hasMot ? '2. Choose MOT & Service Appointment Date' : '2. Choose Workshop Drop-off Date'}
                    </Text>
                  </View>
                  <Text style={[styles.flowSectionSubtitle, { color: theme.colors.placeholder }]}>
                    {hasMot 
                      ? `Select from verified operating days for ${garage.name}`
                      : `Select what date you will bring your car to ${garage.name} (Workshop Intake)`}
                  </Text>

                  {/* Whole Calendar Card */}
                  <View style={[styles.calendarCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    {/* Header: Month / Year + Prev/Next buttons */}
                    <View style={styles.calendarHeader}>
                      <TouchableOpacity 
                        onPress={handlePrevMonth} 
                        style={[styles.calNavBtn, { opacity: isPrevMonthDisabled ? 0.3 : 1 }]}
                        disabled={isPrevMonthDisabled}
                        activeOpacity={0.7}
                      >
                        <MaterialCommunityIcons 
                          name="chevron-left" 
                          size={24} 
                          color={isPrevMonthDisabled ? theme.colors.placeholder : theme.colors.text} 
                        />
                      </TouchableOpacity>
                      <Text style={[styles.calendarTitle, { color: theme.colors.text }]}>
                        {monthNames[currentViewDate.getMonth()]} {currentViewDate.getFullYear()}
                      </Text>
                      <TouchableOpacity 
                        onPress={handleNextMonth} 
                        style={styles.calNavBtn}
                        activeOpacity={0.7}
                      >
                        <MaterialCommunityIcons 
                          name="chevron-right" 
                          size={24} 
                          color={theme.colors.text} 
                        />
                      </TouchableOpacity>
                    </View>

                    {/* Weekday Row */}
                    <View style={styles.weekdayRow}>
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => {
                        const workingDays = garage?.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                        const isWorkingDay = workingDays.some((w: string) => w.toLowerCase().startsWith(d.toLowerCase()));
                        return (
                          <Text 
                            key={d} 
                            style={[
                              styles.weekdayText, 
                              { color: !isWorkingDay ? theme.colors.error : theme.colors.placeholder }
                            ]}
                          >
                            {d}
                          </Text>
                        );
                      })}
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
                        
                        const todayObj = new Date();
                        const isToday = day.getDate() === todayObj.getDate() && 
                                        day.getMonth() === todayObj.getMonth() && 
                                        day.getFullYear() === todayObj.getFullYear();

                        return (
                          <TouchableOpacity
                            key={isoString}
                            disabled={!selectable}
                            onPress={() => setSelectedDate(isoString)}
                            activeOpacity={0.7}
                            style={[
                              styles.dayCell,
                              isSelected && { backgroundColor: theme.colors.primary, borderRadius: 18 },
                              isToday && !isSelected && { borderWidth: 1.5, borderColor: theme.colors.primary, borderRadius: 18 }
                            ]}
                          >
                            <Text
                              style={[
                                styles.dayCellText,
                                { color: theme.colors.text },
                                isSelected && { color: '#FFFFFF', fontWeight: 'bold' },
                                !selectable && { color: theme.colors.placeholder + '35' }
                              ]}
                            >
                              {day.getDate()}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Selected Date Indicator Banner */}
                    {selectedDate ? (
                      <View style={[styles.calendarSelectedBanner, { borderTopColor: theme.colors.border + '60' }]}>
                        <MaterialCommunityIcons name="calendar-check" size={16} color={theme.colors.primary} style={{ marginRight: 6 }} />
                        <Text style={[styles.calendarSelectedText, { color: theme.colors.text }]}>
                          Selected Date:{' '}
                          <Text style={{ fontWeight: 'bold', color: theme.colors.primary }}>
                            {formatDisplayDate(selectedDate)}
                          </Text>
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                {/* 3. Slot Selection (MOT has 45-min slots; Non-MOT is Date-Only Workshop Drop-off) */}
                {hasMot ? (
                  <View style={styles.flowSection}>
                    <View style={styles.flowSectionHeader}>
                      <MaterialCommunityIcons name="clock-outline" size={18} color={theme.colors.primary} style={{ marginRight: 6 }} />
                      <Text style={[styles.flowSectionTitle, { color: theme.colors.text }]}>
                        3. Select 45-Min MOT Test Slot
                      </Text>
                    </View>
                    <Text style={[styles.flowSectionSubtitle, { color: theme.colors.placeholder }]}>
                      Live MOT bay test slots for {formatDisplayDate(selectedDate)}
                    </Text>

                    {loadingSlots ? (
                      <View style={[styles.slotsLoadingContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                        <ActivityIndicator size="small" color={theme.colors.primary} />
                        <Text style={[styles.slotsLoadingText, { color: theme.colors.placeholder }]}>
                          Checking live MOT bay availability...
                        </Text>
                      </View>
                    ) : freeSlots.length === 0 ? (
                      <View style={[styles.slotsEmptyContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                        <MaterialCommunityIcons name="clock-alert-outline" size={28} color={theme.colors.placeholder} />
                        <Text style={[styles.slotsEmptyText, { color: theme.colors.placeholder }]}>
                          No open test slots available on this date. Please choose another date above.
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.slotsGrid}>
                        {freeSlots.map((slot) => {
                          const isSlotSelected = selectedTime === slot.time;
                          return (
                            <TouchableOpacity
                              key={slot.time}
                              style={[
                                styles.slotChip,
                                {
                                  backgroundColor: isSlotSelected ? theme.colors.primary : theme.colors.card,
                                  borderColor: isSlotSelected ? theme.colors.primary : theme.colors.border,
                                }
                              ]}
                              onPress={() => {
                                setSelectedTime(slot.time);
                                setSelectedSlot(slot);
                              }}
                            >
                              <MaterialCommunityIcons
                                name="clock-time-four-outline"
                                size={14}
                                color={isSlotSelected ? '#FFFFFF' : theme.colors.secondary}
                                style={{ marginRight: 4 }}
                              />
                              <Text style={[styles.slotChipText, { color: isSlotSelected ? '#FFFFFF' : theme.colors.text }]}>
                                {slot.time}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={styles.flowSection}>
                    <View style={styles.flowSectionHeader}>
                      <MaterialCommunityIcons name="store-clock-outline" size={18} color={theme.colors.primary} style={{ marginRight: 6 }} />
                      <Text style={[styles.flowSectionTitle, { color: theme.colors.text }]}>
                        3. Workshop Drop-Off Intake
                      </Text>
                    </View>
                    <Text style={[styles.flowSectionSubtitle, { color: theme.colors.placeholder }]}>
                      No fixed 45-min time slot needed for non-MOT services
                    </Text>

                    <View style={[styles.dateOnlyNoticeCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.primary + '30' }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                        <View style={[styles.dateOnlyIconCircle, { backgroundColor: theme.colors.primary + '15' }]}>
                          <MaterialCommunityIcons name="car-wrench" size={22} color={theme.colors.primary} />
                        </View>
                        <View style={{ marginLeft: 12, flex: 1 }}>
                          <Text style={[styles.dateOnlyCardTitle, { color: theme.colors.text }]}>
                            Full-Day Workshop Drop-Off
                          </Text>
                          <Text style={{ fontSize: 12, color: theme.colors.primary, fontWeight: '700', marginTop: 2 }}>
                            Operating Hours: 08:00 – 18:00
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.dateOnlyCardBody, { color: theme.colors.placeholder }]}>
                        Bring your car to {garage.name} on {formatDisplayDate(selectedDate)}. Garage staff will receive notification of your request to accept or reject as before, and will work on your vehicle during workshop hours.
                      </Text>
                    </View>
                  </View>
                )}

                {/* 4. Booking Summary Card */}
                <View style={[styles.summaryCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                  <Text style={[styles.summaryCardTitle, { color: theme.colors.text }]}>
                    Booking Appointment Summary
                  </Text>

                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: theme.colors.placeholder }]}>Garage / Station:</Text>
                    <Text style={[styles.summaryValue, { color: theme.colors.text }]}>{garage.name}</Text>
                  </View>

                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: theme.colors.placeholder }]}>Selected Services:</Text>
                    <Text style={[styles.summaryValue, { color: theme.colors.text, fontWeight: 'bold' }]}>
                      {selectedServiceNames || selectedMotService?.name || 'Services'}
                    </Text>
                  </View>

                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: theme.colors.placeholder }]}>Estimated Duration:</Text>
                    <Text style={[styles.summaryValue, { color: theme.colors.text }]}>
                      ~{totalSelectedDuration} mins
                    </Text>
                  </View>

                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: theme.colors.placeholder }]}>Vehicle:</Text>
                    <Text style={[styles.summaryValue, { color: theme.colors.text, fontWeight: 'bold' }]}>
                      {selectedVehicle ? `${selectedVehicle.registrationNumber} (${selectedVehicle.make} ${selectedVehicle.model})` : 'None Selected'}
                    </Text>
                  </View>

                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: theme.colors.placeholder }]}>Appointment:</Text>
                    <Text style={[styles.summaryValue, { color: theme.colors.primary, fontWeight: 'bold' }]}>
                      {hasMot 
                        ? (selectedDate && selectedTime ? `${formatDisplayDate(selectedDate)} at ${selectedTime}` : 'Select date & MOT slot')
                        : (selectedDate ? `${formatDisplayDate(selectedDate)} (Full-Day Drop-off)` : 'Select date')}
                    </Text>
                  </View>

                  <View style={[styles.summaryRow, { borderBottomWidth: 0, paddingTop: 10 }]}>
                    <Text style={[styles.summaryTotalLabel, { color: theme.colors.text }]}>Total Fee:</Text>
                    <Text style={[styles.summaryTotalPrice, { color: theme.colors.primary }]}>
                      £{totalSelectedPrice.toFixed(2)}
                    </Text>
                  </View>
                </View>

                {/* 5. Submit Booking Button */}
                {(() => {
                  const daysLeft = selectedVehicle ? getDaysUntilExpiry(selectedVehicle.motExpiryDate) : -1;
                  const isPendingApproval = selectedVehicle?.status === 'Pending';
                  const isRejected = selectedVehicle?.status === 'Rejected';
                  const hasPendingBooking = selectedVehicle && alerts.some(a => 
                    a.type === 'BOOKED' && 
                    a.registrationNumber?.toUpperCase() === selectedVehicle.registrationNumber?.toUpperCase() && 
                    a.status === 'Pending'
                  );
                  const hasApprovedBooking = selectedVehicle && alerts.some(a => 
                    a.type === 'BOOKED' && 
                    a.registrationNumber?.toUpperCase() === selectedVehicle.registrationNumber?.toUpperCase() && 
                    a.status === 'Approved'
                  );
                  const isVehicleEligible = selectedVehicle && !isPendingApproval && !isRejected && !hasPendingBooking && !hasApprovedBooking;

                  let buttonLabel = `Confirm Booking • £${totalSelectedPrice.toFixed(2)}`;
                  if (!selectedVehicle) buttonLabel = 'Select a Vehicle';
                  else if (isPendingApproval) buttonLabel = 'Registration Pending Approval';
                  else if (isRejected) buttonLabel = 'Registration Rejected';
                  else if (hasPendingBooking) buttonLabel = 'Booking Already Pending';
                  else if (hasApprovedBooking) buttonLabel = 'Vehicle Already Booked';
                  else if (!selectedDate) buttonLabel = 'Select an Appointment Date';
                  else if (hasMot && !selectedTime) buttonLabel = 'Select an Available MOT Slot';

                  const canSubmit = isVehicleEligible && selectedDate && (hasMot ? Boolean(selectedTime) : true) && !submittingBooking;

                  return (
                    <TouchableOpacity
                      style={[
                        styles.primaryActionBtn,
                        { 
                          backgroundColor: canSubmit ? theme.colors.primary : (theme.colors.placeholder + '30'),
                          elevation: canSubmit ? 1 : 0,
                          marginBottom: 28,
                        }
                      ]}
                      disabled={!canSubmit}
                      onPress={handleConfirmBooking}
                    >
                      {submittingBooking ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <MaterialCommunityIcons 
                            name={canSubmit ? "calendar-check" : "alert-circle-outline"} 
                            size={18} 
                            color={canSubmit ? "#FFFFFF" : theme.colors.placeholder} 
                            style={{ marginRight: 8 }} 
                          />
                          <Text style={[styles.primaryActionBtnText, { color: canSubmit ? "#FFFFFF" : theme.colors.placeholder }]}>
                            {buttonLabel}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })()}
              </ScrollView>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 28,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  headerCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  headerInfo: {
    marginLeft: 12,
    flex: 1,
  },
  garageName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  distanceText: {
    fontSize: 12,
  },
  description: {
    fontSize: 12,
    lineHeight: 16,
  },
  sectionCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoIcon: {
    marginRight: 8,
  },
  infoText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  servicesSection: {
    marginTop: 4,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 6,
  },
  categoryPillText: {
    fontSize: 12,
  },
  serviceSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
    marginBottom: 12,
  },
  serviceSearchInput: {
    flex: 1,
    fontSize: 12,
    padding: 0,
  },
  serviceEmptyBox: {
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  serviceEmptyText: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  serviceCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
  },
  serviceIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  serviceInfo: {
    flex: 1,
    paddingRight: 4,
  },
  serviceName: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  categoryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
  },
  categoryBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  serviceMeta: {
    fontSize: 11,
  },
  serviceDescText: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 4,
  },
  serviceCardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 0.5,
  },
  servicePriceText: {
    fontSize: 16,
    fontWeight: '900',
  },
  bookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    justifyContent: 'center',
  },
  bookBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  selectedServiceBanner: {
    padding: 12,
    borderRadius: 10,
    marginTop: 6,
  },
  serviceSwitchChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  serviceSwitchChipText: {
    fontSize: 11,
  },
  retryButton: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 6,
  },
  imagesCarousel: {
    height: 160,
    width: '100%',
  },
  carouselContainer: {
    position: 'relative',
    height: 160,
    width: '100%',
  },
  carouselBadge: {
    position: 'absolute',
    bottom: 10,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  carouselBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  galleryThumbContainer: {
    width: 104,
    height: 74,
    borderRadius: 8,
    borderWidth: 1.5,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
  },
  galleryThumb: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  galleryThumbLabel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 2,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  galleryThumbText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '600',
  },
  carouselImage: {
    height: 160,
    resizeMode: 'cover',
  },
  heroImage: {
    height: 160,
    resizeMode: 'cover',
  },

  // Modal Flow Styles
  modalSafeArea: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalHeaderSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  flowSection: {
    marginBottom: 20,
  },
  flowSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  flowSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  flowSectionSubtitle: {
    fontSize: 11,
    marginBottom: 10,
    lineHeight: 15,
  },
  emptyVehicleNotice: {
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 6,
  },
  emptyVehicleText: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  enterVrnBtn: {
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  enterVrnBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  vehicleSelectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    elevation: 0,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  plateContainerSmall: {
    flexDirection: 'row',
    height: 30,
    backgroundColor: '#FFD300',
    borderRadius: 4,
    overflow: 'hidden',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#000',
    marginRight: 12,
  },
  ukStripSmall: {
    width: 18,
    height: '100%',
    backgroundColor: '#0A4E9B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ukStripTextSmall: {
    color: '#FFF',
    fontSize: 7,
    fontWeight: 'bold',
  },
  plateTextSmall: {
    paddingHorizontal: 8,
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000',
    letterSpacing: 0.5,
  },
  vehicleSelectInfo: {
    flex: 1,
  },
  vehicleSelectMake: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  vehicleSelectExpiry: {
    fontSize: 11,
  },

  calendarCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 6,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  calNavBtn: {
    padding: 6,
    borderRadius: 8,
  },
  calendarTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
    paddingBottom: 6,
    marginBottom: 8,
  },
  weekdayText: {
    width: '14.2%',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 6,
  },
  dayCell: {
    width: '14.2%',
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayCellText: {
    fontSize: 13,
    fontWeight: '500',
  },
  calendarSelectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  calendarSelectedText: {
    fontSize: 12,
  },
  slotsLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
  },
  slotsLoadingText: {
    fontSize: 12,
    marginLeft: 8,
  },
  slotsEmptyContainer: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  slotsEmptyText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 16,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  slotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
  },
  slotChipText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  summaryCard: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  summaryCardTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(150, 150, 150, 0.2)',
  },
  summaryLabel: {
    fontSize: 12,
  },
  summaryValue: {
    fontSize: 12,
    maxWidth: '65%',
    textAlign: 'right',
  },
  summaryTotalLabel: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  summaryTotalPrice: {
    fontSize: 16,
    fontWeight: '900',
  },
  primaryActionBtn: {
    height: 46,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  secondaryActionBtn: {
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryActionBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  successContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  successIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  dvsaNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 6,
    marginBottom: 8,
  },
  dvsaNoticeText: {
    fontSize: 11,
    flex: 1,
    lineHeight: 15,
  },
  eligibilityBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  eligibilityBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  inlineNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
  },
  inlineNoticeText: {
    fontSize: 11,
    flex: 1,
    lineHeight: 15,
  },
  smallDirectionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  smallDirectionsBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  fullDirectionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 8,
    marginTop: 12,
  },
  fullDirectionsBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  topHeaderBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  headerBackBtn: {
    padding: 6,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topHeaderTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: 'bold',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  headerInfoBtn: {
    padding: 6,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewInfoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
  },
  viewInfoPillText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  infoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  infoModalContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  infoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  infoModalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoModalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoModalBody: {
    padding: 16,
    gap: 12,
  },
  infoModalSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  infoModalLogo: {
    width: 52,
    height: 52,
    borderRadius: 10,
  },
  infoModalGarageName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoModalBlock: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  infoModalBlockTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  infoModalText: {
    fontSize: 13,
    lineHeight: 18,
  },
  infoModalDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  infoDirectionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  infoDirectionsBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  callBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  infoModalDoneBtn: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  infoModalDoneBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  infoModalLogoTouch: {
    position: 'relative',
  },
  photoCountBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: '#334155',
  },
  photoCountBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  infoThumbWrap: {
    width: 64,
    height: 64,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  infoThumbImg: {
    width: '100%',
    height: '100%',
  },
  infoThumbOverlay: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  infoThumbOverlayText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  galleryTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  galleryCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryCounterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  galleryCounterText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  galleryMainImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  galleryMainImage: {
    width: '100%',
    height: '100%',
  },
  galleryNavArrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryNavArrowLeft: {
    left: 12,
  },
  galleryNavArrowRight: {
    right: 12,
  },
  galleryCaptionBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  galleryGarageTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  galleryGarageSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  galleryThumbnailContainer: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  galleryThumbnailScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  galleryStripThumbTouch: {
    width: 54,
    height: 54,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  galleryStripThumbActive: {
    borderColor: '#3B82F6',
  },
  galleryStripThumbImg: {
    width: '100%',
    height: '100%',
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
    fontSize: 12,
    fontWeight: '700',
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
    fontSize: 14,
    fontWeight: 'bold',
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
    fontSize: 10,
  },
  ukStripLabel: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 8,
  },
  plateInputField: {
    flex: 1,
    fontSize: 15,
    fontWeight: 'bold',
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
    color: '#FFFFFF',
    fontWeight: 'bold',
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
    fontSize: 11,
    color: '#10B981',
    fontWeight: '600',
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
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  formInputField: {
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
    fontSize: 12,
    fontWeight: '600',
  },
  saveCarSubmitBtn: {
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  saveCarSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  addAnotherCarDashedBtn: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 10,
  },
  addAnotherCarText: {
    fontWeight: '700',
    fontSize: 13,
    marginLeft: 6,
  },
  serviceSelectToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  serviceSelectToggleText: {
    fontSize: 12,
  },
  floatingBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  floatingBarTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  floatingBarSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  floatingBarActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  floatingBarActionText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  multiServiceTotalStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 2,
    marginBottom: 8,
  },
  dateOnlyNoticeCard: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 6,
  },
  dateOnlyIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateOnlyCardTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  dateOnlyCardBody: {
    fontSize: 12,
    lineHeight: 18,
  },
});
