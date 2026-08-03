import React from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, Alert } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues } from '../context/DataContext';

export default function AdminAlertsScreen() {
  const { theme } = useAppTheme();
  const { alerts, approveAlert, acknowledgeAlert } = useAppValues();

  // Show only pending alerts
  const pendingAlerts = alerts.filter((a) => a.status === 'Pending');

  const handleApprove = (alertId: string, alertType: string) => {
    approveAlert(alertId);
    let message = 'Action approved successfully!';
    if (alertType === 'NEW_VEHICLE') {
      message = 'New vehicle has been approved and added to the customer profile!';
    } else if (alertType === 'SOLD') {
      message = 'Vehicle status updated to Sold. Future reminders stopped.';
    } else if (alertType === 'BOOKED') {
      message = 'MOT Booking confirmed!';
    }
    Alert.alert('Approved', message);
  };

  const handleReject = (alertId: string) => {
    acknowledgeAlert(alertId);
    Alert.alert('Rejected', 'Request has been rejected and removed from pending actions.');
  };

  const handleAcknowledge = (alertId: string) => {
    acknowledgeAlert(alertId);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Admin Notifications</Text>
        <Text style={[styles.subtitle, { color: theme.colors.placeholder }]}>
          Review self-service requests submitted by customers
        </Text>
      </View>

      <View style={styles.listContainer}>
        {pendingAlerts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="bell-off-outline" size={48} color={theme.colors.placeholder} style={{ marginBottom: 12 }} />
            <Text style={[styles.emptyText, { color: theme.colors.placeholder }]}>No pending action alerts.</Text>
          </View>
        ) : (
          pendingAlerts.map((item) => {
            let iconName = 'alert-circle-outline';
            let iconColor = theme.colors.secondary;
            let typeText = 'Alert';

            if (item.type === 'NEW_VEHICLE') {
              iconName = 'car-plus';
              iconColor = '#10B981'; // Green
              typeText = 'New Vehicle Added';
            } else if (item.type === 'SOLD') {
              iconName = 'car-off';
              iconColor = theme.colors.warning; // Orange
              typeText = 'Vehicle Marked Sold';
            } else if (item.type === 'BOOKED') {
              iconName = 'calendar-check';
              iconColor = theme.colors.secondary; // Blue
              typeText = 'MOT Booking Requested';
            }

            return (
              <View
                key={item.id}
                style={[styles.alertCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <MaterialCommunityIcons name={iconName} size={22} color={iconColor} style={{ marginRight: 8 }} />
                    <Text style={[styles.typeText, { color: theme.colors.text }]}>{typeText}</Text>
                  </View>
                  <Text style={{ fontSize: 11, color: theme.colors.placeholder }}>{item.date}</Text>
                </View>

                <View style={styles.cardBody}>
                  <Text style={[styles.bodyText, { color: theme.colors.text }]}>
                    Customer <Text style={{ fontWeight: 'bold' }}>{item.customerName}</Text>{' '}
                    {item.type === 'NEW_VEHICLE' && 'wishes to register a new vehicle:'}
                    {item.type === 'SOLD' && 'reported they sold their vehicle:'}
                    {item.type === 'BOOKED' && 'requested MOT booking for:'}
                  </Text>

                  <View style={styles.vehicleRow}>
                    <View style={styles.plate}>
                      <Text style={styles.plateText}>{item.registrationNumber}</Text>
                    </View>
                    <Text style={[styles.makeModelText, { color: theme.colors.text }]}>
                      {item.makeModel}
                    </Text>
                  </View>
                </View>

                <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

                {item.type === 'NEW_VEHICLE' || item.type === 'SOLD' ? (
                  // Approve / Reject actions
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      onPress={() => handleReject(item.id)}
                      style={[styles.actionBtn, styles.rejectBtn, { borderColor: theme.colors.error }]}
                    >
                      <Text style={[styles.actionBtnText, { color: theme.colors.error }]}>Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleApprove(item.id, item.type)}
                      style={[styles.actionBtn, styles.approveBtn, { backgroundColor: theme.colors.primary }]}
                    >
                      <Text style={[styles.actionBtnText, { color: '#FFFFFF' }]}>Approve</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  // Booked / Notification - simple acknowledge action
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      onPress={() => handleAcknowledge(item.id)}
                      style={[styles.actionBtn, styles.ackBtn, { borderColor: theme.colors.border }]}
                    >
                      <Text style={[styles.actionBtnText, { color: theme.colors.text }]}>Acknowledge</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleApprove(item.id, item.type)}
                      style={[styles.actionBtn, styles.approveBtn, { backgroundColor: theme.colors.secondary }]}
                    >
                      <Text style={[styles.actionBtnText, { color: '#FFFFFF' }]}>Confirm Booking</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 24,
    paddingBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
  },
  listContainer: {
    padding: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  alertCard: {
    borderWidth: 1,
    borderRadius: 14,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 2,
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
  typeText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  cardBody: {
    padding: 12,
    paddingTop: 4,
  },
  bodyText: {
    fontSize: 13.5,
    lineHeight: 18,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: '#00000005',
    padding: 6,
    borderRadius: 6,
  },
  plate: {
    backgroundColor: '#FFD300',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
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
  ackBtn: {
    borderWidth: 1.2,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
});
