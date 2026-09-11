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
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Toast from 'react-native-toast-message';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues, BASE_URL } from '../context/DataContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { openGarageDirections } from '../utils/mapUtils';

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
  const { token, user, customers, vehicles, alerts = [], addAlert, addAudit, addVehicle, refreshData } = useAppValues();
  const { garageId } = route.params;
  const { width: screenWidth } = Dimensions.get('window');

  const [garage, setGarage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Booking Flow States
  const [isBookingModalVisible, setIsBookingModalVisible] = useState(false);
  const [selectedMotService, setSelectedMotService] = useState<any>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<any>(route?.params?.vehicle || null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [garageSlots, setGarageSlots] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submittingBooking, setSubmittingBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

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

  // Calculate available working days for the next 14 days
  const availableDates = useMemo(() => {
    const dates = [];
    const today = new Date();
    const workingDays = garage?.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const daysMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(today.getDate() + i);
      const dayName = daysMap[d.getDay()];

      const isWorkingDay = workingDays.some((w: string) => w.toLowerCase() === dayName.toLowerCase());
      if (isWorkingDay) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        dates.push({
          dateStr,
          dayName: dayName.substring(0, 3),
          dayNumber: day,
          monthName: d.toLocaleDateString('en-GB', { month: 'short' }),
        });
      }
    }
    return dates;
  }, [garage?.workingDays]);

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

  const handleOpenBookingModal = (service: any) => {
    if (!token) {
      Alert.alert(
        'Authentication Required',
        'Please sign in to book your MOT appointment.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => navigation.navigate('Login') }
        ]
      );
      return;
    }

    setSelectedMotService(service);
    setBookingSuccess(false);
    setIsBookingModalVisible(true);

    const firstDate = availableDates[0]?.dateStr;
    if (firstDate) {
      setSelectedDate(firstDate);
      fetchSlotsForDate(firstDate);
    }
    if (!selectedVehicle && activeCustomerVehicles.length > 0) {
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
  };



  const handleConfirmBooking = async () => {
    if (!selectedVehicle) {
      Alert.alert('Error', 'Please select a vehicle to book MOT.');
      return;
    }

    if (selectedVehicle.status === 'Pending') {
      Alert.alert(
        'Registration Pending Approval',
        `The registration for ${selectedVehicle.registrationNumber} is currently pending approval by garage staff. You can book an MOT test once it is verified.`
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
        `An MOT appointment request for ${selectedVehicle.registrationNumber} is already awaiting confirmation by garage staff.`
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
        `${selectedVehicle.registrationNumber} already has an active MOT booking.`
      );
      return;
    }

    const daysLeft = getDaysUntilExpiry(selectedVehicle.motExpiryDate);
    if (daysLeft > 30) {
      Alert.alert(
        'Booking Restriction (30-Day Rule)',
        `Under DVSA regulations, you can only book an MOT test when your vehicle is within 30 days of its expiry date.\n\n${selectedVehicle.registrationNumber} has ${daysLeft} days remaining (eligible in ${daysLeft - 30} days).`
      );
      return;
    }

    if (!selectedDate || !selectedTime) {
      Alert.alert('Error', 'Please select an available MOT time slot.');
      return;
    }

    setSubmittingBooking(true);
    try {
      const targetGarageId = garage.id || garage._id || garageId;
      const targetPrice = selectedMotService?.price || 45;
      const targetDuration = selectedSlot?.slotDuration || selectedMotService?.duration || 45;
      const targetSlotTime = selectedSlot?.time || selectedTime;

      await addAlert({
        type: 'BOOKED',
        customerName: `${customer.firstName} ${customer.lastName}`.trim() || user?.name || 'Customer',
        customerId: customer.id,
        garageId: targetGarageId,
        serviceName: selectedMotService?.name || 'MOT Test',
        price: targetPrice,
        duration: targetDuration,
        slotTime: targetSlotTime,
        slotNumber: selectedSlot?.slotNumber,
        registrationNumber: selectedVehicle.registrationNumber,
        makeModel: `${selectedVehicle.make} ${selectedVehicle.model}`.trim(),
        status: 'Pending',
        date: selectedDate,
      });

      await addAudit(
        'MOT Booking Requested',
        `${customer.firstName} ${customer.lastName} requested MOT test slot for ${selectedVehicle.make} ${selectedVehicle.model} (${selectedVehicle.registrationNumber}) at ${garage.name} on ${selectedDate} at ${targetSlotTime}`
      );

      setSubmittingBooking(false);
      setBookingSuccess(true);
      refreshData();

      Toast.show({
        type: 'success',
        text1: 'Booking Requested!',
        text2: `MOT slot confirmed for ${selectedDate} at ${targetSlotTime}`,
      });
    } catch (err: any) {
      setSubmittingBooking(false);
      console.error('Booking confirmation failed:', err);
      Alert.alert('Booking Error', err.message || 'Could not confirm MOT booking slot. Please try again.');
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

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={{ marginTop: 12, color: theme.colors.text }}>Loading garage details...</Text>
      </View>
    );
  }

  if (error || !garage) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color={theme.colors.error} />
        <Text style={{ marginTop: 12, fontSize: 16, color: theme.colors.text, textAlign: 'center' }}>
          {error || 'Garage details not found.'}
        </Text>
        <TouchableOpacity style={[styles.retryButton, { backgroundColor: theme.colors.primary }]} onPress={fetchGarageDetails}>
          <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Filter: ONLY MOT service allowed
  const motServices = (garage.services || []).filter((service: any) => {
    const name = (service.name || '').toUpperCase();
    return name.includes('MOT');
  });

  const displayServices = motServices.length > 0 ? motServices : [
    {
      _id: 'default-mot',
      name: 'MOT Test (Class 4)',
      duration: 45,
      price: 45.00,
      availability: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    }
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Horizontal Garage Images Showcase */}
        {garage.images && garage.images.length > 0 ? (
          <View style={styles.carouselContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              pagingEnabled
              onMomentumScrollEnd={(e) => {
                const offset = e.nativeEvent.contentOffset.x;
                const idx = Math.round(offset / screenWidth);
                setActiveImageIndex(idx);
              }}
              style={styles.imagesCarousel}
            >
              {garage.images.map((imgUrl: string, idx: number) => (
                <GarageCarouselImage 
                  key={`${imgUrl}-${idx}`} 
                  uri={imgUrl} 
                  style={[styles.carouselImage, { width: screenWidth }]} 
                  width={screenWidth}
                />
              ))}
            </ScrollView>

            <View style={styles.carouselBadge}>
              <MaterialCommunityIcons name="camera" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.carouselBadgeText}>
                {activeImageIndex + 1} / {garage.images.length}
              </Text>
            </View>
          </View>
        ) : (
          <GarageCarouselImage
            uri='https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=600&h=300&fit=crop'
            style={[styles.heroImage, { width: screenWidth }]}
            width={screenWidth}
          />
        )}

        {/* Horizontal Padded Content Container */}
        <View style={styles.contentContainer}>
          {/* Banner Logo Section */}
          <View style={[styles.headerCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.headerRow}>
              <GarageLogo 
                uri={garage.logoUrl} 
                name={garage.name} 
                style={styles.logo} 
                theme={theme} 
              />
              <View style={styles.headerInfo}>
                <Text style={[styles.garageName, { color: theme.colors.text }]}>{garage.name}</Text>
                <View style={styles.ratingRow}>
                  <MaterialCommunityIcons name="star" size={16} color="#F59E0B" />
                  <Text style={[styles.ratingText, { color: theme.colors.text }]}>
                    {garage.rating ? garage.rating.toFixed(1) : '4.5'}
                  </Text>
                  {garage.city ? (
                    <>
                      <Text style={{ color: theme.colors.placeholder, marginLeft: 8 }}>•</Text>
                      <Text style={{ color: theme.colors.placeholder, marginLeft: 8, fontSize: 12 }}>
                        {garage.city}
                      </Text>
                    </>
                  ) : null}
                </View>

                {/* DVLA MOT Authorised Station Badge */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B98115', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: '#10B98140' }}>
                    <MaterialCommunityIcons name="shield-check" size={12} color="#10B981" style={{ marginRight: 4 }} />
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#10B981' }}>
                      DVLA MOT Authorised {garage.vtsNumber ? `• ${garage.vtsNumber}` : ''}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <Text style={[styles.description, { color: theme.colors.text }]}>
              {garage.description || 'Welcome to our garage checkups. We offer reliable, fast, and approved MOT testing and vehicle diagnostics.'}
            </Text>
          </View>

          {/* Location & Details */}
          <View style={[styles.sectionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text, marginBottom: 0 }]}>Garage Information</Text>
              <TouchableOpacity
                onPress={() => openGarageDirections({
                  name: garage.name,
                  address: garage.address,
                  city: garage.city,
                  postcode: garage.postcode,
                  latitude: garage.latitude || (garage.location && garage.location.coordinates ? garage.location.coordinates[1] : null),
                  longitude: garage.longitude || (garage.location && garage.location.coordinates ? garage.location.coordinates[0] : null),
                })}
                style={[styles.smallDirectionsBtn, { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary + '40' }]}
              >
                <MaterialCommunityIcons name="navigation-variant" size={14} color={theme.colors.primary} style={{ marginRight: 4 }} />
                <Text style={[styles.smallDirectionsBtnText, { color: theme.colors.primary }]}>Directions</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.infoItem}>
              <MaterialCommunityIcons name="map-marker" size={18} color={theme.colors.secondary} style={styles.infoIcon} />
              <Text style={[styles.infoText, { color: theme.colors.text, flex: 1 }]}>
                {garage.address}{garage.city ? `, ${garage.city}` : ''} {garage.postcode || ''}
              </Text>
            </View>

            {garage.phone ? (
              <View style={styles.infoItem}>
                <MaterialCommunityIcons name="phone-outline" size={18} color={theme.colors.secondary} style={styles.infoIcon} />
                <Text style={[styles.infoText, { color: theme.colors.text }]}>
                  {garage.phone}
                </Text>
              </View>
            ) : null}

            <View style={styles.infoItem}>
              <MaterialCommunityIcons name="clock-outline" size={18} color={theme.colors.secondary} style={styles.infoIcon} />
              <Text style={[styles.infoText, { color: theme.colors.text }]}>
                {garage.openingTime || '08:00'} - {garage.closingTime || '18:00'}
              </Text>
            </View>

            <View style={styles.infoItem}>
              <MaterialCommunityIcons name="calendar-range" size={18} color={theme.colors.secondary} style={styles.infoIcon} />
              <Text style={[styles.infoText, { color: theme.colors.text }]}>
                Open Days: {garage.workingDays ? garage.workingDays.join(', ') : 'Mon - Fri'}
              </Text>
            </View>

            {/* Prominent Full Width Get Directions Button */}
            <TouchableOpacity
              style={[styles.fullDirectionsBtn, { backgroundColor: theme.colors.primary }]}
              onPress={() => openGarageDirections({
                name: garage.name,
                address: garage.address,
                city: garage.city,
                postcode: garage.postcode,
                latitude: garage.latitude || (garage.location && garage.location.coordinates ? garage.location.coordinates[1] : null),
                longitude: garage.longitude || (garage.location && garage.location.coordinates ? garage.location.coordinates[0] : null),
              })}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="directions" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.fullDirectionsBtnText}>Get Directions to Garage</Text>
            </TouchableOpacity>
          </View>

          {/* Facility & Workshop Photos Gallery (5 Images) */}
          {garage.images && garage.images.length > 1 && (
            <View style={[styles.sectionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialCommunityIcons name="image-multiple-outline" size={18} color={theme.colors.primary} style={{ marginRight: 6 }} />
                  <Text style={[styles.sectionTitle, { color: theme.colors.text, marginBottom: 0 }]}>
                    Garage Facility Photos
                  </Text>
                </View>
                <Text style={{ fontSize: 11, color: theme.colors.placeholder }}>
                  {garage.images.length} photos
                </Text>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {garage.images.map((imgUrl: string, idx: number) => (
                  <TouchableOpacity
                    key={`thumb-${imgUrl}-${idx}`}
                    onPress={() => setActiveImageIndex(idx)}
                    activeOpacity={0.8}
                    style={[
                      styles.galleryThumbContainer,
                      { borderColor: activeImageIndex === idx ? theme.colors.primary : theme.colors.border, borderWidth: activeImageIndex === idx ? 2 : 1 }
                    ]}
                  >
                    <Image source={{ uri: imgUrl }} style={styles.galleryThumb} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Available MOT Testing Service Only */}
          <View style={styles.servicesSection}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text, marginBottom: 10 }]}>
              MOT Testing Service
            </Text>

            {displayServices.map((service: any) => (
              <View 
                key={service._id || service.name} 
                style={[styles.serviceCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
              >
                <View style={[styles.serviceIconCircle, { backgroundColor: theme.colors.secondary + '15' }]}>
                  <MaterialCommunityIcons name="car-wrench" size={24} color={theme.colors.secondary} />
                </View>
                <View style={styles.serviceInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[styles.serviceName, { color: theme.colors.text }]}>{service.name}</Text>
                    <View style={[styles.motBadge, { backgroundColor: theme.colors.primary + '15' }]}>
                      <Text style={[styles.motBadgeText, { color: theme.colors.primary }]}>Certified</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    <MaterialCommunityIcons name="timer-outline" size={13} color={theme.colors.placeholder} style={{ marginRight: 4 }} />
                    <Text style={[styles.serviceMeta, { color: theme.colors.placeholder }]}>
                      {service.duration || 45} mins test
                    </Text>
                  </View>
                </View>
                <View style={styles.serviceRight}>
                  <Text style={[styles.servicePrice, { color: theme.colors.text }]}>
                    £{service.price ? Number(service.price).toFixed(2) : '45.00'}
                  </Text>
                  <TouchableOpacity
                    style={[styles.bookBtn, { backgroundColor: theme.colors.primary }]}
                    onPress={() => handleOpenBookingModal(service)}
                  >
                    <Text style={styles.bookBtnText}>Book MOT</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

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
                  Book Certified MOT Slot
                </Text>
                <Text style={[styles.modalHeaderSubtitle, { color: theme.colors.placeholder }]} numberOfLines={1}>
                  {garage.name} • Certified Class 4 Bay
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
                  MOT Booking Requested!
                </Text>
                <Text style={[styles.successSubtitle, { color: theme.colors.placeholder }]}>
                  Your appointment request has been submitted to {garage.name}. Garage technicians will confirm your MOT slot.
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
                    <Text style={[styles.summaryLabel, { color: theme.colors.placeholder }]}>Date & Time:</Text>
                    <Text style={[styles.summaryValue, { color: theme.colors.primary, fontWeight: 'bold' }]}>
                      {formatDisplayDate(selectedDate)} at {selectedTime}
                    </Text>
                  </View>
                  <View style={[styles.summaryRow, { borderBottomWidth: 0 }]}>
                    <Text style={[styles.summaryLabel, { color: theme.colors.placeholder }]}>Test Fee:</Text>
                    <Text style={[styles.summaryValue, { color: theme.colors.text, fontWeight: 'bold' }]}>
                      £{selectedMotService?.price ? Number(selectedMotService.price).toFixed(2) : '45.00'}
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
                {/* 1. Vehicle Selection Section */}
                <View style={styles.flowSection}>
                  <View style={styles.flowSectionHeader}>
                    <MaterialCommunityIcons name="car-cog" size={18} color={theme.colors.primary} style={{ marginRight: 6 }} />
                    <Text style={[styles.flowSectionTitle, { color: theme.colors.text }]}>
                      1. Select Your Active Vehicle
                    </Text>
                  </View>
                  <Text style={[styles.flowSectionSubtitle, { color: theme.colors.placeholder }]}>
                    Choose which registered vehicle is attending the MOT test
                  </Text>

                  {/* DVSA 30-Day Limit Notice */}
                  <View style={[styles.dvsaNoticeBox, { backgroundColor: theme.colors.primary + '10', borderColor: theme.colors.primary + '30' }]}>
                    <MaterialCommunityIcons name="information-outline" size={16} color={theme.colors.primary} style={{ marginRight: 6 }} />
                    <Text style={[styles.dvsaNoticeText, { color: theme.colors.text }]}>
                      DVSA 30-Day Rule: Vehicles can only be booked for MOT testing within 30 days of their expiry date.
                    </Text>
                  </View>

                  {activeCustomerVehicles.length === 0 ? (
                    <View style={[styles.emptyVehicleNotice, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                      <MaterialCommunityIcons name="car-off" size={28} color={theme.colors.placeholder} />
                      <Text style={[styles.emptyVehicleText, { color: theme.colors.placeholder }]}>
                        No active registered vehicles found in your account. Please register your vehicle in My Portal.
                      </Text>
                      <TouchableOpacity
                        style={[styles.enterVrnBtn, { backgroundColor: theme.colors.primary + '15' }]}
                        onPress={() => {
                          setIsBookingModalVisible(false);
                          navigation.navigate('Main', { screen: 'My Portal' });
                        }}
                      >
                        <Text style={[styles.enterVrnBtnText, { color: theme.colors.primary }]}>
                          Manage Vehicles in Portal
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ marginTop: 8 }}>
                      {activeCustomerVehicles.map((veh) => {
                        const isSelected = selectedVehicle?.registrationNumber?.toUpperCase() === veh.registrationNumber?.toUpperCase();
                        const daysLeft = getDaysUntilExpiry(veh.motExpiryDate);
                        const is30DayEligible = daysLeft <= 30;
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

                        const isEligible = is30DayEligible && !isPendingApproval && !isRejected && !pendingBookingAlert && !activeBookingAlert;

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
                          badgeText = 'Expired (Eligible)';
                          badgeBg = theme.colors.error + '18';
                          badgeColor = theme.colors.error;
                          statusIconName = 'alert-circle';
                        } else if (daysLeft <= 30) {
                          badgeText = `${daysLeft}d left (Eligible)`;
                          badgeBg = theme.colors.success + '18';
                          badgeColor = theme.colors.success;
                          statusIconName = 'check-circle-outline';
                        } else {
                          badgeText = `Not Due Yet (${daysLeft}d left)`;
                          badgeBg = theme.colors.placeholder + '20';
                          badgeColor = theme.colors.placeholder;
                          statusIconName = 'clock-alert-outline';
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
                        } else if (!is30DayEligible) {
                          rightIcon = 'clock-alert-outline';
                          rightIconColor = theme.colors.placeholder;
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
                                backgroundColor: isSelected ? theme.colors.primary + '10' : theme.colors.card, 
                                borderColor: isSelected ? theme.colors.primary : (isEligible ? theme.colors.border : theme.colors.placeholder + '30'),
                                borderWidth: isSelected ? 1.5 : 1,
                                opacity: isEligible ? 1 : 0.7,
                                elevation: isEligible ? 1 : 0,
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
                              if (!is30DayEligible) {
                                Alert.alert(
                                  'Booking Restriction (30-Day Rule)',
                                  `Under DVSA regulations, you can only book an MOT test when your vehicle is within 30 days of its expiry date.\n\n${veh.registrationNumber} has ${daysLeft} days remaining (eligible in ${daysLeft - 30} days).`
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
                                  MOT Expiry: {formatDisplayDate(veh.motExpiryDate) || 'N/A'}
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
                          <View style={[styles.inlineNotice, { backgroundColor: theme.colors.placeholder + '15', borderColor: theme.colors.border }]}>
                            <MaterialCommunityIcons name="clock-alert-outline" size={18} color={theme.colors.placeholder} style={{ marginRight: 8 }} />
                            <Text style={[styles.inlineNoticeText, { color: theme.colors.text }]}>
                              <Text style={{ fontWeight: 'bold' }}>MOT Not Due Yet:</Text> {selectedVehicle.registrationNumber} has {getDaysUntilExpiry(selectedVehicle.motExpiryDate)} days left. Bookings open 30 days before expiry.
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
                      2. Choose MOT Appointment Date
                    </Text>
                  </View>
                  <Text style={[styles.flowSectionSubtitle, { color: theme.colors.placeholder }]}>
                    Select from verified operating days for {garage.name}
                  </Text>

                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false} 
                    style={styles.dateScrollView}
                    contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
                  >
                    {availableDates.map((item) => {
                      const isDateActive = selectedDate === item.dateStr;
                      return (
                        <TouchableOpacity
                          key={item.dateStr}
                          style={[
                            styles.dateChip,
                            {
                              backgroundColor: isDateActive ? theme.colors.primary : theme.colors.card,
                              borderColor: isDateActive ? theme.colors.primary : theme.colors.border,
                            }
                          ]}
                          onPress={() => setSelectedDate(item.dateStr)}
                        >
                          <Text style={[styles.dateChipDay, { color: isDateActive ? '#FFFFFF' : theme.colors.placeholder }]}>
                            {item.dayName}
                          </Text>
                          <Text style={[styles.dateChipNumber, { color: isDateActive ? '#FFFFFF' : theme.colors.text }]}>
                            {item.dayNumber}
                          </Text>
                          <Text style={[styles.dateChipMonth, { color: isDateActive ? '#FFFFFF' : theme.colors.placeholder }]}>
                            {item.monthName}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* 3. Slot Selection Section */}
                <View style={styles.flowSection}>
                  <View style={styles.flowSectionHeader}>
                    <MaterialCommunityIcons name="clock-outline" size={18} color={theme.colors.primary} style={{ marginRight: 6 }} />
                    <Text style={[styles.flowSectionTitle, { color: theme.colors.text }]}>
                      3. Select 45-Min Test Slot
                    </Text>
                  </View>
                  <Text style={[styles.flowSectionSubtitle, { color: theme.colors.placeholder }]}>
                    Live MOT bay slots for {formatDisplayDate(selectedDate)}
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

                {/* 4. Booking Summary Card */}
                <View style={[styles.summaryCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                  <Text style={[styles.summaryCardTitle, { color: theme.colors.text }]}>
                    MOT Booking Summary
                  </Text>

                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: theme.colors.placeholder }]}>Test Center:</Text>
                    <Text style={[styles.summaryValue, { color: theme.colors.text }]}>{garage.name}</Text>
                  </View>

                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: theme.colors.placeholder }]}>Service:</Text>
                    <Text style={[styles.summaryValue, { color: theme.colors.text, fontWeight: 'bold' }]}>
                      {selectedMotService?.name || 'MOT Test (Class 4 Bay)'}
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
                      {selectedDate && selectedTime ? `${formatDisplayDate(selectedDate)} at ${selectedTime}` : 'Select date & slot'}
                    </Text>
                  </View>

                  <View style={[styles.summaryRow, { borderBottomWidth: 0, paddingTop: 10 }]}>
                    <Text style={[styles.summaryTotalLabel, { color: theme.colors.text }]}>Total Fee:</Text>
                    <Text style={[styles.summaryTotalPrice, { color: theme.colors.primary }]}>
                      £{selectedMotService?.price ? Number(selectedMotService.price).toFixed(2) : '45.00'}
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
                  const isVehicleEligible = selectedVehicle && (daysLeft <= 30) && !isPendingApproval && !isRejected && !hasPendingBooking && !hasApprovedBooking;

                  let buttonLabel = `Confirm MOT Booking • £${selectedMotService?.price ? Number(selectedMotService.price).toFixed(2) : '45.00'}`;
                  if (!selectedVehicle) buttonLabel = 'Select a Vehicle';
                  else if (isPendingApproval) buttonLabel = 'Registration Pending Approval';
                  else if (isRejected) buttonLabel = 'Registration Rejected';
                  else if (hasPendingBooking) buttonLabel = 'Booking Already Pending';
                  else if (hasApprovedBooking) buttonLabel = 'Vehicle Already Booked';
                  else if (daysLeft > 30) buttonLabel = 'Not Due Yet (Ineligible)';
                  else if (!selectedTime) buttonLabel = 'Select a Test Slot';

                  const canSubmit = isVehicleEligible && selectedDate && selectedTime && !submittingBooking;

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
  serviceCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
  },
  serviceIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  serviceInfo: {
    flex: 1,
    paddingRight: 10,
  },
  serviceName: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 3,
  },
  motBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  motBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  serviceMeta: {
    fontSize: 11,
  },
  serviceRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  servicePrice: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  bookBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
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
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
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

  dateScrollView: {
    marginTop: 4,
  },
  dateChip: {
    width: 64,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateChipDay: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  dateChipNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 2,
  },
  dateChipMonth: {
    fontSize: 10,
    fontWeight: '500',
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
});
