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

export default function BookingsScreen({ navigation }: any) {
  const { theme } = useAppTheme();
  const {
    token,
    user,
    customers,
    alerts = [],
    refreshData,
    cancelBooking,
  } = useAppValues();

  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'>('ALL');
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

  // Extract all BOOKED alerts belonging to current user/customer
  const allCustomerBookings = useMemo(() => {
    return alerts
      .filter((a) => {
        if (a.type !== 'BOOKED') return false;
        // If logged in, match customerId or if guest, match all
        if (token && customerId) {
          const matchId =
            !a.customerId ||
            String(a.customerId).toLowerCase() === String(customerId).toLowerCase() ||
            String(a.customerId).toLowerCase() === String(customer.id || '').toLowerCase() ||
            String(a.customerId).toLowerCase() === String(customer._id || '').toLowerCase();
          return matchId;
        }
        return true;
      })
      .sort((a, b) => {
        const dateA = new Date(a.date || 0).getTime();
        const dateB = new Date(b.date || 0).getTime();
        return dateB - dateA;
      });
  }, [alerts, token, customerId, customer]);

  // Counts for filter pills
  const counts = useMemo(() => {
    let pending = 0;
    let confirmed = 0;
    let completed = 0;
    let cancelled = 0;

    allCustomerBookings.forEach((b) => {
      const s = (b.status || '').toLowerCase();
      if (s === 'pending') pending++;
      else if (s === 'approved' || s === 'confirmed' || s === 'acknowledged') confirmed++;
      else if (s === 'completed') completed++;
      else if (s === 'cancelled' || s === 'rejected') cancelled++;
    });

    return {
      ALL: allCustomerBookings.length,
      PENDING: pending,
      CONFIRMED: confirmed,
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
      const isCancelled = s === 'cancelled' || s === 'rejected';

      let matchFilter = true;
      if (selectedFilter === 'PENDING') matchFilter = isPending;
      else if (selectedFilter === 'CONFIRMED') matchFilter = isConfirmed;
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
      `Are you sure you want to cancel the MOT booking for ${reg}?\n\nThe allocated test bay slot will be released.`,
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

  const getSlotDisplay = (makeModel: string, slotTime?: string) => {
    if (slotTime) return slotTime;
    if (makeModel && makeModel.includes(' - Slot: ')) {
      return makeModel.split(' - Slot: ')[1];
    }
    return 'Regular Slot';
  };

  const getVehicleDisplay = (makeModel: string) => {
    if (!makeModel) return 'Vehicle MOT Inspection';
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
        text: 'Confirmed',
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
        text: 'Declined',
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

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* 1. Customer Header with Great UI */}
      <CustomerHeader
        title="My Bookings"
        subtitle="Live MOT & Service Appointments"
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

      {/* Guest Sign-In Notice if not logged in */}
      {!token && (
        <View style={[styles.guestNoticeCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={[styles.guestIconWrap, { backgroundColor: theme.colors.primary + '15' }]}>
            <MaterialCommunityIcons name="account-lock-outline" size={24} color={theme.colors.primary} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.guestTitle, { color: theme.colors.text }]}>Sign in to track bookings</Text>
            <Text style={[styles.guestSubtitle, { color: theme.colors.placeholder }]}>
              Log in with your customer account to sync live appointment statuses.
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('Login')}
            style={[styles.guestLoginBtn, { backgroundColor: theme.colors.primary }]}
          >
            <Text style={styles.guestLoginBtnText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      )}

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
            { key: 'CONFIRMED', label: 'Confirmed', count: counts.CONFIRMED },
            { key: 'PENDING', label: 'Pending', count: counts.PENDING },
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
                      fontWeight: isSelected ? '700' : '600',
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
                : 'You have not booked any MOT or vehicle service slots yet.'}
            </Text>

            <TouchableOpacity
              onPress={() => navigation.navigate('Garages')}
              style={[styles.bookNowBtn, { backgroundColor: theme.colors.secondary }]}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="store-search-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.bookNowBtnText}>Find Garage & Book MOT</Text>
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
                      <MaterialCommunityIcons name={statusCfg.icon} size={13} color={statusCfg.color} style={{ marginRight: 4 }} />
                      <Text style={[styles.statusBadgeText, { color: statusCfg.color }]}>{statusCfg.text}</Text>
                    </View>

                    {/* Modern Info Icon Button */}
                    <TouchableOpacity
                      onPress={() => setSelectedBookingForDetails(item)}
                      style={[styles.infoIconBtn, { backgroundColor: theme.colors.secondary + '15', borderColor: theme.colors.secondary + '35' }]}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons name="information-variant" size={17} color={theme.colors.secondary} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 2. Car Name */}
                <View style={styles.vehicleRow}>
                  <MaterialCommunityIcons name="car-sports" size={18} color={theme.colors.secondary} style={{ marginRight: 6 }} />
                  <Text style={[styles.vehicleName, { color: theme.colors.text }]} numberOfLines={1}>
                    {getVehicleDisplay(item.makeModel)}
                  </Text>
                </View>

                {/* 3. Type of Service */}
                <View style={styles.serviceRow}>
                  <MaterialCommunityIcons name="wrench-clock-outline" size={14} color={theme.colors.placeholder} style={{ marginRight: 6 }} />
                  <Text style={[styles.serviceNameText, { color: theme.colors.placeholder }]} numberOfLines={1}>
                    {item.serviceName || 'MOT Annual Safety Inspection (Class 4)'}
                  </Text>
                  {item.price ? (
                    <Text style={[styles.priceTag, { color: theme.colors.secondary }]}>
                      • £{Number(item.price).toFixed(2)}
                    </Text>
                  ) : null}
                </View>

                {/* 4. Appointment Date & Time Slot */}
                <View style={[styles.appointmentInfoBox, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                  <View style={styles.dateSlotRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <MaterialCommunityIcons name="calendar-month-outline" size={16} color={theme.colors.secondary} style={{ marginRight: 6 }} />
                      <View>
                        <Text style={[styles.dateLabel, { color: theme.colors.placeholder }]}>APPOINTMENT DATE</Text>
                        <Text style={[styles.dateValue, { color: theme.colors.text }]}>
                          {formatDisplayDate(item.date)}
                        </Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <MaterialCommunityIcons name="clock-time-four-outline" size={16} color={theme.colors.secondary} style={{ marginRight: 6 }} />
                      <View>
                        <Text style={[styles.dateLabel, { color: theme.colors.placeholder }]}>TIME SLOT</Text>
                        <Text style={[styles.dateValue, { color: theme.colors.text }]}>
                          {getSlotDisplay(item.makeModel, item.slotTime)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* 5. Cancel Booking Button: Strictly when status is Pending */}
                {statusCfg.isPending && (
                  <View style={[styles.cardBottomRow, { borderTopColor: theme.colors.border + '50' }]}>
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
                          <MaterialCommunityIcons name="close-circle-outline" size={14} color="#EF4444" style={{ marginRight: 4 }} />
                          <Text style={styles.cancelBookingBtnText}>Cancel Booking</Text>
                        </>
                      )}
                    </TouchableOpacity>
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
        const garageDisplayName = item.garageName || item.stationName || item.garage?.name || 'MOT Testing Centre';
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
                          <Text style={[styles.sheetSectionHeading, { color: theme.colors.placeholder }]}>SERVICE & APPOINTMENT</Text>

                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, marginBottom: 8 }}>
                            <MaterialCommunityIcons name="wrench-clock-outline" size={16} color={theme.colors.secondary} style={{ marginRight: 8 }} />
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.sheetServiceName, { color: theme.colors.text }]}>
                                {item.serviceName || 'MOT Annual Safety Inspection (Class 4)'}
                              </Text>
                              {item.price ? (
                                <Text style={[styles.sheetPriceText, { color: theme.colors.secondary }]}>
                                  Price: £{Number(item.price).toFixed(2)}
                                </Text>
                              ) : null}
                            </View>
                          </View>

                          <View style={styles.sheetDivider} />

                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                              <MaterialCommunityIcons name="calendar-month-outline" size={16} color={theme.colors.secondary} style={{ marginRight: 6 }} />
                              <View>
                                <Text style={[styles.sheetScheduleLabel, { color: theme.colors.placeholder }]}>DATE</Text>
                                <Text style={[styles.sheetScheduleVal, { color: theme.colors.text }]}>
                                  {formatDisplayDate(item.date)}
                                </Text>
                              </View>
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                              <MaterialCommunityIcons name="clock-time-four-outline" size={16} color={theme.colors.secondary} style={{ marginRight: 6 }} />
                              <View>
                                <Text style={[styles.sheetScheduleLabel, { color: theme.colors.placeholder }]}>SLOT</Text>
                                <Text style={[styles.sheetScheduleVal, { color: theme.colors.text }]}>
                                  {getSlotDisplay(item.makeModel, item.slotTime)}
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

                        {/* Cancel Button inside bottomsheet if pending */}
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
    fontSize: 13,
    fontWeight: 'bold',
  },
  guestSubtitle: {
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
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
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
    fontSize: 12,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  bookingCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
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
    marginBottom: 8,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ukPlateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD300',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#000000',
    overflow: 'hidden',
    height: 28,
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
    fontSize: 8,
  },
  ukTagText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: 'bold',
  },
  ukPlateNumber: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 12,
    paddingHorizontal: 8,
    letterSpacing: 0.8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 4,
  },
  vehicleName: {
    fontSize: 15,
    fontWeight: 'bold',
    flex: 1,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  serviceNameText: {
    fontSize: 12,
    flexShrink: 1,
  },
  priceTag: {
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  appointmentInfoBox: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  dateSlotRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dateValue: {
    fontSize: 12,
    fontWeight: '700',
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
    fontSize: 11,
    fontWeight: '700',
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    marginTop: 10,
    paddingTop: 8,
  },
  cancelBookingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  cancelBookingBtnText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '600',
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
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  sheetHeaderSubtitle: {
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
    fontSize: 15,
    fontWeight: '700',
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
    fontSize: 13,
    fontWeight: '700',
  },
  sheetStatusDesc: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  sheetSectionHeading: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  sheetServiceName: {
    fontSize: 13,
    fontWeight: '700',
  },
  sheetPriceText: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  sheetDivider: {
    height: 1,
    backgroundColor: 'rgba(150, 150, 150, 0.15)',
    marginVertical: 4,
  },
  sheetScheduleLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  sheetScheduleVal: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 1,
  },
  sheetGarageName: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  sheetGarageAddress: {
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
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
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
    fontSize: 12,
    fontWeight: 'bold',
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
    fontSize: 12,
    fontWeight: '600',
  },
  sheetReasonBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  sheetReasonTitle: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  sheetReasonText: {
    fontSize: 11,
    marginTop: 2,
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
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
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
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  emptySubtitle: {
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
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
});
