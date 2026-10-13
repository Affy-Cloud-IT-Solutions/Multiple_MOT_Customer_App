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
            const rawStatus = (item.status || 'Pending').toLowerCase();
            const isPending = rawStatus === 'pending';
            const isApproved = rawStatus === 'approved' || rawStatus === 'confirmed' || rawStatus === 'acknowledged';
            const isCompleted = rawStatus === 'completed';
            const isRejected = rawStatus === 'rejected';
            const isCancelled = rawStatus === 'cancelled';

            let statusColor = '#F59E0B'; // Pending Amber
            let statusBg = '#F59E0B15';
            let statusIcon = 'clock-outline';
            let statusText = 'Pending Confirmation';

            if (isApproved) {
              statusColor = '#10B981'; // Green
              statusBg = '#10B98115';
              statusIcon = 'check-decagram';
              statusText = 'Confirmed';
            } else if (isCompleted) {
              statusColor = '#3B82F6'; // Blue
              statusBg = '#3B82F615';
              statusIcon = 'checkbox-marked-circle';
              statusText = 'Completed';
            } else if (isCancelled) {
              statusColor = '#EF4444'; // Red
              statusBg = '#EF444415';
              statusIcon = 'calendar-remove';
              statusText = 'Cancelled';
            } else if (isRejected) {
              statusColor = '#DC2626'; // Red
              statusBg = '#DC262615';
              statusIcon = 'close-circle';
              statusText = 'Declined';
            }

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
              <View
                key={item.id || item._id || `${item.registrationNumber}-${item.date}`}
                style={[styles.bookingCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
              >
                {/* Card Header Row: UK Plate & Status Badge */}
                <View style={styles.cardHeaderRow}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => navigation.navigate('MotHistory', { registration: item.registrationNumber })}
                    style={styles.ukPlateChip}
                  >
                    <View style={styles.ukFlagBlock}>
                      <Text style={styles.ukFlagText}>🇬🇧</Text>
                      <Text style={styles.ukTagText}>UK</Text>
                    </View>
                    <Text style={styles.ukPlateNumber}>{item.registrationNumber}</Text>
                  </TouchableOpacity>

                  <View style={[styles.statusBadge, { backgroundColor: statusBg, borderColor: statusColor + '40' }]}>
                    <MaterialCommunityIcons name={statusIcon} size={13} color={statusColor} style={{ marginRight: 4 }} />
                    <Text style={[styles.statusBadgeText, { color: statusColor }]}>{statusText}</Text>
                  </View>
                </View>

                {/* Vehicle & Service Info */}
                <View style={styles.vehicleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.vehicleName, { color: theme.colors.text }]}>
                      {getVehicleDisplay(item.makeModel)}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                      <MaterialCommunityIcons name="wrench-outline" size={13} color={theme.colors.placeholder} style={{ marginRight: 4 }} />
                      <Text style={[styles.serviceNameText, { color: theme.colors.placeholder }]}>
                        {item.serviceName || 'MOT Annual Safety Inspection (Class 4)'}
                      </Text>
                      {item.price ? (
                        <Text style={[styles.priceTag, { color: theme.colors.secondary }]}>
                          • £{Number(item.price).toFixed(2)}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </View>

                {/* Appointment Date & Slot Row */}
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

                {/* Garage Location Card */}
                <View style={[styles.garageCardBox, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                      <MaterialCommunityIcons name="storefront-outline" size={16} color={theme.colors.primary} style={{ marginRight: 6 }} />
                      <Text style={[styles.garageNameText, { color: theme.colors.text }]} numberOfLines={1}>
                        {garageDisplayName}
                      </Text>
                    </View>
                    {item.garageId ? (
                      <TouchableOpacity
                        onPress={() => navigation.navigate('GarageDetail', { garageId: item.garageId })}
                        style={{ paddingHorizontal: 4 }}
                      >
                        <Text style={[styles.viewGarageLink, { color: theme.colors.primary }]}>View</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {garageAddressStr ? (
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 4 }}>
                      <MaterialCommunityIcons name="map-marker-outline" size={14} color={theme.colors.placeholder} style={{ marginRight: 4, marginTop: 1 }} />
                      <Text style={[styles.garageAddressText, { color: theme.colors.placeholder }]} numberOfLines={2}>
                        {garageAddressStr}
                      </Text>
                    </View>
                  ) : null}

                  {/* Quick Action Buttons for Garage */}
                  <View style={styles.garageBtnRow}>
                    <TouchableOpacity
                      style={[styles.smallActionBtn, { backgroundColor: theme.colors.primary }]}
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
                      <MaterialCommunityIcons name="directions" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={styles.smallActionBtnText}>Directions</Text>
                    </TouchableOpacity>

                    {garagePhone ? (
                      <TouchableOpacity
                        style={[styles.smallActionBtnOutline, { borderColor: theme.colors.border }]}
                        onPress={() => Linking.openURL(`tel:${garagePhone}`)}
                        activeOpacity={0.8}
                      >
                        <MaterialCommunityIcons name="phone" size={14} color={theme.colors.secondary} style={{ marginRight: 4 }} />
                        <Text style={[styles.smallActionBtnOutlineText, { color: theme.colors.secondary }]}>Call</Text>
                      </TouchableOpacity>
                    ) : null}

                    <TouchableOpacity
                      style={[styles.smallActionBtnOutline, { borderColor: theme.colors.border }]}
                      onPress={() => navigation.navigate('MotHistory', { registration: item.registrationNumber })}
                      activeOpacity={0.8}
                    >
                      <MaterialCommunityIcons name="history" size={14} color={theme.colors.text} style={{ marginRight: 4 }} />
                      <Text style={[styles.smallActionBtnOutlineText, { color: theme.colors.text }]}>MOT History</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Rejection / Cancellation Notice if any */}
                {(item.rejectionReason || item.cancellationReason) && (
                  <View style={[styles.reasonNotice, { backgroundColor: '#EF444410', borderColor: '#EF444430' }]}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={14} color="#EF4444" style={{ marginRight: 6 }} />
                    <Text style={[styles.reasonNoticeText, { color: '#EF4444' }]}>
                      Note: {item.rejectionReason || item.cancellationReason}
                    </Text>
                  </View>
                )}

                {/* Bottom Cancel Action for Active Appointments */}
                {(isPending || isApproved) && (
                  <View style={[styles.cardBottomRow, { borderTopColor: theme.colors.border + '60' }]}>
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
    marginBottom: 10,
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
    marginBottom: 10,
  },
  vehicleName: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  serviceNameText: {
    fontSize: 12,
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
    marginBottom: 10,
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
  garageCardBox: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  garageNameText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  garageAddressText: {
    fontSize: 11,
    lineHeight: 15,
  },
  viewGarageLink: {
    fontSize: 11,
    fontWeight: '700',
  },
  garageBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  smallActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  smallActionBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  smallActionBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  smallActionBtnOutlineText: {
    fontSize: 11,
    fontWeight: '600',
  },
  reasonNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 8,
  },
  reasonNoticeText: {
    fontSize: 11,
    flex: 1,
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
