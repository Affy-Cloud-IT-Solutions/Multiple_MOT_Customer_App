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
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues } from '../context/DataContext';
import { SafeAreaView } from 'react-native-safe-area-context';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function CustomerPortalScreen({ route, navigation }: any) {
  const { theme, toggleTheme } = useAppTheme();
  const { customers, vehicles, alerts, addAlert, addVehicle, addAudit, updateVehicleStatus, refreshData } = useAppValues();

  // Find active customer
  const customerId = route?.params?.customerId || 'c1';
  const customer = customers.find((c) => c.id === customerId) || customers[0];

  if (!customer) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={{ marginTop: 10, color: theme.colors.text }}>Loading portal...</Text>
      </SafeAreaView>
    );
  }

  // Active customer vehicles
  const customerVehicles = vehicles.filter((v) => v.customerId === customer.id && v.status === 'Active');

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      refreshData();
    });
    return unsubscribe;
  }, [navigation]);

  // New Vehicle form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [regNo, setRegNo] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [expiry, setExpiry] = useState('');
  const [expandedBookingReg, setExpandedBookingReg] = useState<string | null>(null);

  const getBookingSlot = (makeModel: string) => {
    const parts = makeModel.split(' - Slot: ');
    return parts.length > 1 ? parts[1] : makeModel;
  };

  const formatShortDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const monthIndex = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      if (monthIndex >= 0 && monthIndex < 12) {
        return `${day} ${months[monthIndex]} ${year}`;
      }
    }
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

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

  // Loading spinner states per vehicle/action
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const handleBookMOT = (vehicle: any) => {
    navigation.navigate('Booking', { vehicle });
  };

  const handleMarkAsSold = (vehicleId: string, reg: string, makeModel: string) => {
    const actionId = `sold_${vehicleId}`;
    
    Alert.alert(
      'Confirm Vehicle Sold',
      `Are you sure you want to mark your ${makeModel} (${reg}) as sold? Future MOT reminders will be stopped.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Sold',
          style: 'destructive',
          onPress: () => {
            setLoadingAction(actionId);
            setTimeout(() => {
              setLoadingAction(null);

              // Update vehicle status in shared DB
              updateVehicleStatus(vehicleId, 'Sold');

              // Add notification to Admin alerts
              addAlert({
                type: 'SOLD',
                customerName: `${customer.firstName} ${customer.lastName}`,
                customerId: customer.id,
                registrationNumber: reg,
                makeModel: makeModel,
              });

              Alert.alert(
                'Status Updated',
                'Vehicle ownership updated. Automated reminders for this vehicle have been permanently deactivated.'
              );
            }, 1200);
          },
        },
      ]
    );
  };

  const handleAddNewVehicle = async () => {
    if (!regNo.trim() || !make.trim() || !model.trim() || !expiry.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoadingAction('add_vehicle');
    try {
      // 1. Create the vehicle directly in the database
      await addVehicle({
        customerId: customer.id,
        registrationNumber: regNo.trim().toUpperCase(),
        make: make.trim().toUpperCase(),
        model: model.trim().toUpperCase(),
        year: '2018',
        motExpiryDate: expiry,
        status: 'Active'
      });

      // 2. Send alert notification to Admin for log/info
      await addAlert({
        type: 'NEW_VEHICLE',
        customerName: `${customer.firstName} ${customer.lastName}`,
        customerId: customer.id,
        registrationNumber: regNo.trim().toUpperCase(),
        makeModel: `${make.trim().toUpperCase()} ${model.trim().toUpperCase()}`,
      });

      await addAudit(
        'New Vehicle Registered', 
        `${customer.firstName} ${customer.lastName} registered vehicle ${make.trim().toUpperCase()} (${regNo.trim().toUpperCase()})`
      );

      setLoadingAction(null);

      // Reset
      setRegNo('');
      setMake('');
      setModel('');
      setExpiry('');
      setShowAddForm(false);

      Alert.alert(
        'Vehicle Registered',
        'Your new vehicle has been registered successfully and is now visible in your portal!'
      );
    } catch (error: any) {
      setLoadingAction(null);
      console.error('[PORTAL] handleAddNewVehicle error:', error);
      Alert.alert('Registration Failed', error?.message || 'Could not register vehicle. Please verify registration plate is unique.');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Top Bar / Header */}
      <View style={[styles.navbar, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => navigation.replace('Login')} style={styles.backBtn}>
          <MaterialCommunityIcons name="logout" size={20} color={theme.colors.error} />
          <Text style={[styles.backBtnText, { color: theme.colors.error }]}>Exit Portal</Text>
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: theme.colors.text }]}>Self-Service Portal</Text>
        <View style={styles.rightActionsRow}>
          <TouchableOpacity onPress={toggleTheme} style={styles.themeBtn}>
            <MaterialCommunityIcons name="theme-light-dark" size={20} color={theme.colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setShowAddForm(!showAddForm);
            }}
            style={styles.addNavBtn}
          >
            <MaterialCommunityIcons name="plus" size={22} color={theme.colors.secondary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Welcome Block */}
        <View style={styles.welcomeBlock}>
          <Text style={[styles.welcomeTitle, { color: theme.colors.text }]}>
            Hello, {customer.firstName}!
          </Text>
          <Text style={[styles.welcomeSubtitle, { color: theme.colors.placeholder }]}>
            Manage your MOT reminders and update ownership details below.
          </Text>
        </View>

        {/* Add New Vehicle Form */}
        {showAddForm && (
          <View style={[styles.formCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <Text style={[styles.formTitle, { color: theme.colors.text }]}>Add New Vehicle Details</Text>
            
            <Text style={[styles.label, { color: theme.colors.text }]}>Registration Number</Text>
            <TextInput
              value={regNo}
              onChangeText={setRegNo}
              placeholder="E.g. AB12 XYZ"
              placeholderTextColor={theme.colors.placeholder}
              autoCapitalize="characters"
              style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
            />

            <View style={styles.formRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={[styles.label, { color: theme.colors.text }]}>Make</Text>
                <TextInput
                  value={make}
                  onChangeText={setMake}
                  placeholder="E.g. FORD"
                  placeholderTextColor={theme.colors.placeholder}
                  autoCapitalize="characters"
                  style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: theme.colors.text }]}>Model</Text>
                <TextInput
                  value={model}
                  onChangeText={setModel}
                  placeholder="E.g. FOCUS"
                  placeholderTextColor={theme.colors.placeholder}
                  autoCapitalize="characters"
                  style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
                />
              </View>
            </View>

            <Text style={[styles.label, { color: theme.colors.text }]}>MOT Expiry Date</Text>
            <TextInput
              value={expiry}
              onChangeText={(text) => setExpiry(formatDateInput(text))}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.colors.placeholder}
              keyboardType="numeric"
              maxLength={10}
              style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
            />

            <TouchableOpacity
              onPress={handleAddNewVehicle}
              disabled={loadingAction === 'add_vehicle'}
              style={[styles.submitButton, { backgroundColor: theme.colors.secondary }]}
            >
              {loadingAction === 'add_vehicle' ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>Request Registration Approval</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Vehicles Registry */}
        <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>Your Registered Vehicles</Text>

        {customerVehicles.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="car-outline" size={48} color={theme.colors.placeholder} style={{ marginBottom: 12 }} />
            <Text style={[styles.emptyText, { color: theme.colors.placeholder }]}>
              You have no active vehicles registered for MOT reminders.
            </Text>
          </View>
        ) : (
          customerVehicles.map((v) => {
            const isBooked = alerts.some((a) => a.type === 'BOOKED' && a.registrationNumber === v.registrationNumber);
            return (
              <View key={v.id} style={[styles.vehicleCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                {/* Header Info */}
                <View style={styles.vehicleHeader}>
                  <Text style={[styles.makeModelText, { color: theme.colors.text, flex: 1 }]}>
                    {v.make} {v.model}
                  </Text>
                  {isBooked && (
                    <TouchableOpacity
                      onPress={() => {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        setExpandedBookingReg(expandedBookingReg === v.registrationNumber ? null : v.registrationNumber);
                      }}
                      style={[styles.bookedBadge, { backgroundColor: theme.colors.success + '20', borderColor: theme.colors.success }]}
                    >
                      <MaterialCommunityIcons name="check-circle" size={12} color={theme.colors.success} style={{ marginRight: 2 }} />
                      <Text style={[styles.bookedBadgeText, { color: theme.colors.success }]}>Booked</Text>
                      <MaterialCommunityIcons 
                        name={expandedBookingReg === v.registrationNumber ? "chevron-up" : "chevron-down"} 
                        size={14} 
                        color={theme.colors.success} 
                        style={{ marginLeft: 2 }} 
                      />
                    </TouchableOpacity>
                  )}
                </View>

              <View style={styles.vehicleBody}>
                <View style={[styles.infoRow, { justifyContent: 'flex-start', alignItems: 'center' }]}>
                  <Text style={{ color: theme.colors.placeholder, fontSize: 13, marginRight: 8 }}>Registration Number:</Text>
                  <View style={styles.smallPlate}>
                    <Text style={styles.smallPlateText}>{v.registrationNumber}</Text>
                  </View>
                </View>
                
                <View style={[styles.infoRow, { marginTop: 6, justifyContent: 'flex-start' }]}>
                  <Text style={{ color: theme.colors.placeholder, fontSize: 13 }}>MOT: </Text>
                  <Text style={{ color: theme.colors.text, fontWeight: 'bold', fontSize: 13 }}>{formatShortDate(v.motExpiryDate)}</Text>
                </View>
                
                {v.lastServiceDate && (
                  <View style={[styles.infoRow, { marginTop: 6, justifyContent: 'flex-start' }]}>
                    <Text style={{ color: theme.colors.placeholder, fontSize: 13 }}>Last Service: </Text>
                    <Text style={{ color: theme.colors.text, fontSize: 13 }}>{formatShortDate(v.lastServiceDate)}</Text>
                  </View>
                )}

                {isBooked && expandedBookingReg === v.registrationNumber && (() => {
                  const bookingAlert = alerts.find((a) => a.type === 'BOOKED' && a.registrationNumber === v.registrationNumber);
                  if (!bookingAlert) return null;
                  
                  return (
                    <View style={[styles.bookingDetailsContainer, { backgroundColor: theme.colors.primaryContainer + '20', borderColor: theme.colors.border }]}>
                      <View style={styles.bookingDetailsHeader}>
                        <MaterialCommunityIcons name="calendar-clock" size={16} color={theme.colors.secondary} style={{ marginRight: 6 }} />
                        <Text style={[styles.bookingDetailsTitle, { color: theme.colors.text }]}>Booking Details</Text>
                      </View>
                      <View style={styles.bookingInfoRow}>
                        <Text style={[styles.bookingInfoLabel, { color: theme.colors.placeholder }]}>Slot/Date:</Text>
                        <Text style={[styles.bookingInfoValue, { color: theme.colors.text }]}>
                          {getBookingSlot(bookingAlert.makeModel)}
                        </Text>
                      </View>
                      <View style={styles.bookingInfoRow}>
                        <Text style={[styles.bookingInfoLabel, { color: theme.colors.placeholder }]}>Status:</Text>
                        <Text style={[
                          styles.bookingInfoValue, 
                          { 
                            color: bookingAlert.status === 'Approved' ? theme.colors.success :
                                   bookingAlert.status === 'Pending' ? theme.colors.warning :
                                   theme.colors.placeholder,
                            fontWeight: 'bold'
                          }
                        ]}>
                          {bookingAlert.status === 'Pending' ? 'Pending Confirmation' : 
                           bookingAlert.status === 'Approved' ? 'Confirmed ✅' : 
                           'Acknowledged'}
                        </Text>
                      </View>
                      <View style={styles.bookingInfoRow}>
                        <Text style={[styles.bookingInfoLabel, { color: theme.colors.placeholder }]}>Requested On:</Text>
                        <Text style={[styles.bookingInfoValue, { color: theme.colors.text }]}>
                          {new Date(bookingAlert.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    </View>
                  );
                })()}
              </View>

              <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

              {/* Action Buttons */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  onPress={() => handleMarkAsSold(v.id, v.registrationNumber, `${v.make} ${v.model}`)}
                  disabled={loadingAction !== null}
                  style={[styles.actionBtn, styles.soldBtn, { borderColor: theme.colors.border }]}
                >
                  {loadingAction === `sold_${v.id}` ? (
                    <ActivityIndicator size="small" color={theme.colors.error} />
                  ) : (
                    <View style={styles.actionBtnContent}>
                      <MaterialCommunityIcons name="car-off" size={16} color={theme.colors.error} style={{ marginRight: 4 }} />
                      <Text style={[styles.actionBtnText, { color: theme.colors.error }]}>Mark Sold</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {isBooked ? (
                  <TouchableOpacity
                    onPress={() => navigation.navigate('Booking', { vehicle: v, isReschedule: true })}
                    disabled={loadingAction !== null}
                    style={[styles.actionBtn, styles.bookBtn, { backgroundColor: theme.colors.warning }]}
                  >
                    <View style={styles.actionBtnContent}>
                      <MaterialCommunityIcons name="calendar-edit" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={[styles.actionBtnText, { color: '#FFFFFF' }]}>Reschedule</Text>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={() => handleBookMOT(v)}
                    disabled={loadingAction !== null}
                    style={[styles.actionBtn, styles.bookBtn, { backgroundColor: theme.colors.secondary }]}
                  >
                    <View style={styles.actionBtnContent}>
                      <MaterialCommunityIcons name="calendar-plus" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={[styles.actionBtnText, { color: '#FFFFFF' }]}>Book MOT</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>
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
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 100,
  },
  backBtnText: {
    fontWeight: 'bold',
    fontSize: 13,
    marginLeft: 4,
  },
  navTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  rightActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 100,
    justifyContent: 'flex-end',
  },
  themeBtn: {
    marginRight: 16,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  addNavBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  welcomeBlock: {
    marginBottom: 24,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 6,
  },
  welcomeSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  formCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  formTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 14,
  },
  formRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  input: {
    height: 38,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    fontSize: 13,
    marginBottom: 12,
  },
  submitButton: {
    height: 40,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 20,
  },
  vehicleCard: {
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
  vehicleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    paddingBottom: 8,
  },
  plate: {
    backgroundColor: '#FFD300',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 12,
  },
  plateText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  makeModelText: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  vehicleBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  soldBtn: {
    borderWidth: 1.2,
  },
  bookBtn: {
    elevation: 1,
  },
  actionBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  bookedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'center',
  },
  bookedBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  bookingDetailsContainer: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  bookingDetailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    paddingBottom: 4,
  },
  bookingDetailsTitle: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  bookingInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 3,
  },
  bookingInfoLabel: {
    fontSize: 12,
  },
  bookingInfoValue: {
    fontSize: 12,
    fontWeight: '500',
  },
  smallPlate: {
    backgroundColor: '#FFD300',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  smallPlateText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 10,
    letterSpacing: 0.5,
  },
});
