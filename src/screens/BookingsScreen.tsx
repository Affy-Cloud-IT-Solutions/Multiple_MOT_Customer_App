import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
  Linking,
  Modal,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues } from '../context/DataContext';
import CustomerHeader from '../components/CustomerHeader';
import { openGarageDirections } from '../utils/mapUtils';
import { fonts } from '../theme/theme';
import { formatBookingDate, formatDateWithWeekday, formatShortDate } from '../utils/dateUtils';

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const toYMD = (dateVal: any): string | null => {
  if (!dateVal) return null;
  if (typeof dateVal === 'string') {
    const matchIso = dateVal.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (matchIso) {
      return `${matchIso[1]}-${matchIso[2].padStart(2, '0')}-${matchIso[3].padStart(2, '0')}`;
    }
    const matchUk = dateVal.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (matchUk) {
      return `${matchUk[3]}-${matchUk[2].padStart(2, '0')}-${matchUk[1].padStart(2, '0')}`;
    }
  }
  try {
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  } catch (e) {}
  return null;
};

export default function BookingsScreen({ navigation }: any) {
  const { theme } = useAppTheme();
  const {
    token,
    user,
    customers,
    alerts = [],
    refreshData,
    cancelBooking,
    dismissedAlertIds = [],
    dismissCustomerAlert,
  } = useAppValues();

  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'CONFIRMED' | 'IN_PROGRESS' | 'PENDING' | 'REJECTED' | 'COMPLETED' | 'CANCELLED'>('ALL');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'CUSTOM'>('ALL');
  const [selectedCustomDate, setSelectedCustomDate] = useState<string | null>(null);
  const [calendarModalVisible, setCalendarModalVisible] = useState(false);
  const [currentViewDate, setCurrentViewDate] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [selectedBookingForDetails, setSelectedBookingForDetails] = useState<any | null>(null);

  // Active customer resolution
  const customerId = user?.customerId || user?.id || '';
  const customer: any = customers.find((c) =>
    (customerId && (
      String(c.id).toLowerCase() === String(customerId).toLowerCase() ||
      String(c._id).toLowerCase() === String(customerId).toLowerCase()
    ))
  ) || {
    id: customerId,
    _id: customerId,
    firstName: user?.name?.split(' ')[0] || 'Customer',
    lastName: user?.name?.split(' ').slice(1).join(' ') || '',
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshData();
    } catch (e) {
      console.error('[BookingsScreen] Refresh error:', e);
    } finally {
      setRefreshing(false);
    }
  }, [refreshData]);

  useFocusEffect(
    useCallback(() => {
      refreshData();
    }, [refreshData])
  );

  // Extract all BOOKED alerts belonging strictly to current logged-in customer
  const allCustomerBookings = useMemo(() => {
    if (!token) return [];

    const validCustIds = [
      customerId,
      customer?.id,
      customer?._id,
      user?.customerId,
      user?.id,
    ].filter(Boolean).map((id) => String(id).toLowerCase());

    const userEmail = (user?.email || customer?.email || '').trim().toLowerCase();

    return alerts
      .filter((a) => {
        if (a.type !== 'BOOKED') return false;

        // Strictly match by customerId
        if (a.customerId && validCustIds.includes(String(a.customerId).toLowerCase())) {
          return true;
        }

        // Match by customerEmail
        if (userEmail && a.customerEmail && String(a.customerEmail).toLowerCase() === userEmail) {
          return true;
        }

        return false;
      })
      .sort((a, b) => {
        const dateA = new Date(a.date || 0).getTime();
        const dateB = new Date(b.date || 0).getTime();
        return dateB - dateA;
      });
  }, [alerts, token, customerId, customer, user]);

  // Set of dates with customer bookings for calendar dots
  const datesWithBookingsSet = useMemo(() => {
    const set = new Set<string>();
    allCustomerBookings.forEach((a) => {
      const ymd = toYMD(a.date);
      if (ymd) set.add(ymd);
    });
    return set;
  }, [allCustomerBookings]);

  // Calendar dates & navigation
  const todayDateObj = useMemo(() => new Date(), []);
  const todayYMD = useMemo(() => toYMD(todayDateObj) || '', [todayDateObj]);

  const handlePrevMonth = () => {
    setCurrentViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleJumpToToday = () => {
    const today = new Date();
    setCurrentViewDate(today);
    setDateFilter('CUSTOM');
    setSelectedCustomDate(todayYMD);
    setCalendarModalVisible(false);
  };

  // Generate days grid for current viewed month
  const calendarDays = useMemo(() => {
    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();

    const days: (Date | null)[] = [];
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }
    for (let d = 1; d <= lastDate; d++) {
      days.push(new Date(year, month, d));
    }
    return days;
  }, [currentViewDate]);

  // Active rejected bookings alerts for banner (minus the ones the customer dismissed)
  const rejectedAlerts = useMemo(() => {
    if (!token) return [];
    return allCustomerBookings.filter((a) => {
      const alertId = a.id || (a as any)._id;
      return a.status === 'Rejected' && !a.customerDismissedAt && !dismissedAlertIds.includes(alertId);
    });
  }, [allCustomerBookings, token, dismissedAlertIds]);

  // Counts for filter pills
  const counts = useMemo(() => {
    let pending = 0;
    let confirmed = 0;
    let inProgress = 0;
    let rejected = 0;
    let completed = 0;
    let cancelled = 0;

    allCustomerBookings.forEach((b) => {
      const s = (b.status || '').toLowerCase();
      if (s === 'pending') pending++;
      else if (s === 'in progress' || s === 'inprogress') inProgress++;
      else if (s === 'approved' || s === 'confirmed' || s === 'acknowledged') confirmed++;
      else if (s === 'completed') completed++;
      else if (s === 'rejected') rejected++;
      else if (s === 'cancelled') cancelled++;
    });

    return {
      ALL: allCustomerBookings.length,
      CONFIRMED: confirmed,
      IN_PROGRESS: inProgress,
      PENDING: pending,
      REJECTED: rejected,
      COMPLETED: completed,
      CANCELLED: cancelled,
    };
  }, [allCustomerBookings]);

  // Filtered & searched bookings
  const filteredBookings = useMemo(() => {
    return allCustomerBookings.filter((b) => {
      const s = (b.status || '').toLowerCase();
      const isPending = s === 'pending';
      const isConfirmed = s === 'approved' || s === 'confirmed' || s === 'acknowledged';
      const isInProgress = s === 'in progress' || s === 'inprogress';
      const isCompleted = s === 'completed';
      const isRejected = s === 'rejected';
      const isCancelled = s === 'cancelled';

      let matchFilter = true;
      if (selectedFilter === 'CONFIRMED') matchFilter = isConfirmed;
      else if (selectedFilter === 'IN_PROGRESS') matchFilter = isInProgress;
      else if (selectedFilter === 'PENDING') matchFilter = isPending;
      else if (selectedFilter === 'REJECTED') matchFilter = isRejected;
      else if (selectedFilter === 'COMPLETED') matchFilter = isCompleted;
      else if (selectedFilter === 'CANCELLED') matchFilter = isCancelled;

      if (!matchFilter) return false;

      // Date filter: strictly matches custom date if selected
      if (dateFilter === 'CUSTOM' && selectedCustomDate) {
        const itemYMD = toYMD(b.date);
        if (itemYMD !== selectedCustomDate) return false;
      }

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const reg = (b.registrationNumber || '').toLowerCase();
      const mm = (b.makeModel || '').toLowerCase();
      const gn = (b.garageName || b.stationName || b.garage?.name || '').toLowerCase();
      const svc = (b.serviceName || '').toLowerCase();

      return reg.includes(q) || mm.includes(q) || gn.includes(q) || svc.includes(q);
    });
  }, [allCustomerBookings, selectedFilter, dateFilter, selectedCustomDate, searchQuery]);

  const handleCancel = (booking: any) => {
    const bookingId = booking.id || booking._id;
    const reg = booking.registrationNumber || 'Vehicle';

    Alert.alert(
      'Cancel Appointment',
      `Are you sure you want to cancel the booking for ${reg}?\n\nThe allocated appointment slot will be released.`,
      [
        { text: 'Keep Appointment', style: 'cancel' },
        {
          text: 'Cancel Booking',
          style: 'destructive',
          onPress: async () => {
            setCancellingId(bookingId);
            try {
              if (cancelBooking) {
                await cancelBooking(bookingId, 'Cancelled by customer');
              }
              await refreshData();
              setSelectedBookingForDetails(null);
              Alert.alert('Booking Cancelled', 'Your appointment has been cancelled successfully.');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to cancel appointment.');
            } finally {
              setCancellingId(null);
            }
          },
        },
      ]
    );
  };

  const handleReschedule = (booking: any) => {
    setSelectedBookingForDetails(null);
    const isMot = booking.hasMot !== false && (
      booking.hasMot === true ||
      (booking.serviceName && booking.serviceName.toLowerCase().includes('mot')) ||
      Boolean(booking.slotTime)
    );

    const vehicleObj = {
      registrationNumber: booking.registrationNumber,
      make: booking.makeModel ? booking.makeModel.split(' ')[0] : 'Vehicle',
      model: booking.makeModel ? booking.makeModel.split(' ').slice(1).join(' ').replace(/ - Slot:.*$/, '').replace(/ - .*$/, '') : '',
      customerId: booking.customerId || customer.id || customer._id,
    };

    const gId = typeof booking.garageId === 'object' ? (booking.garageId?._id || booking.garageId?.id) : booking.garageId;
    const gName = booking.garageName || (typeof booking.garageId === 'object' ? (booking.garageId?.name || booking.garageId?.garageName) : '') || '';

    navigation.navigate('Booking', {
      isReschedule: true,
      activeBooking: booking,
      vehicle: vehicleObj,
      garageId: gId,
      garageName: gName,
      serviceName: booking.serviceName || (isMot ? 'MOT Test' : 'Vehicle Service'),
      hasMot: isMot,
      isDateOnly: !isMot,
      bookedDate: booking.date,
      slotTime: booking.slotTime || '',
      slotNumber: booking.slotNumber,
      price: booking.price,
    });
  };

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return 'Selected Date';
    return formatDateWithWeekday(dateStr);
  };

  const getSlotDisplay = (makeModel?: string, slotTime?: string, isDateOnly?: boolean, hasMot?: boolean) => {
    if (isDateOnly || hasMot === false || slotTime === 'Drop-off (Full Day)' || slotTime === 'Full Day Drop-off') {
      return 'Workshop Drop-off (Full Day)';
    }
    if (slotTime) return slotTime;
    if (makeModel && makeModel.includes(' - Slot: ')) {
      return makeModel.split(' - Slot: ')[1];
    }
    return 'Regular Slot';
  };

  const getVehicleDisplay = (makeModel?: string) => {
    if (!makeModel) return 'Vehicle Service Appointment';
    if (makeModel.includes(' - Slot: ')) {
      return makeModel.split(' - Slot: ')[0];
    }
    return makeModel;
  };

  const getStatusConfig = (rawStatus?: string) => {
    const s = (rawStatus || 'Pending').toLowerCase();
    if (s === 'in progress' || s === 'inprogress') {
      return {
        isPending: false,
        isConfirmed: false,
        isInProgress: true,
        isCompleted: false,
        isCancelled: false,
        isRejected: false,
        color: '#8B5CF6',
        bg: '#8B5CF618',
        icon: 'car-wrench',
        text: 'In Workshop',
        desc: 'Vehicle is currently inside the workshop ramp. Service has started.',
      };
    }
    if (s === 'approved' || s === 'confirmed' || s === 'acknowledged') {
      return {
        isPending: false,
        isConfirmed: true,
        isInProgress: false,
        isCompleted: false,
        isCancelled: false,
        isRejected: false,
        color: '#10B981',
        bg: '#10B98115',
        icon: 'check-decagram-outline',
        text: 'Approved',
        desc: 'Appointment is confirmed. The test bay is reserved for your vehicle.',
      };
    }
    if (s === 'completed') {
      return {
        isPending: false,
        isConfirmed: false,
        isInProgress: false,
        isCompleted: true,
        isCancelled: false,
        isRejected: false,
        color: '#3B82F6',
        bg: '#3B82F615',
        icon: 'checkbox-marked-circle-outline',
        text: 'Completed',
        desc: 'This inspection has been conducted and completed.',
      };
    }
    if (s === 'cancelled') {
      return {
        isPending: false,
        isConfirmed: false,
        isInProgress: false,
        isCompleted: false,
        isCancelled: true,
        isRejected: false,
        color: '#EF4444',
        bg: '#EF444415',
        icon: 'close-circle-outline',
        text: 'Cancelled',
        desc: 'This booking has been cancelled.',
      };
    }
    if (s === 'rejected') {
      return {
        isPending: false,
        isConfirmed: false,
        isInProgress: false,
        isCompleted: false,
        isCancelled: false,
        isRejected: true,
        color: '#DC2626',
        bg: '#DC262615',
        icon: 'alert-circle-outline',
        text: 'Rejected',
        desc: 'The garage was unable to accept this appointment slot.',
      };
    }
    return {
      isPending: true,
      isConfirmed: false,
      isInProgress: false,
      isCompleted: false,
      isCancelled: false,
      isRejected: false,
      color: '#F59E0B',
      bg: '#F59E0B15',
      icon: 'timer-sand',
      text: 'Pending Confirmation',
      desc: 'Awaiting confirmation and bay assignment from the testing centre.',
    };
  };

  if (!token) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <CustomerHeader
          title="My Bookings"
          subtitle="Live Service & MOT Appointments"
          iconName="calendar-clock"
          iconColor={theme.colors.secondary}
          iconBg={theme.colors.secondary + '15'}
        />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <MaterialCommunityIcons
            name="account-lock-outline"
            size={72}
            color={theme.colors.placeholder}
            style={{ marginBottom: 16 }}
          />
          <Text style={{ fontSize: 20, fontFamily: fonts.bold, color: theme.colors.text, marginBottom: 8, textAlign: 'center' }}>
            Access Your Bookings
          </Text>
          <Text style={{ fontSize: 13, fontFamily: fonts.regular, color: theme.colors.placeholder, textAlign: 'center', marginBottom: 24, paddingHorizontal: 20, lineHeight: 18 }}>
            Please sign in to view and manage your scheduled service & MOT appointments, track live statuses, and reschedule slots.
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Login')}
            style={{
              backgroundColor: theme.colors.primary,
              paddingHorizontal: 28,
              paddingVertical: 12,
              borderRadius: 8,
              elevation: 2,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 2,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontFamily: fonts.bold, fontSize: 14 }}>
              Sign In / Sign Up
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* 1. Customer Header with Great UI */}
      <CustomerHeader
        title="My Bookings"
        subtitle="Live Service & MOT Appointments"
        iconName="calendar-clock"
        iconColor={theme.colors.secondary}
        iconBg={theme.colors.secondary + '15'}
        rightAction={
          <TouchableOpacity
            onPress={onRefresh}
            style={[styles.refreshBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons
              name="refresh"
              size={18}
              color={theme.colors.secondary}
            />
          </TouchableOpacity>
        }
      />

      {/* Filter Tabs & Search */}
      <View style={[styles.filterContainer, { backgroundColor: theme.colors.background }]}>
        {/* Search Bar with Calendar Icon */}
        <View style={styles.searchRow}>
          <View style={[styles.searchBox, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <MaterialCommunityIcons name="magnify" size={18} color={theme.colors.placeholder} style={{ marginRight: 6 }} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by reg, vehicle or garage..."
              placeholderTextColor={theme.colors.placeholder}
              style={[styles.searchInput, { color: theme.colors.text }]}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialCommunityIcons name="close-circle" size={16} color={theme.colors.placeholder} />
              </TouchableOpacity>
            )}
          </View>

          {/* Calendar Picker Button */}
          <TouchableOpacity
            style={[
              styles.calendarIconBtn,
              {
                backgroundColor: (dateFilter === 'CUSTOM' && selectedCustomDate) ? theme.colors.secondary : theme.colors.card,
                borderColor: (dateFilter === 'CUSTOM' && selectedCustomDate) ? theme.colors.secondary : theme.colors.border,
              }
            ]}
            onPress={() => setCalendarModalVisible(true)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="calendar-month-outline"
              size={20}
              color={(dateFilter === 'CUSTOM' && selectedCustomDate) ? '#FFFFFF' : theme.colors.text}
            />
            {(dateFilter === 'CUSTOM' && selectedCustomDate) && (
              <View style={styles.calendarActiveDot} />
            )}
          </TouchableOpacity>
        </View>

        {/* Active Custom Date Pill */}
        {dateFilter === 'CUSTOM' && selectedCustomDate && (
          <View style={styles.activeDatePillRow}>
            <TouchableOpacity
              style={[
                styles.activeDatePill,
                {
                  backgroundColor: '#0284C715',
                  borderColor: '#0284C7',
                }
              ]}
              onPress={() => setCalendarModalVisible(true)}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="calendar-check" size={14} color="#0284C7" />
              <Text style={[styles.activeDatePillText, { color: '#0284C7' }]}>
                {formatShortDate(selectedCustomDate)}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setDateFilter('ALL');
                  setSelectedCustomDate(null);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.clearDateCross}
              >
                <MaterialCommunityIcons name="close" size={14} color="#0284C7" />
              </TouchableOpacity>
            </TouchableOpacity>
          </View>
        )}

        {/* Filter Chips Scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScroll}
        >
          {[
            { key: 'ALL', label: 'All', count: counts.ALL },
            { key: 'CONFIRMED', label: 'Approved', count: counts.CONFIRMED },
            { key: 'IN_PROGRESS', label: 'In Workshop', count: counts.IN_PROGRESS },
            { key: 'PENDING', label: 'Pending', count: counts.PENDING },
            { key: 'REJECTED', label: 'Rejected', count: counts.REJECTED },
            { key: 'COMPLETED', label: 'Completed', count: counts.COMPLETED },
            { key: 'CANCELLED', label: 'Cancelled', count: counts.CANCELLED },
          ].map((f) => {
            const isSelected = selectedFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setSelectedFilter(f.key as any)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isSelected ? theme.colors.secondary : theme.colors.card,
                    borderColor: isSelected ? theme.colors.secondary : theme.colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    {
                      color: isSelected ? '#FFFFFF' : theme.colors.text,
                      fontFamily: isSelected ? fonts.bold : fonts.semiBold,
                    },
                  ]}
                >
                  {f.label} ({f.count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Bookings List */}
      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.secondary]}
            tintColor={theme.colors.secondary}
          />
        }
      >
        {/* Rejected Booking Notifications Banner with Dismiss button */}
        {rejectedAlerts.length > 0 && (
          <View style={styles.rejectedBannerContainer}>
            {rejectedAlerts.map((alert) => (
              <View
                key={alert.id || (alert as any)._id}
                style={[
                  styles.notificationAlertBox,
                  { backgroundColor: '#DC262612', borderColor: '#DC262635' },
                ]}
              >
                <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#DC2626" style={{ marginTop: 2 }} />
                <View style={{ flex: 1, marginHorizontal: 8 }}>
                  <Text style={[styles.notificationAlertTitle, { color: '#DC2626' }]}>
                    Booking Rejected by Garage
                  </Text>
                  <Text style={[styles.notificationAlertText, { color: theme.colors.text }]}>
                    Booking request for <Text style={{ fontFamily: fonts.bold }}>{alert.registrationNumber}</Text> was rejected: "{alert.rejectionReason || 'No reason provided'}"
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    // Customers dismiss (hide) the notification; "acknowledge" is a garage action that is denied
                    // for customers and would also change the booking's status
                    dismissCustomerAlert(alert.id || (alert as any)._id);
                  }}
                  style={[styles.notificationDismissBtn, { backgroundColor: '#DC262620' }]}
                >
                  <Text style={[styles.notificationDismissText, { color: '#DC2626' }]}>Dismiss</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
        {filteredBookings.length === 0 ? (
          <View style={[styles.emptyContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={[styles.emptyIconCircle, { backgroundColor: theme.colors.secondary + '15' }]}>
              <MaterialCommunityIcons name="calendar-blank-outline" size={42} color={theme.colors.secondary} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Bookings Found</Text>
            <Text style={[styles.emptySubtitle, { color: theme.colors.placeholder }]}>
              {searchQuery
                ? `No appointments match "${searchQuery}".`
                : (dateFilter === 'CUSTOM' && selectedCustomDate)
                ? `No appointments found on ${formatShortDate(selectedCustomDate)}.`
                : selectedFilter !== 'ALL'
                ? `You have no ${selectedFilter.toLowerCase()} bookings.`
                : 'You have not booked any vehicle service appointments yet.'}
            </Text>

            {dateFilter === 'CUSTOM' && selectedCustomDate ? (
              <TouchableOpacity
                onPress={() => {
                  setDateFilter('ALL');
                  setSelectedCustomDate(null);
                }}
                style={[styles.bookNowBtn, { backgroundColor: theme.colors.secondary, marginTop: 12 }]}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="calendar-refresh" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.bookNowBtnText}>Show All Dates</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => navigation.navigate('Garages')}
                style={[styles.bookNowBtn, { backgroundColor: theme.colors.secondary }]}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="store-search-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.bookNowBtnText}>Find Garage & Book Service</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredBookings.map((item) => {
            const statusCfg = getStatusConfig(item.status);
            const isCancelling = cancellingId === (item.id || item._id);

            return (
              <View
                key={item.id || item._id || `${item.registrationNumber}-${item.date}`}
                style={[styles.bookingCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
              >
                {/* 1. Header: UK Plate + Status Tag + Info Button */}
                <View style={styles.cardHeaderRow}>
                  <View style={styles.ukPlateChip}>
                    <View style={styles.ukFlagBlock}>
                      <Text style={styles.ukFlagText}>🇬🇧</Text>
                      <Text style={styles.ukTagText}>UK</Text>
                    </View>
                    <Text style={styles.ukPlateNumber}>{item.registrationNumber}</Text>
                  </View>

                  <View style={styles.headerRightActions}>
                    <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg, borderColor: statusCfg.color + '40' }]}>
                      <MaterialCommunityIcons name={statusCfg.icon} size={11} color={statusCfg.color} style={{ marginRight: 3 }} />
                      <Text style={[styles.statusBadgeText, { color: statusCfg.color }]}>{statusCfg.text}</Text>
                    </View>

                    {/* Modern Info Icon Button */}
                    <TouchableOpacity
                      onPress={() => setSelectedBookingForDetails(item)}
                      style={[styles.infoIconBtn, { backgroundColor: theme.colors.secondary + '15', borderColor: theme.colors.secondary + '35' }]}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons name="information-variant" size={15} color={theme.colors.secondary} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 2. Car Name */}
                <View style={styles.vehicleRow}>
                  <MaterialCommunityIcons name="car-sports" size={15} color={theme.colors.secondary} style={{ marginRight: 5 }} />
                  <Text style={[styles.vehicleName, { color: theme.colors.text }]} numberOfLines={1}>
                    {getVehicleDisplay(item.makeModel)}
                  </Text>
                </View>

                {/* 3. Type of Service */}
                <View style={styles.serviceRow}>
                  <MaterialCommunityIcons name="wrench-outline" size={13} color={theme.colors.placeholder} style={{ marginRight: 5 }} />
                  <Text style={[styles.serviceNameText, { color: theme.colors.placeholder }]} numberOfLines={1}>
                    {item.serviceName || 'Vehicle Service & Inspection'}
                  </Text>
                  {item.price ? (
                    <Text style={[styles.priceTag, { color: theme.colors.secondary }]}>
                      • £{Number(item.price).toFixed(2)}
                    </Text>
                  ) : null}
                </View>

                {/* Multiple Services tags if more than 1 service */}
                {Array.isArray(item.services) && item.services.length > 1 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 4, marginBottom: 4 }}>
                    {item.services.map((s: any, idx: number) => {
                      const sName = typeof s === 'string' ? s : s?.name || '';
                      return (
                        <View
                          key={idx}
                          style={{
                            backgroundColor: theme.colors.secondary + '15',
                            paddingHorizontal: 7,
                            paddingVertical: 2,
                            borderRadius: 6,
                            borderWidth: 1,
                            borderColor: theme.colors.secondary + '30',
                          }}
                        >
                          <Text style={{ fontSize: 10.5, fontFamily: fonts.semiBold, color: theme.colors.secondary }}>
                            {sName}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* 4. Appointment Date & Time Slot */}
                <View style={[styles.appointmentInfoBox, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                  <View style={styles.dateSlotRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <MaterialCommunityIcons name="calendar-month-outline" size={14} color={theme.colors.secondary} style={{ marginRight: 5 }} />
                      <View>
                        <Text style={[styles.dateLabel, { color: theme.colors.placeholder }]}>
                          {item.isDateOnly || item.hasMot === false ? 'DROP-OFF DATE' : 'APPOINTMENT DATE'}
                        </Text>
                        <Text style={[styles.dateValue, { color: theme.colors.text }]}>
                          {formatDisplayDate(item.date)}
                        </Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <MaterialCommunityIcons
                        name={item.isDateOnly || item.hasMot === false ? 'car-clock' : 'clock-time-four-outline'}
                        size={14}
                        color={theme.colors.secondary}
                        style={{ marginRight: 5 }}
                      />
                      <View>
                        <Text style={[styles.dateLabel, { color: theme.colors.placeholder }]}>
                          {item.isDateOnly || item.hasMot === false ? 'INTAKE' : 'TIME SLOT'}
                        </Text>
                        <Text style={[styles.dateValue, { color: theme.colors.text }]}>
                          {getSlotDisplay(item.makeModel, item.slotTime, item.isDateOnly, item.hasMot)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Active In-Workshop / Ramp Banner */}
                {statusCfg.isInProgress && (
                  <View style={[styles.cardProgressBox, { backgroundColor: '#8B5CF612', borderColor: '#8B5CF635' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <MaterialCommunityIcons name="car-wrench" size={15} color="#8B5CF6" style={{ marginRight: 6 }} />
                        <Text style={{ color: '#8B5CF6', fontFamily: fonts.bold, fontSize: 12 }}>
                          Service In Progress • On Ramp
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#8B5CF6', marginRight: 4 }} />
                        <Text style={{ fontSize: 10, fontFamily: fonts.bold, color: '#8B5CF6', textTransform: 'uppercase' }}>Live</Text>
                      </View>
                    </View>
                    <Text style={{ color: theme.colors.text, fontSize: 11.5, fontFamily: fonts.regular, lineHeight: 16 }}>
                      The garage technician has taken your vehicle into the bay and commenced service{item.serviceStartedAt ? ` at ${new Date(item.serviceStartedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}.
                    </Text>
                  </View>
                )}

                {/* Completed Service Outcome & Notes */}
                {statusCfg.isCompleted && (
                  <View style={[styles.cardCompletedBox, { backgroundColor: '#3B82F610', borderColor: '#3B82F630' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
                      <MaterialCommunityIcons name="check-decagram" size={15} color="#3B82F6" style={{ marginRight: 6 }} />
                      <Text style={{ color: '#3B82F6', fontFamily: fonts.bold, fontSize: 12 }}>
                        Service & MOT Completed
                      </Text>
                    </View>
                    {item.serviceNotes ? (
                      <Text style={{ color: theme.colors.text, fontSize: 11.5, fontFamily: fonts.regular, lineHeight: 16 }}>
                        <Text style={{ fontFamily: fonts.bold, color: theme.colors.text }}>Technician Note: </Text>
                        {item.serviceNotes}
                      </Text>
                    ) : (
                      <Text style={{ color: theme.colors.placeholder, fontSize: 11.5, fontFamily: fonts.regular }}>
                        All workshop checks and tests have been completed. Vehicle is ready for collection.
                      </Text>
                    )}
                  </View>
                )}

                {/* Rejection Details Callout on Card */}
                {statusCfg.isRejected && (
                  <View style={[styles.cardRejectionBox, { backgroundColor: '#DC262610', borderColor: '#DC262630' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                      <MaterialCommunityIcons name="alert-circle-outline" size={14} color="#DC2626" style={{ marginRight: 5 }} />
                      <Text style={{ color: '#DC2626', fontFamily: fonts.bold, fontSize: 11.5 }}>
                        Booking Rejected by Garage
                      </Text>
                    </View>
                    <Text style={{ color: theme.colors.text, fontSize: 11.5, marginTop: 2, lineHeight: 16, fontFamily: fonts.regular }}>
                      Reason: <Text style={{ fontFamily: fonts.bold, color: '#DC2626' }}>{item.rejectionReason || 'No specific reason provided.'}</Text>
                    </Text>
                  </View>
                )}

                {/* 5. Reschedule & Cancel Action Buttons */}
                {(statusCfg.isPending || statusCfg.isConfirmed) && (
                  <View style={[styles.cardBottomRow, { borderTopColor: theme.colors.border + '50' }]}>
                    <TouchableOpacity
                      onPress={() => handleReschedule(item)}
                      style={[styles.rescheduleCardBtn, { borderColor: theme.colors.secondary + '40', backgroundColor: theme.colors.secondary + '12' }]}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons name="calendar-edit" size={13} color={theme.colors.secondary} style={{ marginRight: 4 }} />
                      <Text style={[styles.rescheduleCardBtnText, { color: theme.colors.secondary }]}>Reschedule</Text>
                    </TouchableOpacity>

                    {statusCfg.isPending && (
                      <TouchableOpacity
                        onPress={() => handleCancel(item)}
                        disabled={isCancelling}
                        style={styles.cancelBookingBtn}
                        activeOpacity={0.7}
                      >
                        {isCancelling ? (
                          <ActivityIndicator size="small" color="#EF4444" />
                        ) : (
                          <>
                            <MaterialCommunityIcons name="close-circle-outline" size={13} color="#EF4444" style={{ marginRight: 4 }} />
                            <Text style={styles.cancelBookingBtnText}>Cancel</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Booking Details BottomSheet Modal */}
      {selectedBookingForDetails && (() => {
        const item = selectedBookingForDetails;
        const statusCfg = getStatusConfig(item.status);
        const garageDisplayName = item.garageName || item.stationName || item.garage?.name || 'Service & Garage Centre';
        const garageLogoUrl = item.garageLogo || item.garage?.logoUrl || (typeof item.garageId === 'object' ? item.garageId?.logoUrl : null);
        const garageAddressStr = [
          item.garageAddress || item.garage?.address,
          item.garageCity || item.garage?.city,
          item.garagePostcode || item.garage?.postcode,
        ]
          .filter(Boolean)
          .join(', ');
        const garagePhone = item.garagePhone || item.garage?.phone;
        const isCancelling = cancellingId === (item.id || item._id);

        return (
          <Modal
            visible={!!selectedBookingForDetails}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setSelectedBookingForDetails(null)}
          >
            <TouchableWithoutFeedback onPress={() => setSelectedBookingForDetails(null)}>
              <View style={styles.modalBackdrop}>
                <TouchableWithoutFeedback onPress={() => {}}>
                  <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.modalSheetWrapper}
                  >
                    <View style={[styles.modalSheetContent, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                      {/* Drag Handle */}
                      <View style={styles.handleBar} />

                      {/* BottomSheet Header */}
                      <View style={styles.sheetHeaderRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                          <View style={[styles.sheetHeaderIconWrap, { backgroundColor: theme.colors.secondary + '15' }]}>
                            <MaterialCommunityIcons name="file-document-outline" size={20} color={theme.colors.secondary} />
                          </View>
                          <View style={{ marginLeft: 10, flex: 1 }}>
                            <Text style={[styles.sheetHeaderTitle, { color: theme.colors.text }]}>Booking Details</Text>
                            <Text style={[styles.sheetHeaderSubtitle, { color: theme.colors.placeholder }]}>
                              Ref: #{String(item.id || item._id || 'BK').slice(-6).toUpperCase()}
                            </Text>
                          </View>
                        </View>

                        <TouchableOpacity
                          onPress={() => setSelectedBookingForDetails(null)}
                          style={[styles.sheetCloseBtn, { backgroundColor: theme.colors.border + '40' }]}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <MaterialCommunityIcons name="close" size={18} color={theme.colors.text} />
                        </TouchableOpacity>
                      </View>

                      {/* Scrollable details */}
                      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScrollContent}>
                        {/* Vehicle Card */}
                        <View style={[styles.sheetSectionBox, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <View style={styles.ukPlateChip}>
                              <View style={styles.ukFlagBlock}>
                                <Text style={styles.ukFlagText}>🇬🇧</Text>
                                <Text style={styles.ukTagText}>UK</Text>
                              </View>
                              <Text style={styles.ukPlateNumber}>{item.registrationNumber}</Text>
                            </View>

                            <TouchableOpacity
                              onPress={() => {
                                setSelectedBookingForDetails(null);
                                navigation.navigate('MotHistory', { registration: item.registrationNumber });
                              }}
                              style={[styles.motHistoryBtn, { borderColor: theme.colors.border }]}
                            >
                              <MaterialCommunityIcons name="history" size={13} color={theme.colors.secondary} style={{ marginRight: 4 }} />
                              <Text style={[styles.motHistoryBtnText, { color: theme.colors.secondary }]}>MOT History</Text>
                            </TouchableOpacity>
                          </View>

                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <MaterialCommunityIcons name="car-sports" size={18} color={theme.colors.secondary} style={{ marginRight: 6 }} />
                            <Text style={[styles.sheetVehicleName, { color: theme.colors.text }]}>
                              {getVehicleDisplay(item.makeModel)}
                            </Text>
                          </View>
                        </View>

                        {/* Status Banner */}
                        <View style={[styles.sheetStatusBanner, { backgroundColor: statusCfg.bg, borderColor: statusCfg.color + '40' }]}>
                          <MaterialCommunityIcons name={statusCfg.icon} size={20} color={statusCfg.color} style={{ marginRight: 10 }} />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.sheetStatusTitle, { color: statusCfg.color }]}>{statusCfg.text}</Text>
                            <Text style={[styles.sheetStatusDesc, { color: theme.colors.text }]}>{statusCfg.desc}</Text>
                          </View>
                        </View>

                        {/* 4-Step Progress Tracking Stepper */}
                        {!statusCfg.isCancelled && !statusCfg.isRejected && (
                          <View style={[styles.sheetSectionBox, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                            <Text style={[styles.sheetSectionHeading, { color: theme.colors.placeholder }]}>SERVICE PROGRESS TRACKER</Text>
                            <View style={styles.stepperContainer}>
                              {/* Step 1: Booked */}
                              <View style={styles.stepItem}>
                                <View style={[styles.stepDot, { backgroundColor: '#10B981' }]}>
                                  <MaterialCommunityIcons name="check" size={13} color="#FFFFFF" />
                                </View>
                                <Text style={[styles.stepLabel, { color: theme.colors.text, fontFamily: fonts.semiBold }]}>Booked</Text>
                              </View>
                              <View style={[styles.stepLine, { backgroundColor: (statusCfg.isConfirmed || statusCfg.isInProgress || statusCfg.isCompleted) ? '#10B981' : theme.colors.border }]} />

                              {/* Step 2: Confirmed */}
                              <View style={styles.stepItem}>
                                <View style={[
                                  styles.stepDot,
                                  {
                                    backgroundColor: (statusCfg.isConfirmed || statusCfg.isInProgress || statusCfg.isCompleted) ? '#10B981' : '#F59E0B'
                                  }
                                ]}>
                                  <MaterialCommunityIcons
                                    name={(statusCfg.isConfirmed || statusCfg.isInProgress || statusCfg.isCompleted) ? "check" : "timer-sand"}
                                    size={13}
                                    color="#FFFFFF"
                                  />
                                </View>
                                <Text style={[
                                  styles.stepLabel,
                                  {
                                    color: (statusCfg.isConfirmed || statusCfg.isInProgress || statusCfg.isCompleted) ? theme.colors.text : '#F59E0B',
                                    fontFamily: statusCfg.isPending ? fonts.bold : fonts.semiBold
                                  }
                                ]}>
                                  Confirmed
                                </Text>
                              </View>
                              <View style={[styles.stepLine, { backgroundColor: (statusCfg.isInProgress || statusCfg.isCompleted) ? '#8B5CF6' : theme.colors.border }]} />

                              {/* Step 3: In Workshop */}
                              <View style={styles.stepItem}>
                                <View style={[
                                  styles.stepDot,
                                  {
                                    backgroundColor: statusCfg.isCompleted ? '#10B981' : (statusCfg.isInProgress ? '#8B5CF6' : theme.colors.border)
                                  }
                                ]}>
                                  <MaterialCommunityIcons
                                    name={statusCfg.isCompleted ? "check" : (statusCfg.isInProgress ? "car-wrench" : "circle-outline")}
                                    size={13}
                                    color={statusCfg.isCompleted || statusCfg.isInProgress ? "#FFFFFF" : theme.colors.placeholder}
                                  />
                                </View>
                                <Text style={[
                                  styles.stepLabel,
                                  {
                                    color: statusCfg.isInProgress ? '#8B5CF6' : (statusCfg.isCompleted ? theme.colors.text : theme.colors.placeholder),
                                    fontFamily: statusCfg.isInProgress ? fonts.bold : fonts.medium
                                  }
                                ]}>
                                  In Workshop
                                </Text>
                              </View>
                              <View style={[styles.stepLine, { backgroundColor: statusCfg.isCompleted ? '#3B82F6' : theme.colors.border }]} />

                              {/* Step 4: Ready / Done */}
                              <View style={styles.stepItem}>
                                <View style={[
                                  styles.stepDot,
                                  {
                                    backgroundColor: statusCfg.isCompleted ? '#3B82F6' : theme.colors.border
                                  }
                                ]}>
                                  <MaterialCommunityIcons
                                    name={statusCfg.isCompleted ? "check-decagram" : "circle-outline"}
                                    size={13}
                                    color={statusCfg.isCompleted ? "#FFFFFF" : theme.colors.placeholder}
                                  />
                                </View>
                                <Text style={[
                                  styles.stepLabel,
                                  {
                                    color: statusCfg.isCompleted ? '#3B82F6' : theme.colors.placeholder,
                                    fontFamily: statusCfg.isCompleted ? fonts.bold : fonts.medium
                                  }
                                ]}>
                                  Completed
                                </Text>
                              </View>
                            </View>

                            {/* Live status timeline note */}
                            {item.serviceStartedAt && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.colors.border + '40' }}>
                                <MaterialCommunityIcons name="clock-start" size={14} color="#8B5CF6" style={{ marginRight: 6 }} />
                                <Text style={{ fontSize: 11.5, color: theme.colors.text, fontFamily: fonts.medium }}>
                                  Service Started: {new Date(item.serviceStartedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} on {new Date(item.serviceStartedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                  {item.serviceStartedBy ? ` by ${item.serviceStartedBy}` : ''}
                                </Text>
                              </View>
                            )}
                            {item.serviceCompletedAt && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                <MaterialCommunityIcons name="clock-check" size={14} color="#3B82F6" style={{ marginRight: 6 }} />
                                <Text style={{ fontSize: 11.5, color: theme.colors.text, fontFamily: fonts.medium }}>
                                  Service Completed: {new Date(item.serviceCompletedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} on {new Date(item.serviceCompletedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                  {item.serviceCompletedBy ? ` by ${item.serviceCompletedBy}` : ''}
                                </Text>
                              </View>
                            )}
                            {item.serviceNotes && (
                              <View style={{ marginTop: 8, backgroundColor: theme.colors.card, padding: 8, borderRadius: 6, borderWidth: 1, borderColor: theme.colors.border }}>
                                <Text style={{ fontSize: 11, fontFamily: fonts.bold, color: theme.colors.text, marginBottom: 2 }}>Garage Technician Notes:</Text>
                                <Text style={{ fontSize: 11.5, fontFamily: fonts.regular, color: theme.colors.text }}>{item.serviceNotes}</Text>
                              </View>
                            )}
                          </View>
                        )}

                        {/* Service & Schedule Box */}
                        <View style={[styles.sheetSectionBox, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                          <Text style={[styles.sheetSectionHeading, { color: theme.colors.placeholder }]}>SERVICES & APPOINTMENT</Text>

                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, marginBottom: 8 }}>
                            <MaterialCommunityIcons name="wrench-outline" size={16} color={theme.colors.secondary} style={{ marginRight: 8 }} />
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.sheetServiceName, { color: theme.colors.text }]}>
                                {item.serviceName || 'Vehicle Service & Inspection'}
                              </Text>
                              {item.price ? (
                                <Text style={[styles.sheetPriceText, { color: theme.colors.secondary }]}>
                                  Total: £{Number(item.price).toFixed(2)}
                                </Text>
                              ) : null}
                            </View>
                          </View>

                          {Array.isArray(item.services) && item.services.length > 0 && (
                            <View style={{ marginTop: 4, marginBottom: 8, gap: 6 }}>
                              {item.services.map((s: any, idx: number) => {
                                const sName = typeof s === 'string' ? s : s?.name || '';
                                const sPrice = typeof s === 'object' && s?.price !== undefined ? Number(s.price).toFixed(2) : null;
                                return (
                                  <View
                                    key={idx}
                                    style={{
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      backgroundColor: theme.colors.card,
                                      paddingHorizontal: 10,
                                      paddingVertical: 6,
                                      borderRadius: 8,
                                      borderWidth: 1,
                                      borderColor: theme.colors.border,
                                    }}
                                  >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                      <MaterialCommunityIcons
                                        name={sName.toLowerCase().includes('mot') ? 'car-wrench' : 'wrench'}
                                        size={14}
                                        color={theme.colors.secondary}
                                        style={{ marginRight: 6 }}
                                      />
                                      <Text style={{ fontSize: 12.5, fontFamily: fonts.semiBold, color: theme.colors.text }}>{sName}</Text>
                                    </View>
                                    {sPrice !== null && (
                                       <Text style={{ fontSize: 12, fontFamily: fonts.bold, color: theme.colors.secondary }}>£{sPrice}</Text>
                                    )}
                                  </View>
                                );
                              })}
                            </View>
                          )}

                          <View style={styles.sheetDivider} />

                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                              <MaterialCommunityIcons name="calendar-month-outline" size={16} color={theme.colors.secondary} style={{ marginRight: 6 }} />
                              <View>
                                <Text style={[styles.sheetScheduleLabel, { color: theme.colors.placeholder }]}>
                                  {item.isDateOnly || item.hasMot === false ? 'DROP-OFF DATE' : 'DATE'}
                                </Text>
                                <Text style={[styles.sheetScheduleVal, { color: theme.colors.text }]}>
                                  {formatDisplayDate(item.date)}
                                </Text>
                              </View>
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                              <MaterialCommunityIcons
                                name={item.isDateOnly || item.hasMot === false ? 'car-clock' : 'clock-time-four-outline'}
                                size={16}
                                color={theme.colors.secondary}
                                style={{ marginRight: 6 }}
                              />
                              <View>
                                <Text style={[styles.sheetScheduleLabel, { color: theme.colors.placeholder }]}>
                                  {item.isDateOnly || item.hasMot === false ? 'INTAKE' : 'SLOT'}
                                </Text>
                                <Text style={[styles.sheetScheduleVal, { color: theme.colors.text }]}>
                                  {getSlotDisplay(item.makeModel, item.slotTime, item.isDateOnly, item.hasMot)}
                                </Text>
                              </View>
                            </View>
                          </View>
                        </View>

                        {/* Garage Details ("show whole data like garage get direction call etc etc!") */}
                        <View style={[styles.sheetSectionBox, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                          <Text style={[styles.sheetSectionHeading, { color: theme.colors.placeholder }]}>GARAGE & LOCATION</Text>

                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                            {garageLogoUrl ? (
                              <Image
                                source={{ uri: garageLogoUrl }}
                                style={{ width: 26, height: 26, borderRadius: 6, marginRight: 8 }}
                                resizeMode="cover"
                              />
                            ) : (
                              <View style={{ width: 26, height: 26, borderRadius: 6, backgroundColor: theme.colors.primary + '18', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: theme.colors.primary }}>
                                  {(garageDisplayName || 'G').charAt(0).toUpperCase()}
                                </Text>
                              </View>
                            )}
                            <Text style={[styles.sheetGarageName, { color: theme.colors.text }]} numberOfLines={1}>
                              {garageDisplayName}
                            </Text>
                          </View>

                          {garageAddressStr ? (
                            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 6 }}>
                              <MaterialCommunityIcons name="map-marker-radius-outline" size={16} color={theme.colors.placeholder} style={{ marginRight: 8, marginTop: 1 }} />
                              <Text style={[styles.sheetGarageAddress, { color: theme.colors.placeholder }]}>
                                {garageAddressStr}
                              </Text>
                            </View>
                          ) : null}

                          {/* Quick Garage Actions: Directions & Call & View Profile */}
                          <View style={styles.sheetGarageActionRow}>
                            <TouchableOpacity
                              style={[styles.sheetActionBtnPrimary, { backgroundColor: theme.colors.primary }]}
                              onPress={() =>
                                openGarageDirections({
                                  name: garageDisplayName,
                                  address: item.garageAddress || item.garage?.address,
                                  city: item.garageCity || item.garage?.city,
                                  postcode: item.garagePostcode || item.garage?.postcode,
                                  latitude: item.garageLatitude,
                                  longitude: item.garageLongitude,
                                })
                              }
                              activeOpacity={0.8}
                            >
                              <MaterialCommunityIcons name="directions" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                              <Text style={styles.sheetActionBtnPrimaryText}>Get Directions</Text>
                            </TouchableOpacity>

                            {garagePhone ? (
                              <TouchableOpacity
                                style={[styles.sheetActionBtnOutline, { borderColor: theme.colors.border }]}
                                onPress={() => Linking.openURL(`tel:${garagePhone}`)}
                                activeOpacity={0.8}
                              >
                                <MaterialCommunityIcons name="phone" size={16} color={theme.colors.secondary} style={{ marginRight: 6 }} />
                                <Text style={[styles.sheetActionBtnOutlineText, { color: theme.colors.secondary }]}>Call Garage</Text>
                              </TouchableOpacity>
                            ) : null}
                          </View>

                          {item.garageId ? (
                            <TouchableOpacity
                              onPress={() => {
                                setSelectedBookingForDetails(null);
                                navigation.navigate('GarageDetail', { garageId: item.garageId });
                              }}
                              style={[styles.sheetViewGarageLink, { borderColor: theme.colors.border + '60' }]}
                            >
                              <MaterialCommunityIcons name="store-search-outline" size={15} color={theme.colors.primary} style={{ marginRight: 6 }} />
                              <Text style={[styles.sheetViewGarageLinkText, { color: theme.colors.primary }]}>View Garage Full Profile & Reviews</Text>
                              <MaterialCommunityIcons name="chevron-right" size={16} color={theme.colors.primary} />
                            </TouchableOpacity>
                          ) : null}
                        </View>

                        {/* Cancellation / Rejection Note */}
                        {(item.rejectionReason || item.cancellationReason) && (
                          <View style={[styles.sheetReasonBox, { backgroundColor: '#EF444410', borderColor: '#EF444430' }]}>
                            <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#EF4444" style={{ marginRight: 8, marginTop: 1 }} />
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.sheetReasonTitle, { color: '#EF4444' }]}>Notice</Text>
                              <Text style={[styles.sheetReasonText, { color: theme.colors.text }]}>
                                {item.rejectionReason || item.cancellationReason}
                              </Text>
                            </View>
                          </View>
                        )}

                        {/* Action buttons inside bottomsheet */}
                        {(statusCfg.isPending || statusCfg.isConfirmed) && (
                          <View style={{ marginTop: 12, gap: 8 }}>
                            <TouchableOpacity
                              onPress={() => handleReschedule(item)}
                              style={[styles.sheetRescheduleBtn, { backgroundColor: theme.colors.secondary }]}
                              activeOpacity={0.8}
                            >
                              <MaterialCommunityIcons name="calendar-edit" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                              <Text style={styles.sheetRescheduleBtnText}>Reschedule Appointment</Text>
                            </TouchableOpacity>

                            {statusCfg.isPending && (
                              <TouchableOpacity
                                onPress={() => {
                                  handleCancel(item);
                                }}
                                disabled={isCancelling}
                                style={[styles.sheetCancelBtn, { borderColor: '#EF444440' }]}
                                activeOpacity={0.7}
                              >
                                {isCancelling ? (
                                  <ActivityIndicator size="small" color="#EF4444" />
                                ) : (
                                  <>
                                    <MaterialCommunityIcons name="close-circle-outline" size={16} color="#EF4444" style={{ marginRight: 6 }} />
                                    <Text style={styles.sheetCancelBtnText}>Cancel Booking</Text>
                                  </>
                                )}
                              </TouchableOpacity>
                            )}
                          </View>
                        )}
                      </ScrollView>
                    </View>
                  </KeyboardAvoidingView>
                </TouchableWithoutFeedback>
              </View>
            </TouchableWithoutFeedback>
          </Modal>
        );
      })()}

      {/* Calendar Picker Modal */}
      <Modal visible={calendarModalVisible} transparent animationType="fade" onRequestClose={() => setCalendarModalVisible(false)}>
        <TouchableOpacity
          style={styles.calModalOverlay}
          activeOpacity={1}
          onPress={() => setCalendarModalVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.calendarModalCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
          >
            {/* Calendar Month & Year Controls */}
            <View style={styles.calendarHeader}>
              <TouchableOpacity onPress={handlePrevMonth} style={[styles.calNavBtn, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                <MaterialCommunityIcons name="chevron-left" size={24} color={theme.colors.text} />
              </TouchableOpacity>

              <View style={styles.calTitleBox}>
                <Text style={[styles.calendarTitle, { color: theme.colors.text }]}>
                  {monthNames[currentViewDate.getMonth()]} {currentViewDate.getFullYear()}
                </Text>
                <Text style={[styles.calSubTitle, { color: theme.colors.placeholder }]}>
                  Select date to filter your bookings
                </Text>
              </View>

              <TouchableOpacity onPress={handleNextMonth} style={[styles.calNavBtn, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            {/* Quick Toolbar: Jump to Today */}
            <View style={styles.calToolbarRow}>
              <TouchableOpacity
                style={[styles.todayQuickBtn, { backgroundColor: theme.colors.secondary + '18', borderColor: theme.colors.secondary + '40' }]}
                onPress={handleJumpToToday}
              >
                <MaterialCommunityIcons name="calendar-today" size={14} color={theme.colors.secondary} />
                <Text style={[styles.todayQuickBtnText, { color: theme.colors.secondary }]}>Select Today</Text>
              </TouchableOpacity>

              {selectedCustomDate && (
                <View style={[styles.activeDateTag, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                  <MaterialCommunityIcons name="calendar-check" size={14} color="#10B981" />
                  <Text style={[styles.activeDateTagText, { color: theme.colors.text }]}>
                    Selected: <Text style={{ fontFamily: fonts.extraBold, color: theme.colors.secondary }}>{formatShortDate(selectedCustomDate)}</Text>
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setDateFilter('ALL');
                      setSelectedCustomDate(null);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{ marginLeft: 6 }}
                  >
                    <MaterialCommunityIcons name="close-circle" size={14} color={theme.colors.placeholder} />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Weekday labels */}
            <View style={styles.weekdayRow}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, index) => (
                <Text
                  key={d}
                  style={[
                    styles.weekdayText,
                    { color: index === 0 ? '#EF4444' : theme.colors.placeholder }
                  ]}
                >
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

                const dateYMD = toYMD(day);
                if (!dateYMD) return null;

                const isSelected = dateFilter === 'CUSTOM' && selectedCustomDate === dateYMD;
                const isToday = dateYMD === todayYMD;
                const hasBookings = datesWithBookingsSet.has(dateYMD);
                const isSunday = day.getDay() === 0;

                return (
                  <View key={dateYMD} style={styles.dayCell}>
                    <TouchableOpacity
                      onPress={() => {
                        setDateFilter('CUSTOM');
                        setSelectedCustomDate(dateYMD);
                        setCalendarModalVisible(false);
                      }}
                      style={[
                        styles.dayBtn,
                        {
                          backgroundColor: isSelected
                            ? theme.colors.secondary
                            : isToday
                            ? theme.colors.secondary + '18'
                            : hasBookings
                            ? '#8B5CF618'
                            : 'transparent',
                          borderColor: isSelected
                            ? theme.colors.secondary
                            : isToday
                            ? theme.colors.secondary
                            : hasBookings
                            ? '#8B5CF6'
                            : theme.colors.border + '60',
                          borderWidth: isSelected || isToday || hasBookings ? 1.5 : 1,
                        }
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          {
                            color: isSelected
                              ? '#FFFFFF'
                              : hasBookings
                              ? '#8B5CF6'
                              : isSunday
                              ? '#EF4444'
                              : isToday
                              ? theme.colors.secondary
                              : theme.colors.text,
                            fontFamily: isSelected || isToday || hasBookings ? fonts.extraBold : fonts.semiBold,
                          }
                        ]}
                      >
                        {day.getDate()}
                      </Text>
                      {isToday && !isSelected && (
                        <View style={[styles.todayDot, { backgroundColor: theme.colors.secondary }]} />
                      )}
                      {hasBookings && !isSelected && (
                        <View style={[styles.pastBookingDot, { backgroundColor: '#8B5CF6' }]} />
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>

            {/* Calendar Legend */}
            <View style={[styles.calendarLegendRow, { borderTopColor: theme.colors.border + '40' }]}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.colors.secondary }]} />
                <Text style={[styles.legendText, { color: theme.colors.text }]}>Today</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#8B5CF6' }]} />
                <Text style={[styles.legendText, { color: '#8B5CF6' }]}>Your Booking</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.colors.border }]} />
                <Text style={[styles.legendText, { color: theme.colors.placeholder }]}>Empty Day</Text>
              </View>
            </View>

            {/* Calendar Bottom Actions */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              {selectedCustomDate ? (
                <TouchableOpacity
                  style={[styles.closeCalModalBtn, { flex: 1, marginTop: 0, flexDirection: 'row', justifyContent: 'center', backgroundColor: '#EF444415', borderColor: '#EF444440' }]}
                  onPress={() => {
                    setDateFilter('ALL');
                    setSelectedCustomDate(null);
                    setCalendarModalVisible(false);
                  }}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="calendar-remove" size={16} color="#EF4444" style={{ marginRight: 6 }} />
                  <Text style={[styles.closeCalModalBtnText, { color: '#EF4444', fontFamily: fonts.bold }]}>Clear Date</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={[styles.closeCalModalBtn, { flex: 1, marginTop: 0, backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                onPress={() => setCalendarModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={[styles.closeCalModalBtnText, { color: theme.colors.text }]}>Close Calendar</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  guestIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  guestSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 11,
    marginTop: 2,
    lineHeight: 14,
  },
  guestLoginBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    marginLeft: 8,
  },
  guestLoginBtnText: {
    fontFamily: fonts.bold,
    color: '#FFFFFF',
    fontSize: 12,
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
  },
  calendarIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  calendarActiveDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  activeDatePillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  activeDatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  activeDatePillText: {
    fontSize: 12,
    fontFamily: fonts.bold,
  },
  clearDateCross: {
    marginLeft: 4,
    padding: 2,
  },
  calModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  calendarModalCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    width: '100%',
    maxWidth: 380,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  calNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calTitleBox: {
    alignItems: 'center',
  },
  calendarTitle: {
    fontSize: 16,
    fontFamily: fonts.extraBold,
    letterSpacing: -0.2,
  },
  calSubTitle: {
    fontSize: 11,
    fontFamily: fonts.regular,
    marginTop: 1,
  },
  calToolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  todayQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  todayQuickBtnText: {
    fontSize: 12,
    fontFamily: fonts.bold,
  },
  activeDateTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  activeDateTagText: {
    fontSize: 12,
    fontFamily: fonts.regular,
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB20',
    marginBottom: 8,
  },
  weekdayText: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 11.5,
    fontFamily: fonts.bold,
    textTransform: 'uppercase',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  dayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 13,
    fontFamily: fonts.medium,
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    position: 'absolute',
    bottom: 3,
  },
  pastBookingDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    position: 'absolute',
    bottom: 3,
  },
  calendarLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 12,
    marginTop: 8,
    borderTopWidth: 1,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
  },
  closeCalModalBtn: {
    marginTop: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  closeCalModalBtnText: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
  },
  searchInput: {
    fontFamily: fonts.medium,
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  chipsScroll: {
    gap: 8,
    paddingVertical: 10,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterChipText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  listContent: {
    paddingHorizontal: 14,
    paddingBottom: 20,
    gap: 8,
  },
  bookingCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoIconBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ukPlateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD300',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#000000',
    overflow: 'hidden',
    height: 24,
  },
  ukFlagBlock: {
    backgroundColor: '#0A4E9B',
    height: '100%',
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ukFlagText: {
    fontFamily: fonts.bold,
    fontSize: 7.5,
  },
  ukTagText: {
    fontFamily: fonts.bold,
    color: '#FFFFFF',
    fontSize: 7.5,
  },
  ukPlateNumber: {
    fontFamily: fonts.bold,
    color: '#000000',
    fontSize: 11,
    paddingHorizontal: 6,
    letterSpacing: 0.6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 5,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
    marginBottom: 2,
  },
  vehicleName: {
    fontFamily: fonts.bold,
    fontSize: 13.5,
    flex: 1,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  serviceNameText: {
    fontFamily: fonts.medium,
    fontSize: 11.5,
    flexShrink: 1,
  },
  priceTag: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
    marginLeft: 4,
  },
  appointmentInfoBox: {
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderRadius: 6,
    borderWidth: 1,
  },
  dateSlotRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateLabel: {
    fontFamily: fonts.bold,
    fontSize: 8,
    letterSpacing: 0.5,
  },
  dateValue: {
    fontFamily: fonts.bold,
    fontSize: 11,
    marginTop: 1,
  },
  motHistoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  motHistoryBtnText: {
    fontFamily: fonts.bold,
    fontSize: 11,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    marginTop: 6,
    paddingTop: 5,
  },
  cancelBookingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  cancelBookingBtnText: {
    fontFamily: fonts.semiBold,
    color: '#EF4444',
    fontSize: 10.5,
  },
  rescheduleCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2.5,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    marginRight: 8,
  },
  rescheduleCardBtnText: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
  },
  // BottomSheet Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.58)',
    justifyContent: 'flex-end',
  },
  modalSheetWrapper: {
    width: '100%',
    maxHeight: '88%',
  },
  modalSheetContent: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    maxHeight: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 20,
  },
  handleBar: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#94A3B8',
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sheetHeaderIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetHeaderTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    letterSpacing: -0.2,
  },
  sheetHeaderSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    marginTop: 2,
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetScrollContent: {
    paddingBottom: 24,
    gap: 12,
  },
  sheetSectionBox: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  sheetVehicleName: {
    fontFamily: fonts.bold,
    fontSize: 15,
    flex: 1,
  },
  sheetStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  sheetStatusTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  sheetStatusDesc: {
    fontFamily: fonts.regular,
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  sheetSectionHeading: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  sheetServiceName: {
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  sheetPriceText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    marginTop: 2,
  },
  sheetDivider: {
    height: 1,
    backgroundColor: 'rgba(150, 150, 150, 0.15)',
    marginVertical: 4,
  },
  sheetScheduleLabel: {
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  sheetScheduleVal: {
    fontFamily: fonts.bold,
    fontSize: 12,
    marginTop: 1,
  },
  sheetGarageName: {
    fontFamily: fonts.bold,
    fontSize: 14,
    flex: 1,
  },
  sheetGarageAddress: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
  sheetGarageActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  sheetActionBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  sheetActionBtnPrimaryText: {
    fontFamily: fonts.bold,
    color: '#FFFFFF',
    fontSize: 12,
  },
  sheetActionBtnOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  sheetActionBtnOutlineText: {
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  sheetViewGarageLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    marginTop: 10,
    borderTopWidth: 1,
  },
  sheetViewGarageLinkText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  sheetReasonBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  sheetReasonTitle: {
    fontFamily: fonts.bold,
    fontSize: 11,
  },
  sheetReasonText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    marginTop: 2,
  },
  sheetRescheduleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 4,
  },
  sheetRescheduleBtnText: {
    fontFamily: fonts.bold,
    color: '#FFFFFF',
    fontSize: 12.5,
  },
  sheetCancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
  },
  sheetCancelBtnText: {
    fontFamily: fonts.bold,
    color: '#EF4444',
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 20,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    maxWidth: 260,
  },
  bookNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  bookNowBtnText: {
    fontFamily: fonts.bold,
    color: '#FFFFFF',
    fontSize: 13,
  },
  rejectedBannerContainer: {
    marginBottom: 12,
  },
  notificationAlertBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  notificationAlertTitle: {
    fontFamily: fonts.bold,
    fontSize: 12,
    marginBottom: 2,
  },
  notificationAlertText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    lineHeight: 15,
  },
  notificationDismissBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginLeft: 6,
  },
  notificationDismissText: {
    fontFamily: fonts.bold,
    fontSize: 11,
  },
  cardRejectionBox: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 9,
    marginTop: 8,
  },
  rebookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginTop: 7,
    alignSelf: 'flex-start',
  },
  rebookBtnText: {
    fontFamily: fonts.bold,
    color: '#FFFFFF',
    fontSize: 11,
  },
  cardProgressBox: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    marginTop: 8,
  },
  cardCompletedBox: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    marginTop: 8,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  stepItem: {
    alignItems: 'center',
    width: 68,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepLabel: {
    fontSize: 10.5,
    textAlign: 'center',
  },
  stepLine: {
    flex: 1,
    height: 2,
    marginTop: -18,
    marginHorizontal: 2,
  },
});
