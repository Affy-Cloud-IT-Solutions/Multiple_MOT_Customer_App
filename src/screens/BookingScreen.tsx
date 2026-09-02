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

export default function BookingScreen({ route, navigation }: any) {
  const { theme } = useAppTheme();
  const { customers, vehicles, addAlert, addAudit, user, token } = useAppValues();

  // Find active customer
  const customerId = user?.customerId || 'c1';

  // Find active customer vehicles
  const activeCustomerVehicles = vehicles.filter(v => 
    v.customerId && (
      String(v.customerId).toLowerCase() === String(customerId).toLowerCase()
    ) && v.status !== 'Sold' && v.status !== 'Scrapped'
  );

  const isReschedule = route?.params?.isReschedule || false;

  // Selected vehicle state
  const [selectedVehicle, setSelectedVehicle] = useState<any>(
    route?.params?.vehicle || activeCustomerVehicles[0] || null
  );

  // Garages list & selected garage state
  const [garages, setGarages] = useState<any[]>([]);
  const [loadingGarages, setLoadingGarages] = useState(false);
  const [selectedGarage, setSelectedGarage] = useState<any>(
    isReschedule && route?.params?.garageId
      ? { id: route.params.garageId, name: route.params.garageName }
      : null
  );

  // Selected service state
  const [selectedService, setSelectedService] = useState<any>({
    name: route?.params?.serviceName || 'MOT Test',
    price: route?.params?.price || 45.00,
    duration: route?.params?.duration || 45
  });

  // Fetch garages list
  useEffect(() => {
    if (isReschedule) return;
    const fetchGarages = async () => {
      setLoadingGarages(true);
      try {
        const response = await fetch(`${BASE_URL}/garages`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (response.ok) {
          const data = await response.json();
          setGarages(data);
          
          // Pre-select garage if passed in params
          const initialGarageId = route?.params?.garageId;
          if (initialGarageId) {
            const found = data.find((g: any) => String(g.id) === String(initialGarageId) || String(g._id) === String(initialGarageId));
            if (found) {
              setSelectedGarage(found);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching garages in BookingScreen:', err);
      } finally {
        setLoadingGarages(false);
      }
    };
    fetchGarages();
  }, [route?.params?.garageId, isReschedule, token]);

  // Fetch selected garage services to load MOT dynamically
  useEffect(() => {
    if (!selectedGarage || isReschedule) return;
    
    const fetchGarageDetails = async () => {
      try {
        const response = await fetch(`${BASE_URL}/garages/${selectedGarage.id || selectedGarage._id}`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (response.ok) {
          const data = await response.json();
          if (data.services && data.services.length > 0) {
            // Find MOT service or default to first
            const motSvc = data.services.find((s: any) => s.name.toUpperCase().includes('MOT'));
            if (motSvc) {
              setSelectedService(motSvc);
            } else {
              setSelectedService(data.services[0]);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching garage details for services:', err);
      }
    };
    fetchGarageDetails();
  }, [selectedGarage, isReschedule, token]);

  const customer = customers.find((c) => 
    selectedVehicle && selectedVehicle.customerId && (
      String(c.id).toLowerCase() === String(selectedVehicle.customerId || '').toLowerCase() ||
      String(c._id).toLowerCase() === String(selectedVehicle.customerId || '').toLowerCase()
    )
  ) || customers[0] || {
    id: user?.customerId || 'c1',
    firstName: user?.name?.split(' ')[0] || 'Customer',
    lastName: user?.name?.split(' ').slice(1).join(' ') || '',
    email: user?.email || '',
    mobile: '',
  };

  // Date and Time options for slot selection
  const [currentViewDate, setCurrentViewDate] = useState(new Date());

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
    
    // Sundays
    if (date.getDay() === 0) return false;
    
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

  const [selectedDate, setSelectedDate] = useState(getTodayISOString());
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [garageSlots, setGarageSlots] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

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
    if (!selectedDate || !selectedTime) {
      Alert.alert('Error', 'Please select a date and time slot.');
      return;
    }

    if (!selectedVehicle) {
      Alert.alert('Error', 'Please select a vehicle first.');
      return;
    }

    const getDaysUntilExpiry = (expiryDateStr?: string) => {
      if (!expiryDateStr) return -1;
      const expiryDate = new Date(expiryDateStr);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diffTime = expiryDate.getTime() - today.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    const daysLeft = getDaysUntilExpiry(selectedVehicle.motExpiryDate);
    if (daysLeft > 30) {
      Alert.alert(
        'Booking Restriction',
        `You can only book an MOT test when your vehicle is within 30 days of its expiry date. This vehicle has ${daysLeft} days remaining.`
      );
      return;
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

      // Add BOOKED alert notification to Admin alerts list
      await addAlert({
        type: 'BOOKED',
        customerName: `${customer.firstName} ${customer.lastName}`,
        customerId: customer.id,
        garageId: selectedGarage.id || selectedGarage._id,
        serviceName: selectedService.name,
        price: selectedService.price,
        duration: selectedSlot?.slotDuration || 45,
        slotTime: selectedSlot?.time || selectedTime,
        registrationNumber: selectedVehicle.registrationNumber,
        makeModel: `${selectedVehicle.make} ${selectedVehicle.model} - Slot: ${selectedSlot?.time || selectedTime}`,
        status: isAdmin ? 'Approved' : 'Pending',
        date: selectedDate,
      });

      // Log to audit history
      await addAudit(
        isReschedule ? 'MOT Booking Rescheduled' : (isAdmin ? 'MOT Booking Booked' : 'MOT Booking Requested'),
        isAdmin
          ? `Garage staff booked MOT booking slot for ${customer.firstName} ${customer.lastName}'s ${selectedVehicle.make} ${selectedVehicle.model} (${selectedVehicle.registrationNumber}) on ${displayDateStr} at ${selectedTime}`
          : `${customer.firstName} ${customer.lastName} ${isReschedule ? 'rescheduled' : 'requested'} MOT booking slot for ${selectedVehicle.make} ${selectedVehicle.model} (${selectedVehicle.registrationNumber}) on ${displayDateStr} at ${selectedTime}`
      );

      setLoading(false);

      // Show Toast Notification
      const successMessage = isReschedule
        ? `MOT Booking rescheduled successfully for ${displayDateStr}!`
        : (isAdmin 
            ? `MOT Booking confirmed and approved for ${customer.firstName} ${customer.lastName}!`
            : `MOT Booking request submitted successfully for ${displayDateStr}!`);

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: successMessage,
      });

      // Navigate back
      try {
        if (route?.params?.sourceScreen) {
          navigation.navigate(route.params.sourceScreen, route.params.sourceScreenParams || {});
        } else {
          navigation.navigate('CustomerPortal', { customerId: customer.id });
        }
      } catch (navErr) {
        console.warn('Navigation redirect failed, falling back to goBack:', navErr);
        if (navigation.canGoBack()) {
          navigation.goBack();
        } else {
          navigation.navigate('Main', { screen: 'Customers' });
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
          {isReschedule ? 'Reschedule MOT Slot' : 'Book MOT Slot'}
        </Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {isReschedule ? (
          <>
            {/* Locked Vehicle Summary Card for Rescheduling */}
            <View style={[styles.vehicleCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <View style={styles.plate}>
                <Text style={styles.plateText}>{selectedVehicle?.registrationNumber}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.vehicleMakeModel, { color: theme.colors.text }]}>
                  {selectedVehicle?.make} {selectedVehicle?.model}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                  <MaterialCommunityIcons name="information-outline" size={13} color={theme.colors.placeholder} style={{ marginRight: 4 }} />
                  <Text style={[styles.vehicleSubText, { color: theme.colors.placeholder }]}>
                    Rescheduling appointment for this vehicle
                  </Text>
                </View>
              </View>
            </View>

            {/* Locked Garage & Service Info for Rescheduling */}
            <View style={[styles.vehicleCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, marginTop: 12 }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: theme.colors.placeholder, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 }}>
                  Selected Garage & Service
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                  <View style={[styles.selectedGarageIconCircle, { backgroundColor: theme.colors.secondary + '15' }]}>
                    <MaterialCommunityIcons name="store" size={18} color={theme.colors.secondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.vehicleMakeModel, { color: theme.colors.text, fontSize: 14, marginBottom: 0 }]}>
                      {selectedGarage?.name}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                      <MaterialCommunityIcons name="wrench-clock" size={13} color={theme.colors.placeholder} style={{ marginRight: 4 }} />
                      <Text style={[styles.vehicleSubText, { color: theme.colors.placeholder }]}>
                        {selectedService.name} (£{selectedService.price.toFixed(2)}) • {selectedService.duration}m
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </>
        ) : (
          <>
            {/* 1. Dynamic Vehicle Selector */}
            <Text style={[styles.sectionHeading, { color: theme.colors.text, marginTop: 4, marginBottom: 8 }]}>
              Select Vehicle
            </Text>
            {route?.params?.vehicle ? (
              /* If vehicle is passed from portal, lock it and show a premium summary card */
              <View style={[styles.vehicleCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, marginBottom: 14, flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1 }]}>
                <View style={[styles.plate, { marginRight: 12, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, height: 32 }]}>
                  <Text style={[styles.plateText, { fontSize: 12 }]}>{selectedVehicle?.registrationNumber}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.vehicleMakeModel, { color: theme.colors.text, fontSize: 14, fontWeight: 'bold' }]}>
                    {selectedVehicle?.make} {selectedVehicle?.model}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                    <MaterialCommunityIcons name="check-circle" size={13} color={theme.colors.success} style={{ marginRight: 4 }} />
                    <Text style={[styles.vehicleSubText, { color: theme.colors.placeholder, fontSize: 11 }]}>
                      Selected vehicle for MOT booking
                    </Text>
                  </View>
                </View>
              </View>
            ) : activeCustomerVehicles.length === 0 ? (
              <View style={[styles.rescheduleNotice, { backgroundColor: theme.colors.error + '10', borderColor: theme.colors.error + '30', marginBottom: 12 }]}>
                <MaterialCommunityIcons name="alert-circle-outline" size={20} color={theme.colors.error} style={{ marginRight: 8 }} />
                <Text style={[styles.rescheduleNoticeText, { color: theme.colors.text }]}>
                  No active registered vehicles found. Please register a vehicle in My Portal first.
                </Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                {activeCustomerVehicles.map(v => {
                  const isSelected = selectedVehicle && (v.registrationNumber === selectedVehicle.registrationNumber);
                  return (
                    <TouchableOpacity
                      key={v.id || v.registrationNumber}
                      onPress={() => setSelectedVehicle(v)}
                      style={[
                        styles.vehicleSelectorCard,
                        { 
                          backgroundColor: theme.colors.card, 
                          borderColor: isSelected 
                            ? (theme.dark ? theme.colors.secondary : theme.colors.primary) 
                            : theme.colors.border,
                          borderWidth: isSelected ? 2 : 1.5
                        }
                      ]}
                    >
                      <View style={[styles.plate, { marginRight: 8, height: 30, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }]}>
                        <Text style={[styles.plateText, { fontSize: 11 }]}>{v.registrationNumber}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.vehicleMakeModel, { color: theme.colors.text, fontSize: 13, fontWeight: 'bold' }]} numberOfLines={1}>
                          {v.make} {v.model}
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
                        <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: 'bold' }} numberOfLines={1}>
                          {g.name}
                        </Text>
                        <Text style={{ color: theme.colors.placeholder, fontSize: 11, marginTop: 1 }} numberOfLines={1}>
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

            {/* Selected Service details */}
            {selectedGarage && (
              <View style={[styles.vehicleCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, marginBottom: 12 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, color: theme.colors.placeholder, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 }}>
                    Automated Service Package
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                    <View style={[styles.selectedGarageIconCircle, { backgroundColor: theme.colors.secondary + '15' }]}>
                      <MaterialCommunityIcons name="wrench-clock" size={16} color={theme.colors.secondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.vehicleMakeModel, { color: theme.colors.text, fontSize: 13 }]}>
                        {selectedService.name}
                      </Text>
                      <Text style={{ color: theme.colors.placeholder, fontSize: 11, marginTop: 2 }}>
                        Price: £{selectedService.price.toFixed(2)} • Duration: {selectedService.duration} mins
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}
          </>
        )}

        {isReschedule && (
          <View style={[styles.rescheduleNotice, { backgroundColor: theme.colors.warning + '15', borderColor: theme.colors.warning }]}>
            <MaterialCommunityIcons name="alert-circle-outline" size={20} color={theme.colors.warning} style={{ marginRight: 8 }} />
            <Text style={[styles.rescheduleNoticeText, { color: theme.colors.text }]}>
              You are rescheduling your existing MOT booking. The new date and slot will replace your current reservation upon confirmation.
            </Text>
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
                    isToday && !isSelected && { borderWidth: 1, borderColor: theme.colors.secondary, borderRadius: 18 }
                  ]}
                >
                  <Text
                    style={[
                      styles.dayCellText,
                      { color: theme.colors.text },
                      isSelected && { color: '#FFFFFF', fontWeight: 'bold' },
                      !selectable && { color: theme.colors.placeholder + '40' }
                    ]}
                  >
                    {day.getDate()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Time Selector Section (Only Free 45-Min Slots) */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, marginTop: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialCommunityIcons name="clock-outline" size={16} color={theme.colors.placeholder} style={{ marginRight: 6 }} />
            <Text style={[styles.sectionHeading, { color: theme.colors.text, marginBottom: 0 }]}>
              2. Choose Time Slot (45 Mins)
            </Text>
          </View>
          {loadingSlots && <ActivityIndicator size="small" color={theme.colors.secondary} />}
        </View>

        {!selectedGarage ? (
          <View style={[styles.emptySlotsNotice, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <MaterialCommunityIcons name="store-clock-outline" size={22} color={theme.colors.placeholder} />
            <Text style={{ marginLeft: 8, color: theme.colors.placeholder, fontSize: 13 }}>
              Please select a garage above to view available time slots.
            </Text>
          </View>
        ) : loadingSlots ? (
          <View style={[styles.emptySlotsNotice, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <ActivityIndicator size="small" color={theme.colors.secondary} style={{ marginRight: 8 }} />
            <Text style={{ color: theme.colors.placeholder, fontSize: 13 }}>
              Checking available slots for {selectedGarage.name}...
            </Text>
          </View>
        ) : freeSlots.length === 0 ? (
          <View style={[styles.emptySlotsNotice, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <MaterialCommunityIcons name="calendar-remove" size={24} color={theme.colors.error} />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={{ color: theme.colors.text, fontSize: 13.5, fontWeight: '700' }}>
                No Free Slots Available
              </Text>
              <Text style={{ color: theme.colors.placeholder, fontSize: 12, marginTop: 2, lineHeight: 16 }}>
                All MOT slots are fully booked or closed on this date at {selectedGarage.name}. Please choose another date on the calendar above.
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
                      <Text style={[styles.timeLabel, { color: theme.colors.text, fontSize: 14, fontWeight: '800' }]}>
                        {slot.time}
                      </Text>
                      {isSelected ? (
                        <MaterialCommunityIcons name="check-circle" size={16} color={theme.colors.secondary} />
                      ) : (
                        <View style={[styles.freeTag, { backgroundColor: '#10B98115' }]}>
                          <Text style={{ color: '#10B981', fontSize: 10, fontWeight: '700' }}>
                            {slot.availableCount} Open
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.timeText, { color: theme.colors.placeholder, fontSize: 11, marginTop: 2 }]}>
                      {slot.slotLabel || `${slot.time} - ${slot.endTime || '45m'}`}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
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

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          <TouchableOpacity
            onPress={handleConfirmBooking}
            disabled={loading}
            style={[styles.submitBtn, { backgroundColor: isReschedule ? theme.colors.warning : theme.colors.secondary }]}
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
    fontSize: 13,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  navTitle: {
    fontSize: 14,
    fontWeight: 'bold',
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
    color: '#000',
    fontWeight: 'bold',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  vehicleMakeModel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 1,
  },
  vehicleSubText: {
    fontSize: 11,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: 'bold',
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
    fontSize: 13,
    fontWeight: 'bold',
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
    width: '14.2%',
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '600',
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
    fontSize: 13,
    fontWeight: 'bold',
  },
  timeText: {
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
    color: '#FFFFFF',
    fontWeight: 'bold',
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
});
