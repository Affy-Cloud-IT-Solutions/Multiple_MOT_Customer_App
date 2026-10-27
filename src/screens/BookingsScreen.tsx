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
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues } from '../context/DataContext';
import CustomerHeader from '../components/CustomerHeader';
import { openGarageDirections } from '../utils/mapUtils';
import { fonts } from '../theme/theme';

export default function BookingsScreen({ navigation }: any) {
  const { theme } = useAppTheme();
  const {
    token,
    user,
    customers,
    alerts = [],
    refreshData,
    cancelBooking,
    acknowledgeAlert,
  } = useAppValues();

  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'CONFIRMED' | 'PENDING' | 'REJECTED' | 'COMPLETED' | 'CANCELLED'>('ALL');
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

  // Active rejected bookings alerts for banner
  const rejectedAlerts = useMemo(() => {
    if (!token) return [];
    return allCustomerBookings.filter((a) => a.status === 'Rejected');
  }, [allCustomerBookings, token]);

  // Counts for filter pills
  const counts = useMemo(() => {
    let pending = 0;
    let confirmed = 0;
    let rejected = 0;
    let completed = 0;
    let cancelled = 0;

    allCustomerBookings.forEach((b) => {
      const s = (b.status || '').toLowerCase();
      if (s === 'pending') pending++;
      else if (s === 'approved' || s === 'confirmed' || s === 'acknowledged') confirmed++;
      else if (s === 'completed') completed++;
      else if (s === 'rejected') rejected++;
      else if (s === 'cancelled') cancelled++;
    });

    return {
      ALL: allCustomerBookings.length,
      CONFIRMED: confirmed,
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
      const isCompleted = s === 'completed';
      const isRejected = s === 'rejected';
      const isCancelled = s === 'cancelled';

      let matchFilter = true;
      if (selectedFilter === 'CONFIRMED') matchFilter = isConfirmed;
      else if (selectedFilter === 'PENDING') matchFilter = isPending;
      else if (selectedFilter === 'REJECTED') matchFilter = isRejected;
      else if (selectedFilter === 'COMPLETED') matchFilter = isCompleted;
      else if (selectedFilter === 'CANCELLED') matchFilter = isCancelled;

      if (!matchFilter) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const reg = (b.registrationNumber || '').toLowerCase();
      const mm = (b.makeModel || '').toLowerCase();
      const gn = (b.garageName || b.stationName || b.garage?.name || '').toLowerCase();
      const svc = (b.serviceName || '').toLowerCase();

      return reg.includes(q) || mm.includes(q) || gn.includes(q) || svc.includes(q);
    });
  }, [allCustomerBookings, selectedFilter, searchQuery]);

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
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
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
    if (s === 'approved' || s === 'confirmed' || s === 'acknowledged') {
      return {
        isPending: false,
        isConfirmed: true,
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
        {/* Search Bar */}
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
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialCommunityIcons name="close-circle" size={16} color={theme.colors.placeholder} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Chips Scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScroll}
        >
          {[
            { key: 'ALL', label: 'All', count: counts.ALL },
            { key: 'CONFIRMED', label: 'Approved', count: counts.CONFIRMED },
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
                  onPress={async () => {
                    try {
                      if (acknowledgeAlert) {
                        await acknowledgeAlert(alert.id || (alert as any)._id);
                      }
                    } catch (e) {
                      console.error('Dismiss error:', e);
                    }
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
                : selectedFilter !== 'ALL'
                ? `You have no ${selectedFilter.toLowerCase()} bookings.`
                : 'You have not booked any vehicle service appointments yet.'}
            </Text>

            <TouchableOpacity
              onPress={() => navigation.navigate('Garages')}
              style={[styles.bookNowBtn, { backgroundColor: theme.colors.secondary }]}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="store-search-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.bookNowBtnText}>Find Garage & Book Service</Text>
            </TouchableOpacity>
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
                            <MaterialCommunityIcons name="storefront-outline" size={18} color={theme.colors.primary} style={{ marginRight: 8 }} />
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
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
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
});
