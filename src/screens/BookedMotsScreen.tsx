import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues } from '../context/DataContext';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function BookedMotsScreen({ navigation }: any) {
  const { theme } = useAppTheme();
  const { alerts, approveAlert, acknowledgeAlert, refreshData } = useAppValues();
  const [refreshing, setRefreshing] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // Filter alerts of type BOOKED
  const bookedMots = alerts.filter((a) => a.type === 'BOOKED');

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshData();
    } catch (error) {
      console.error('[BOOKED MOTS] Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleConfirm = async (alertId: string) => {
    setLoadingAction(alertId);
    try {
      await approveAlert(alertId);
      Alert.alert('Approved', 'MOT Booking has been confirmed successfully!');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Could not approve booking.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleAcknowledge = async (alertId: string) => {
    setLoadingAction(alertId);
    try {
      await acknowledgeAlert(alertId);
      Alert.alert('Acknowledged', 'Booking request acknowledged and removed from pending.');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Could not acknowledge booking.');
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Navbar Header */}
      <View style={[styles.navbar, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.text} />
          <Text style={[styles.backBtnText, { color: theme.colors.text }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: theme.colors.text }]}>Booked MOTs</Text>
        <View style={styles.countBadge}>
          <Text style={[styles.countText, { color: theme.colors.secondary }]}>{bookedMots.length}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.secondary]} />
        }
      >
        {bookedMots.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="calendar-blank" size={54} color={theme.colors.placeholder} style={{ marginBottom: 12 }} />
            <Text style={[styles.emptyText, { color: theme.colors.placeholder }]}>No MOT bookings found.</Text>
          </View>
        ) : (
          bookedMots.map((item) => {
            const isPending = item.status === 'Pending';
            const isApproved = item.status === 'Approved';

            let statusText = 'Acknowledged';
            let statusColor = theme.colors.placeholder;
            let statusBg = theme.colors.border + '30';

            if (isPending) {
              statusText = 'Pending Confirmation';
              statusColor = theme.colors.warning;
              statusBg = theme.colors.warning + '15';
            } else if (isApproved) {
              statusText = 'Booking Confirmed';
              statusColor = theme.colors.success;
              statusBg = theme.colors.success + '15';
            }

            return (
              <View
                key={item.id}
                style={[styles.bookingCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
              >
                {/* Card Header: Date & Status */}
                <View style={styles.cardHeader}>
                  <Text style={{ fontSize: 11, color: theme.colors.placeholder }}>Requested: {item.date}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusBg, borderColor: statusColor + '40' }]}>
                    <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
                  </View>
                </View>

                {/* Card Body: Customer & Vehicle Info */}
                <View style={styles.cardBody}>
                  <View style={styles.customerRow}>
                    <MaterialCommunityIcons name="account-outline" size={16} color={theme.colors.placeholder} style={{ marginRight: 6 }} />
                    <Text style={[styles.customerName, { color: theme.colors.text }]}>{item.customerName}</Text>
                  </View>

                  <View style={styles.vehicleRow}>
                    <View style={styles.plate}>
                      <Text style={styles.plateText}>{item.registrationNumber}</Text>
                    </View>
                    <Text style={[styles.makeModelText, { color: theme.colors.text }]}>
                      {item.makeModel}
                    </Text>
                  </View>
                </View>

                {/* Actions Row (If Pending) */}
                {isPending && (
                  <>
                    <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        onPress={() => handleAcknowledge(item.id)}
                        disabled={loadingAction !== null}
                        style={[styles.actionBtn, styles.rejectBtn, { borderColor: theme.colors.border }]}
                      >
                        <Text style={[styles.actionBtnText, { color: theme.colors.text }]}>Dismiss</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleConfirm(item.id)}
                        disabled={loadingAction !== null}
                        style={[styles.actionBtn, styles.approveBtn, { backgroundColor: theme.colors.secondary }]}
                      >
                        {loadingAction === item.id ? (
                          <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : (
                          <Text style={[styles.actionBtnText, { color: '#FFFFFF' }]}>Confirm Booking</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            );
          })
        )}
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
    height: 56,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 80,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  navTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  countBadge: {
    backgroundColor: '#0284C715',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
  },
  countText: {
    fontWeight: 'bold',
    fontSize: 12,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 128,
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  bookingCard: {
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    paddingBottom: 8,
  },
  statusBadge: {
    borderWidth: 0.5,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  cardBody: {
    padding: 12,
    paddingTop: 4,
    paddingBottom: 12,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  customerName: {
    fontSize: 13,
    fontWeight: '500',
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00000003',
    padding: 6,
    borderRadius: 6,
  },
  plate: {
    backgroundColor: '#FFD300',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 10,
  },
  plateText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  makeModelText: {
    fontWeight: 'bold',
    fontSize: 13,
    flex: 1,
  },
  divider: {
    height: 1,
  },
  actionRow: {
    flexDirection: 'row',
    padding: 10,
  },
  actionBtn: {
    flex: 1,
    height: 36,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  rejectBtn: {
    borderWidth: 1.2,
  },
  approveBtn: {
    elevation: 1,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
});
