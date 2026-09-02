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
  Switch,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues, BASE_URL } from '../context/DataContext';
import SearchableDropdown from '../components/SearchableDropdown';
import { SafeAreaView } from 'react-native-safe-area-context';
import { validateMotExpiryDate } from '../utils/validationUtils';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function CustomerPortalScreen({ route, navigation }: any) {
  const { isDarkMode, theme, toggleTheme } = useAppTheme();
  const { customers, vehicles, alerts, addAlert, addVehicle, addAudit, updateVehicleStatus, refreshData, setToken, setUser, token, user, acknowledgeAlert } = useAppValues();

  // Find active customer
  const customerId = route?.params?.customerId || user?.customerId || 'c1';
  const customer = customers.find((c) => c.id === customerId) || customers[0] || {
    id: customerId,
    firstName: user?.name?.split(' ')[0] || 'Customer',
    lastName: user?.name?.split(' ').slice(1).join(' ') || '',
    email: user?.email || '',
    mobile: '',
  };

  if (!token) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <MaterialCommunityIcons name="account-lock-outline" size={72} color={theme.colors.placeholder} style={{ marginBottom: 16 }} />
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.colors.text, marginBottom: 8, textAlign: 'center' }}>
          Access Customer Portal
        </Text>
        <Text style={{ fontSize: 13, color: theme.colors.placeholder, textAlign: 'center', marginBottom: 24, paddingHorizontal: 20, lineHeight: 18 }}>
          Please sign in to view and manage your registered vehicles, check MOT histories, and book new appointments.
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
          <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 }}>
            Sign In / Sign Up
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Active customer vehicles (including Pending and Rejected statuses)
  const customerVehicles = vehicles.filter((v) => 
    v.customerId && (
      String(v.customerId).toLowerCase() === String(customer.id || '').toLowerCase() ||
      String(v.customerId).toLowerCase() === String(customer._id || '').toLowerCase()
    ) && v.status !== 'Sold' && v.status !== 'Scrapped'
  );

  const getDaysUntilExpiry = (expiryDateStr?: string) => {
    if (!expiryDateStr) return -1;
    const expiryDate = new Date(expiryDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = expiryDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const rejectedAlerts = alerts.filter(a => a.status === 'Rejected' && a.customerId && (
    String(a.customerId).toLowerCase() === String(customer.id || '').toLowerCase() ||
    String(a.customerId).toLowerCase() === String(customer._id || '').toLowerCase()
  ));

  const totalVehicles = customerVehicles.length;
  const pendingApprovals = customerVehicles.filter(v => v.status === 'Pending').length;

  let upcomingExpiryVehicle = null;
  let upcomingExpiryDays = Infinity;
  customerVehicles.forEach(v => {
    const days = getDaysUntilExpiry(v.motExpiryDate);
    if (days >= 0 && days < upcomingExpiryDays) {
      upcomingExpiryDays = days;
      upcomingExpiryVehicle = v;
    }
  });

  const activeBookings = alerts.filter(a => a.type === 'BOOKED' && a.status === 'Approved' && a.customerId && (
    String(a.customerId).toLowerCase() === String(customer.id || '').toLowerCase() ||
    String(a.customerId).toLowerCase() === String(customer._id || '').toLowerCase()
  ) && customerVehicles.some(v => v.registrationNumber.toUpperCase() === a.registrationNumber.toUpperCase())).length;

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
  const [year, setYear] = useState('');
  const [expiry, setExpiry] = useState('');
  const [expandedBookingReg, setExpandedBookingReg] = useState<string | null>(null);

  const fetchMakesList = async (search: string, pageNum: number) => {
    const fallbackMakes = [
      'ALFA ROMEO', 'ASTON MARTIN', 'AUDI', 'BENTLEY', 'BMW', 'CITROEN', 'CUPRA', 'DACIA', 
      'DS', 'FERRARI', 'FIAT', 'FORD', 'HONDA', 'HYUNDAI', 'JAGUAR', 'JEEP', 'KIA', 
      'LAMBORGHINI', 'LAND ROVER', 'LEXUS', 'LOTUS', 'MASERATI', 'MAZDA', 'MCLAREN', 
      'MERCEDES-BENZ', 'MG', 'MINI', 'MITSUBISHI', 'NISSAN', 'PEUGEOT', 'PORSCHE', 
      'RENAULT', 'ROLLS-ROYCE', 'SEAT', 'SKODA', 'SMART', 'SSANGYONG', 'SUBARU', 
      'SUZUKI', 'TESLA', 'TOYOTA', 'VAUXHALL', 'VOLKSWAGEN', 'VOLVO'
    ];
    try {
      const response = await fetch(`${BASE_URL}/vehicles/makes?page=${pageNum}&limit=20&search=${encodeURIComponent(search)}`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const items = data.makes && data.makes.length > 0 ? data.makes : fallbackMakes.filter(m => m.includes(search.toUpperCase()));
      return {
        items,
        hasMore: data.pagination ? data.pagination.page < data.pagination.totalPages : false
      };
    } catch (e) {
      console.warn('Failed to fetch makes, using client-side fallback list:', e);
      const filtered = search 
        ? fallbackMakes.filter(m => m.includes(search.toUpperCase()))
        : fallbackMakes;
      const limit = 20;
      const start = (pageNum - 1) * limit;
      const items = filtered.slice(start, start + limit);
      const hasMore = start + limit < filtered.length;
      return { items, hasMore };
    }
  };

  const fetchModelsListForMake = (makeVal: string) => async (search: string, pageNum: number) => {
    if (!makeVal) return { items: [], hasMore: false };
    const fallbackModelsMap: Record<string, string[]> = {
      'FORD': ['FOCUS', 'FIESTA', 'MUSTANG', 'MONDEO', 'KUGA', 'PUMA', 'RANGER', 'TRANSIT', 'KA', 'GALAXY', 'C-MAX', 'S-MAX'],
      'BMW': ['1 SERIES', '2 SERIES', '3 SERIES', '4 SERIES', '5 SERIES', 'X1', 'X3', 'X5', 'M3', 'M5', 'i3', 'i8', '320D', '520D'],
      'MITSUBISHI': ['OUTLANDER', 'L200', 'SHOGUN', 'COLT', 'ASX', 'ECLIPSE CROSS', 'MIRAGE', 'LANCER'],
      'VOLKSWAGEN': ['GOLF', 'POLO', 'PASSAT', 'TIGUAN', 'UP', 'TOURAN', 'CADDY', 'TRANSPORTER', 'SHARAN', 'SCIROCCO', 'TOUAREG'],
      'AUDI': ['A1', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'Q2', 'Q3', 'Q5', 'Q7', 'TT', 'R8', 'E-TRON'],
      'VAUXHALL': ['ASTRA', 'CORSA', 'INSIGNIA', 'MOKKA', 'ZAFIRA', 'VIVA', 'CROSSLAND', 'GRANDLAND'],
      'TOYOTA': ['YARIS', 'COROLLA', 'AURIS', 'PRIUS', 'AVENSIS', 'RAV4', 'C-HR', 'LAND CRUISER', 'AYGO', 'HILUX'],
      'HONDA': ['CIVIC', 'JAZZ', 'CR-V', 'HR-V', 'ACCORD', 'INSIGHT'],
      'NISSAN': ['QASHQAI', 'JUKE', 'MICRA', 'LEAF', 'X-TRAIL', 'NOTE', 'NAVARA'],
      'HYUNDAI': ['I10', 'I20', 'I30', 'TUCSON', 'IONIQ', 'KONA', 'SANTA FE'],
      'KIA': ['SPORTAGE', 'CEED', 'RIO', 'PICANTO', 'NIRO', 'SORENTO', 'STONIC'],
      'MERCEDES-BENZ': ['A CLASS', 'B CLASS', 'C CLASS', 'E CLASS', 'S CLASS', 'GLA', 'GLC', 'GLE', 'CLA', 'CLS'],
      'PEUGEOT': ['108', '208', '308', '2008', '3008', '5008', 'PARTNER'],
      'RENAULT': ['CLIO', 'CAPTUR', 'MEGANE', 'KADJAR', 'ZOE', 'SCENIC'],
      'FIAT': ['500', 'PANDA', 'PUNTO', 'TIPO', '500X', 'DOBLO'],
      'LAND ROVER': ['RANGE ROVER', 'DISCOVERY', 'DEFENDER', 'EVOQUE', 'VELAR', 'FREELANDER'],
      'JAGUAR': ['XE', 'XF', 'XJ', 'F-PACE', 'E-PACE', 'I-PACE', 'F-TYPE'],
      'MINI': ['COOPER', 'ONE', 'COUNTRYMAN', 'CLUBMAN'],
      'TESLA': ['MODEL 3', 'MODEL Y', 'MODEL S', 'MODEL X']
    };
    try {
      const response = await fetch(`${BASE_URL}/vehicles/models?make=${encodeURIComponent(makeVal)}&page=${pageNum}&limit=20&search=${encodeURIComponent(search)}`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const localModels = fallbackModelsMap[makeVal.toUpperCase()] || [];
      const items = data.models && data.models.length > 0 ? data.models : localModels.filter(m => m.includes(search.toUpperCase()));
      return {
        items,
        hasMore: data.pagination ? data.pagination.page < data.pagination.totalPages : false
      };
    } catch (e) {
      console.warn('Failed to fetch models, using client-side fallback list:', e);
      const localModels = fallbackModelsMap[makeVal.toUpperCase()] || [];
      const filtered = search 
        ? localModels.filter(m => m.includes(search.toUpperCase()))
        : localModels;
      const limit = 20;
      const start = (pageNum - 1) * limit;
      const items = filtered.slice(start, start + limit);
      const hasMore = start + limit < filtered.length;
      return { items, hasMore };
    }
  };
  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'motHistory' | 'profile'>('home');

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

              const vehicleBooking = alerts.find((a) => a.type === 'BOOKED' && a.registrationNumber === reg);
              const targetGarageId = vehicleBooking?.garageId;

              // Add notification to Admin alerts
              addAlert({
                type: 'SOLD',
                customerName: `${customer.firstName} ${customer.lastName}`,
                customerId: customer.id,
                registrationNumber: reg,
                makeModel: makeModel,
                garageId: targetGarageId,
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
    if (!regNo.trim() || !make.trim() || !model.trim() || !year.trim() || !expiry.trim()) {
      Alert.alert('Error', 'Please fill in all vehicle details');
      return;
    }

    // Verify year is a 4-digit number
    if (!/^\d{4}$/.test(year.trim())) {
      Alert.alert('Error', 'Please enter a valid 4-digit year of manufacture');
      return;
    }

    // Validate MOT Expiry Date
    const expiryVal = validateMotExpiryDate(expiry);
    if (expiryVal.error) {
      Alert.alert('Validation Error', expiryVal.error);
      return;
    }

    setLoadingAction('add_vehicle');
    try {
      // 1. Create the vehicle in the database with Active status
      await addVehicle({
        customerId: customer.id,
        registrationNumber: regNo.trim().toUpperCase(),
        make: make.trim().toUpperCase(),
        model: model.trim().toUpperCase(),
        year: year.trim(),
        motExpiryDate: expiry,
        status: 'Active'
      });

      // 2. Send informational alert for vehicle registration
      await addAlert({
        type: 'NEW_VEHICLE',
        customerName: `${customer.firstName} ${customer.lastName}`,
        customerId: customer.id,
        registrationNumber: regNo.trim().toUpperCase(),
        makeModel: `${make.trim().toUpperCase()} ${model.trim().toUpperCase()}`,
        status: 'Approved'
      });

      await addAudit(
        'New Vehicle Registered', 
        `${customer.firstName} ${customer.lastName} added vehicle ${make.trim().toUpperCase()} (${regNo.trim().toUpperCase()}) - active immediately`
      );

      setLoadingAction(null);

      // Reset
      setRegNo('');
      setMake('');
      setModel('');
      setYear('');
      setExpiry('');
      setShowAddForm(false);

      Alert.alert(
        'Vehicle Added',
        'Your vehicle has been added successfully! You can now book MOT appointments and manage reminders.'
      );
    } catch (error: any) {
      setLoadingAction(null);
      console.error('[PORTAL] handleAddNewVehicle error:', error);
      Alert.alert('Registration Failed', error?.message || 'Could not register vehicle. Please verify registration plate is unique.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>


      {/* Top Segmented Tab Switcher */}
      <View style={[styles.segmentContainer, { borderBottomColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
        <TouchableOpacity
          onPress={() => setActiveTab('home')}
          style={[styles.segmentButton, activeTab === 'home' && { borderBottomColor: theme.colors.primary }]}
        >
          <Text style={[styles.segmentText, { color: activeTab === 'home' ? theme.colors.primary : theme.colors.placeholder }]}>
            My Vehicles
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('motHistory')}
          style={[styles.segmentButton, activeTab === 'motHistory' && { borderBottomColor: theme.colors.primary }]}
        >
          <Text style={[styles.segmentText, { color: activeTab === 'motHistory' ? theme.colors.primary : theme.colors.placeholder }]}>
            MOT History
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('history')}
          style={[styles.segmentButton, activeTab === 'history' && { borderBottomColor: theme.colors.primary }]}
        >
          <Text style={[styles.segmentText, { color: activeTab === 'history' ? theme.colors.primary : theme.colors.placeholder }]}>
            Bookings History
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tabs Content */}
      <View style={{ flex: 1 }}>
        {activeTab === 'home' && (
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            {/* Welcome Block */}
            <View style={styles.welcomeBlock}>
              <Text style={[styles.welcomeTitle, { color: theme.colors.text }]}>
                Hello, {customer.firstName}!
              </Text>
              <Text style={[styles.welcomeSubtitle, { color: theme.colors.placeholder }]}>
                Manage your registered vehicles and request MOT appointment slots.
              </Text>
            </View>

            {/* Rejected Notifications Banner */}
            {rejectedAlerts.map(alert => (
              <View key={alert.id} style={[styles.notificationAlertBox, { backgroundColor: theme.colors.error + '12', borderColor: theme.colors.error }]}>
                <MaterialCommunityIcons name="alert-circle-outline" size={20} color={alert.type === 'NEW_VEHICLE' ? theme.colors.error : theme.colors.warning} />
                <Text style={[styles.notificationAlertText, { color: theme.colors.text }]}>
                  {alert.type === 'NEW_VEHICLE' ? 'Registration' : 'Booking'} request for {alert.registrationNumber} was rejected: "{alert.rejectionReason || 'No reason provided'}"
                </Text>
                <TouchableOpacity
                  onPress={() => acknowledgeAlert(alert.id)}
                  style={[styles.notificationDismissBtn, { backgroundColor: theme.colors.error + '20' }]}
                >
                  <Text style={[styles.notificationDismissText, { color: theme.colors.error }]}>Dismiss</Text>
                </TouchableOpacity>
              </View>
            ))}

            {/* Stats Dashboard Summary */}
            <View style={styles.statsContainer}>
              {/* Vehicles Stat */}
              <View style={[styles.statCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <MaterialCommunityIcons name="car-multiple" size={22} color={theme.colors.secondary} />
                <Text style={[styles.statLabel, { color: theme.colors.placeholder }]}>MY VEHICLES</Text>
                <Text style={[styles.statValue, { color: theme.colors.text }]}>{totalVehicles}</Text>
                <Text style={[styles.statSubtext, { color: pendingApprovals > 0 ? theme.colors.warning : theme.colors.placeholder }]}>
                  {pendingApprovals > 0 ? `${pendingApprovals} Pending` : 'All Approved'}
                </Text>
              </View>

              {/* Nearest Expiry Stat */}
              <View style={[styles.statCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <MaterialCommunityIcons name="calendar-alert" size={22} color={upcomingExpiryDays <= 30 ? theme.colors.error : theme.colors.success} />
                <Text style={[styles.statLabel, { color: theme.colors.placeholder }]}>NEXT EXPIRY</Text>
                <Text style={[styles.statValue, { color: theme.colors.text }]} numberOfLines={1}>
                  {upcomingExpiryVehicle ? (upcomingExpiryVehicle as any).registrationNumber : 'None'}
                </Text>
                <Text style={[styles.statSubtext, { color: upcomingExpiryDays <= 30 ? theme.colors.error : theme.colors.placeholder }]}>
                  {upcomingExpiryVehicle ? (upcomingExpiryDays === 0 ? 'Today' : upcomingExpiryDays === 1 ? '1 day left' : `${upcomingExpiryDays} days left`) : 'No due vehicles'}
                </Text>
              </View>

              {/* Bookings Stat */}
              <View style={[styles.statCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <MaterialCommunityIcons name="calendar-check" size={22} color={theme.colors.primary} />
                <Text style={[styles.statLabel, { color: theme.colors.placeholder }]}>BOOKINGS</Text>
                <Text style={[styles.statValue, { color: theme.colors.text }]}>{activeBookings}</Text>
                <Text style={[styles.statSubtext, { color: theme.colors.placeholder }]}>Confirmed Active</Text>
              </View>
            </View>

            {/* Add Vehicle Button & Collapsible Form */}
            {showAddForm && (
              <View style={[styles.formCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <Text style={[styles.formTitle, { color: theme.colors.text }]}>Register New Vehicle</Text>
                
                <Text style={[styles.label, { color: theme.colors.text }]}>Registration Number</Text>
                <View style={[styles.inputWrapper, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                  <MaterialCommunityIcons name="card-text-outline" size={18} color={theme.colors.placeholder} style={{ marginRight: 6 }} />
                  <TextInput
                    value={regNo}
                    onChangeText={setRegNo}
                    placeholder="E.g. AB12 XYZ"
                    placeholderTextColor={theme.colors.placeholder}
                    autoCapitalize="characters"
                    style={[styles.inputField, { color: theme.colors.text }]}
                  />
                </View>

                <View style={styles.formRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[styles.label, { color: theme.colors.text }]}>Make</Text>
                    <SearchableDropdown
                      placeholder="Make"
                      selectedValue={make}
                      onValueChange={(val) => {
                        setMake(val);
                        setModel('');
                      }}
                      fetchItems={fetchMakesList}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: theme.colors.text }]}>Model</Text>
                    <SearchableDropdown
                      placeholder="Model"
                      selectedValue={model}
                      onValueChange={setModel}
                      fetchItems={fetchModelsListForMake(make)}
                      disabled={!make}
                    />
                  </View>
                </View>

                <View style={styles.formRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[styles.label, { color: theme.colors.text }]}>Year</Text>
                    <View style={[styles.inputWrapper, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                      <MaterialCommunityIcons name="calendar-outline" size={16} color={theme.colors.placeholder} style={{ marginRight: 6 }} />
                      <TextInput
                        value={year}
                        onChangeText={setYear}
                        placeholder="E.g. 2018"
                        placeholderTextColor={theme.colors.placeholder}
                        keyboardType="numeric"
                        maxLength={4}
                        style={[styles.inputField, { color: theme.colors.text }]}
                      />
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: theme.colors.text }]}>MOT Expiry Date</Text>
                    <View style={[styles.inputWrapper, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                      <MaterialCommunityIcons name="calendar-clock" size={16} color={theme.colors.placeholder} style={{ marginRight: 6 }} />
                      <TextInput
                        value={expiry}
                        onChangeText={(text) => setExpiry(formatDateInput(text))}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={theme.colors.placeholder}
                        keyboardType="numeric"
                        maxLength={10}
                        style={[styles.inputField, { color: theme.colors.text }]}
                      />
                    </View>
                  </View>
                </View>

                <View style={styles.formActionsRow}>
                  <TouchableOpacity
                    onPress={() => {
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      setShowAddForm(false);
                      setRegNo('');
                      setMake('');
                      setModel('');
                      setYear('');
                      setExpiry('');
                    }}
                    style={[styles.cancelFormBtn, { borderColor: theme.colors.border }]}
                  >
                    <Text style={[styles.cancelFormBtnText, { color: theme.colors.text }]}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleAddNewVehicle}
                    disabled={loadingAction === 'add_vehicle'}
                    style={[styles.submitFormBtn, { backgroundColor: theme.colors.secondary }]}
                  >
                    {loadingAction === 'add_vehicle' ? (
                      <ActivityIndicator color={theme.dark ? theme.colors.background : '#FFFFFF'} size="small" />
                    ) : (
                      <Text style={[styles.submitButtonText, { color: theme.dark ? theme.colors.background : '#FFFFFF' }]}>Add Vehicle</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Vehicles Registry */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={[styles.sectionHeading, { color: theme.colors.text, marginBottom: 0 }]}>Your Registered Vehicles</Text>
              <TouchableOpacity
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setShowAddForm(!showAddForm);
                }}
                style={{ padding: 6 }}
              >
                <MaterialCommunityIcons name={showAddForm ? "close" : "plus"} size={22} color={theme.colors.secondary} />
              </TouchableOpacity>
            </View>

            {customerVehicles.length === 0 ? (
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="car-outline" size={48} color={theme.colors.placeholder} style={{ marginBottom: 12 }} />
                <Text style={[styles.emptyText, { color: theme.colors.placeholder }]}>
                  You have no active vehicles registered for MOT reminders.
                </Text>
              </View>
            ) : (
              customerVehicles.map((v) => {
                const bookingAlert = alerts.find((a) => a.type === 'BOOKED' && a.registrationNumber === v.registrationNumber);
                const isBooked = bookingAlert && (bookingAlert.status === 'Pending' || bookingAlert.status === 'Approved');
                const isRejected = bookingAlert && bookingAlert.status === 'Rejected';
                const expiryDateObj = v.motExpiryDate ? new Date(v.motExpiryDate) : null;
                const isExpired = expiryDateObj && !isNaN(expiryDateObj.getTime()) ? expiryDateObj < new Date() : false;
                const motIconColor = isExpired ? theme.colors.error : theme.colors.success;

                return (
                  <View key={v.id} style={[styles.vehicleCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    {/* Header Info */}
                    <View style={styles.vehicleHeader}>
                      <View style={[styles.vehicleIconCircle, { backgroundColor: theme.colors.secondary + '15' }]}>
                        <MaterialCommunityIcons name="car-sports" size={20} color={theme.colors.secondary} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={[styles.makeModelText, { color: theme.colors.text }]} numberOfLines={1}>
                          {v.make} {v.model}
                        </Text>
                        {v.year ? (
                          <Text style={{ fontSize: 11, color: theme.colors.placeholder, marginTop: 1 }}>
                            Year of Manufacture: {v.year}
                          </Text>
                        ) : null}
                      </View>
                      {v.status === 'Pending' && (
                        <View style={[styles.bookedBadge, { backgroundColor: theme.colors.warning + '15', borderColor: theme.colors.warning }]}>
                          <MaterialCommunityIcons name="clock-outline" size={12} color={theme.colors.warning} style={{ marginRight: 2 }} />
                          <Text style={[styles.bookedBadgeText, { color: theme.colors.warning }]}>Pending Approval</Text>
                        </View>
                      )}
                      {v.status === 'Rejected' && (
                        <View style={[styles.bookedBadge, { backgroundColor: theme.colors.error + '15', borderColor: theme.colors.error }]}>
                          <MaterialCommunityIcons name="close-circle" size={12} color={theme.colors.error} style={{ marginRight: 2 }} />
                          <Text style={[styles.bookedBadgeText, { color: theme.colors.error }]}>Rejected</Text>
                        </View>
                      )}
                      {bookingAlert && bookingAlert.status === 'Pending' && (
                        <TouchableOpacity
                          onPress={() => {
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                            setExpandedBookingReg(expandedBookingReg === v.registrationNumber ? null : v.registrationNumber);
                          }}
                          style={[styles.bookedBadge, { backgroundColor: theme.colors.warning + '15', borderColor: theme.colors.warning }]}
                        >
                          <MaterialCommunityIcons name="clock-outline" size={12} color={theme.colors.warning} style={{ marginRight: 2 }} />
                          <Text style={[styles.bookedBadgeText, { color: theme.colors.warning }]}>Pending Approval</Text>
                          <MaterialCommunityIcons 
                            name={expandedBookingReg === v.registrationNumber ? "chevron-up" : "chevron-down"} 
                            size={14} 
                            color={theme.colors.warning} 
                            style={{ marginLeft: 2 }} 
                          />
                        </TouchableOpacity>
                      )}
                      {bookingAlert && bookingAlert.status === 'Approved' && (
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
                      {isRejected && (
                        <TouchableOpacity
                          onPress={() => {
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                            setExpandedBookingReg(expandedBookingReg === v.registrationNumber ? null : v.registrationNumber);
                          }}
                          style={[styles.bookedBadge, { backgroundColor: theme.colors.error + '15', borderColor: theme.colors.error }]}
                        >
                          <MaterialCommunityIcons name="close-circle" size={12} color={theme.colors.error} style={{ marginRight: 2 }} />
                          <Text style={[styles.bookedBadgeText, { color: theme.colors.error }]}>Rejected</Text>
                          <MaterialCommunityIcons 
                            name={expandedBookingReg === v.registrationNumber ? "chevron-up" : "chevron-down"} 
                            size={14} 
                            color={theme.colors.error} 
                            style={{ marginLeft: 2 }} 
                          />
                        </TouchableOpacity>
                      )}
                    </View>

                    <View style={styles.vehicleBody}>
                      <View style={[styles.infoRow, { justifyContent: 'flex-start', alignItems: 'center' }]}>
                        <MaterialCommunityIcons name="card-text-outline" size={16} color={theme.colors.placeholder} style={{ marginRight: 6 }} />
                        <Text style={{ color: theme.colors.placeholder, fontSize: 13, marginRight: 8 }}>Registration Number:</Text>
                        <View style={styles.smallPlate}>
                          <Text style={styles.smallPlateText}>{v.registrationNumber}</Text>
                        </View>
                      </View>
                      
                      <View style={[styles.infoRow, { marginTop: 8, justifyContent: 'flex-start', alignItems: 'center' }]}>
                        <MaterialCommunityIcons 
                          name={isExpired ? "calendar-remove" : "calendar-check"} 
                          size={16} 
                          color={motIconColor} 
                          style={{ marginRight: 6 }} 
                        />
                        <Text style={{ color: theme.colors.placeholder, fontSize: 13 }}>MOT Expiry: </Text>
                        <Text style={{ color: isExpired ? theme.colors.error : theme.colors.text, fontWeight: 'bold', fontSize: 13 }}>
                          {formatShortDate(v.motExpiryDate)}
                        </Text>
                        {isExpired && (
                          <View style={[styles.miniStatusBadge, { backgroundColor: theme.colors.error + '15', marginLeft: 8 }]}>
                            <Text style={{ color: theme.colors.error, fontSize: 9, fontWeight: 'bold' }}>EXPIRED</Text>
                          </View>
                        )}
                      </View>
                      
                      {v.lastServiceDate && (
                        <View style={[styles.infoRow, { marginTop: 8, justifyContent: 'flex-start', alignItems: 'center' }]}>
                          <MaterialCommunityIcons name="wrench-clock" size={16} color={theme.colors.secondary} style={{ marginRight: 6 }} />
                          <Text style={{ color: theme.colors.placeholder, fontSize: 13 }}>Last Service: </Text>
                          <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: '500' }}>{formatShortDate(v.lastServiceDate)}</Text>
                        </View>
                      )}

                      {isBooked && expandedBookingReg === v.registrationNumber && (() => {
                        if (!bookingAlert) return null;
                        
                        return (
                          <View style={[styles.bookingDetailsContainer, { backgroundColor: theme.colors.primaryContainer + '20', borderColor: theme.colors.border }]}>
                            <View style={styles.bookingDetailsHeader}>
                              <MaterialCommunityIcons name="calendar-clock" size={16} color={theme.colors.secondary} style={{ marginRight: 6 }} />
                              <Text style={[styles.bookingDetailsTitle, { color: theme.colors.text }]}>Booking Details</Text>
                            </View>
                            <View style={styles.bookingInfoRow}>
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <MaterialCommunityIcons name="clock-outline" size={14} color={theme.colors.placeholder} style={{ marginRight: 4 }} />
                                <Text style={[styles.bookingInfoLabel, { color: theme.colors.placeholder }]}>Slot/Date:</Text>
                              </View>
                              <Text style={[styles.bookingInfoValue, { color: theme.colors.text }]}>
                                {getBookingSlot(bookingAlert.makeModel)}
                              </Text>
                            </View>
                            <View style={styles.bookingInfoRow}>
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <MaterialCommunityIcons name="information-outline" size={14} color={theme.colors.placeholder} style={{ marginRight: 4 }} />
                                <Text style={[styles.bookingInfoLabel, { color: theme.colors.placeholder }]}>Status:</Text>
                              </View>
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
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <MaterialCommunityIcons name="calendar-month-outline" size={14} color={theme.colors.placeholder} style={{ marginRight: 4 }} />
                                <Text style={[styles.bookingInfoLabel, { color: theme.colors.placeholder }]}>Requested On:</Text>
                              </View>
                              <Text style={[styles.bookingInfoValue, { color: theme.colors.text }]}>
                                {new Date(bookingAlert.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </Text>
                            </View>
                          </View>
                        );
                      })()}

                      {isRejected && expandedBookingReg === v.registrationNumber && (() => {
                        if (!bookingAlert) return null;
                        
                        return (
                          <View style={[styles.bookingDetailsContainer, { backgroundColor: theme.colors.error + '10', borderColor: theme.colors.error }]}>
                            <View style={styles.bookingDetailsHeader}>
                              <MaterialCommunityIcons name="alert-circle" size={16} color={theme.colors.error} style={{ marginRight: 6 }} />
                              <Text style={[styles.bookingDetailsTitle, { color: theme.colors.error, fontWeight: 'bold' }]}>Booking Rejected</Text>
                            </View>
                            <View style={styles.bookingInfoRow}>
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <MaterialCommunityIcons name="clock-outline" size={14} color={theme.colors.placeholder} style={{ marginRight: 4 }} />
                                <Text style={[styles.bookingInfoLabel, { color: theme.colors.placeholder }]}>Slot/Date:</Text>
                              </View>
                              <Text style={[styles.bookingInfoValue, { color: theme.colors.text }]}>
                                {getBookingSlot(bookingAlert.makeModel)}
                              </Text>
                            </View>
                            <View style={styles.bookingInfoRow}>
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <MaterialCommunityIcons name="comment-remove-outline" size={14} color={theme.colors.placeholder} style={{ marginRight: 4 }} />
                                <Text style={[styles.bookingInfoLabel, { color: theme.colors.placeholder }]}>Reason:</Text>
                              </View>
                              <Text style={[styles.bookingInfoValue, { color: theme.colors.error, fontWeight: 'bold', flex: 1, textAlign: 'right' }]}>
                                {bookingAlert.rejectionReason || 'No reason provided.'}
                              </Text>
                            </View>
                            <View style={styles.bookingInfoRow}>
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <MaterialCommunityIcons name="calendar-month-outline" size={14} color={theme.colors.placeholder} style={{ marginRight: 4 }} />
                                <Text style={[styles.bookingInfoLabel, { color: theme.colors.placeholder }]}>Requested On:</Text>
                              </View>
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
                    {v.status === 'Pending' ? (
                      <View style={[styles.pendingApprovalBox, { backgroundColor: theme.colors.warning + '10', borderColor: theme.colors.warning + '30' }]}>
                        <MaterialCommunityIcons name="clock-outline" size={16} color={theme.colors.warning} style={{ marginRight: 6 }} />
                        <Text style={{ color: theme.colors.text, fontSize: 12, fontWeight: 'bold', flex: 1 }}>
                          Awaiting registration approval from garage staff. Booking will be enabled once approved.
                        </Text>
                      </View>
                    ) : v.status === 'Rejected' ? (
                      <View style={[styles.pendingApprovalBox, { backgroundColor: theme.colors.error + '10', borderColor: theme.colors.error + '30', flexDirection: 'column', alignItems: 'flex-start' }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <MaterialCommunityIcons name="close-circle-outline" size={16} color={theme.colors.error} style={{ marginRight: 6 }} />
                          <Text style={{ color: theme.colors.text, fontSize: 12, fontWeight: 'bold', flex: 1 }}>
                            Vehicle registration rejected by garage staff. You cannot book an MOT for this vehicle.
                          </Text>
                        </View>
                        {v.rejectionReason ? (
                          <View style={{ marginTop: 6, paddingLeft: 22 }}>
                            <Text style={{ fontSize: 11, color: theme.colors.error, fontWeight: 'bold' }}>Rejection Reason:</Text>
                            <Text style={{ fontSize: 12, color: theme.colors.text, marginTop: 2 }}>{v.rejectionReason}</Text>
                          </View>
                        ) : null}
                      </View>
                    ) : bookingAlert && bookingAlert.status === 'Pending' ? (
                      <View style={[styles.pendingApprovalBox, { backgroundColor: theme.colors.warning + '10', borderColor: theme.colors.warning + '30' }]}>
                        <MaterialCommunityIcons name="clock-outline" size={16} color={theme.colors.warning} style={{ marginRight: 6 }} />
                        <Text style={{ color: theme.colors.text, fontSize: 12, fontWeight: 'bold', flex: 1 }}>
                          Awaiting MOT booking approval from garage staff. Rescheduling/Cancellation will be enabled once confirmed.
                        </Text>
                      </View>
                    ) : (
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
                              <MaterialCommunityIcons 
                                name="calendar-edit" 
                                size={16} 
                                color={theme.dark ? theme.colors.background : '#FFFFFF'} 
                                style={{ marginRight: 4 }} 
                              />
                              <Text style={[styles.actionBtnText, { color: theme.dark ? theme.colors.background : '#FFFFFF' }]}>Reschedule</Text>
                            </View>
                          </TouchableOpacity>
                        ) : (() => {
                          const daysLeft = getDaysUntilExpiry(v.motExpiryDate);
                          const isBookable = daysLeft <= 30;
                          return (
                            <TouchableOpacity
                              onPress={() => {
                                if (isBookable) {
                                  handleBookMOT(v);
                                } else {
                                  Alert.alert(
                                    'Booking Restriction',
                                    `You can only book an MOT test when your vehicle is within 30 days of its expiry date. (${daysLeft} days remaining).`
                                  );
                                }
                              }}
                              disabled={loadingAction !== null}
                              style={[
                                styles.actionBtn, 
                                styles.bookBtn, 
                                { backgroundColor: isBookable ? theme.colors.secondary : theme.colors.placeholder + '40' }
                              ]}
                            >
                              <View style={styles.actionBtnContent}>
                                <MaterialCommunityIcons 
                                  name={isBookable ? "calendar-plus" : "calendar-lock"} 
                                  size={16} 
                                  color={isBookable ? (theme.dark ? theme.colors.background : '#FFFFFF') : theme.colors.placeholder} 
                                  style={{ marginRight: 4 }} 
                                />
                                <Text style={[styles.actionBtnText, { color: isBookable ? (theme.dark ? theme.colors.background : '#FFFFFF') : theme.colors.placeholder }]}>
                                  {isBookable ? 'Book MOT' : 'Locked'}
                                </Text>
                              </View>
                            </TouchableOpacity>
                          );
                        })()}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>
        )}

        {activeTab === 'motHistory' && (
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.welcomeBlock}>
              <Text style={[styles.welcomeTitle, { color: theme.colors.text }]}>
                Live MOT History Check
              </Text>
              <Text style={[styles.welcomeSubtitle, { color: theme.colors.placeholder }]}>
                Select one of your registered vehicles to query its full official MOT history from the live registry.
              </Text>
            </View>

            {customerVehicles.length === 0 ? (
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="car-outline" size={48} color={theme.colors.placeholder} style={{ marginBottom: 12 }} />
                <Text style={[styles.emptyText, { color: theme.colors.placeholder }]}>
                  You have no active vehicles registered.
                </Text>
              </View>
            ) : (
              customerVehicles.map((v) => {
                const vehicleId = v.id || v._id || v.registrationNumber;
                return (
                  <TouchableOpacity
                    key={vehicleId}
                    onPress={() => navigation.navigate('MotHistory', { registration: v.registrationNumber })}
                    style={[
                      styles.vehicleCard,
                      {
                        backgroundColor: theme.colors.card,
                        borderColor: theme.colors.border,
                        padding: 14,
                        elevation: 2,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1.5 },
                        shadowOpacity: 0.05,
                        shadowRadius: 3,
                      }
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <View style={[styles.vehicleIconCircle, { backgroundColor: theme.colors.primary + '15', width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' }]}>
                          <MaterialCommunityIcons name="car-cog" size={22} color={theme.colors.primary} />
                        </View>
                        
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={{ fontSize: 15, fontWeight: 'bold', color: theme.colors.text }} numberOfLines={1}>
                            {v.make} {v.model}
                          </Text>
                          
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                            {/* License Plate Style */}
                            <View style={{
                              flexDirection: 'row',
                              backgroundColor: '#FFD300',
                              borderWidth: 1,
                              borderColor: '#000000',
                              borderRadius: 4,
                              paddingHorizontal: 6,
                              paddingVertical: 1.5,
                              alignItems: 'center',
                              marginRight: 8
                            }}>
                              <View style={{ width: 3.5, height: '100%', backgroundColor: '#0A4E9B', marginRight: 4, borderRadius: 0.5 }} />
                              <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#000000', letterSpacing: 0.5 }}>
                                {v.registrationNumber}
                              </Text>
                            </View>
                            
                            {v.year ? (
                              <Text style={{ fontSize: 12, color: theme.colors.placeholder }}>
                                Year: {v.year}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      </View>

                      {/* Chevron indicator */}
                      <View style={{ 
                        width: 28, 
                        height: 28, 
                        borderRadius: 14, 
                        backgroundColor: theme.colors.primary + '10', 
                        justifyContent: 'center', 
                        alignItems: 'center',
                        marginLeft: 6
                      }}>
                        <MaterialCommunityIcons name="chevron-right" size={18} color={theme.colors.primary} />
                      </View>
                    </View>

                    {/* Bottom Info Section if MOT Expiry exists */}
                    {v.motExpiryDate && (
                      <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: 10,
                        paddingTop: 10,
                        borderTopWidth: 0.5,
                        borderTopColor: theme.colors.border
                      }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <MaterialCommunityIcons name="calendar-range" size={13} color={theme.colors.placeholder} style={{ marginRight: 5 }} />
                          <Text style={{ fontSize: 11, color: theme.colors.placeholder }}>
                            MOT Expiry: {new Date(v.motExpiryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </Text>
                        </View>
                        
                        <View style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: theme.colors.success + '12',
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: 10
                        }}>
                          <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: theme.colors.success, marginRight: 5 }} />
                          <Text style={{ fontSize: 9, fontWeight: 'bold', color: theme.colors.success }}>
                            Active
                          </Text>
                        </View>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        )}

        {activeTab === 'history' && (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* <Text style={[styles.sectionHeading, { color: theme.colors.text, marginBottom: 16 }]}>MOT Booking History</Text> */}
            {alerts.filter((a) => a.type === 'BOOKED' && a.customerId && (
              String(a.customerId).toLowerCase() === String(customer.id || '').toLowerCase() ||
              String(a.customerId).toLowerCase() === String(customer._id || '').toLowerCase()
            ) && customerVehicles.some(v => v.registrationNumber.toUpperCase() === a.registrationNumber.toUpperCase())).length === 0 ? (
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="history" size={48} color={theme.colors.placeholder} style={{ marginBottom: 12 }} />
                <Text style={[styles.emptyText, { color: theme.colors.placeholder }]}>
                  No booking history found.
                </Text>
              </View>
            ) : (
              alerts
                .filter((a) => a.type === 'BOOKED' && a.customerId && (
                  String(a.customerId).toLowerCase() === String(customer.id || '').toLowerCase() ||
                  String(a.customerId).toLowerCase() === String(customer._id || '').toLowerCase()
                ) && customerVehicles.some(v => v.registrationNumber.toUpperCase() === a.registrationNumber.toUpperCase()))
                .map((item) => {
                  const isPending = item.status === 'Pending';
                  const isApproved = item.status === 'Approved';
                  const isRejected = item.status === 'Rejected';

                  let statusText = 'Completed';
                  let statusColor = theme.colors.placeholder;
                  let statusBg = theme.colors.border + '30';

                  if (isPending) {
                    statusText = 'Pending';
                    statusColor = theme.colors.warning;
                    statusBg = theme.colors.warning + '15';
                  } else if (isApproved) {
                    statusText = 'Confirmed';
                    statusColor = theme.colors.success;
                    statusBg = theme.colors.success + '15';
                  } else if (isRejected) {
                    statusText = 'Rejected';
                    statusColor = theme.colors.error;
                    statusBg = theme.colors.error + '15';
                  }

                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.historyCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                      onPress={() => navigation.navigate('MotHistory', { registration: item.registrationNumber })}
                    >
                      <View style={styles.historyCardHeader}>
                        <View style={styles.smallPlate}>
                          <Text style={styles.smallPlateText}>{item.registrationNumber}</Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: statusBg, borderColor: statusColor + '40', flexDirection: 'row', alignItems: 'center', borderWidth: 0.5 }]}>
                          <MaterialCommunityIcons 
                            name={isPending ? 'clock-outline' : isApproved ? 'check-circle' : isRejected ? 'close-circle' : 'checkbox-marked-circle'} 
                            size={12} 
                            color={statusColor} 
                            style={{ marginRight: 4 }} 
                          />
                          <Text style={[styles.statusText, { color: statusColor, fontSize: 10 }]}>{statusText}</Text>
                        </View>
                      </View>

                      <View style={styles.historyCardBody}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                          <MaterialCommunityIcons name="car-sports" size={18} color={theme.colors.secondary} style={{ marginRight: 6 }} />
                          <Text style={[styles.historyVehicleText, { color: theme.colors.text }]}>
                            {item.makeModel.split(' - Slot: ')[0]}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                          <MaterialCommunityIcons name="calendar-clock" size={14} color={theme.colors.placeholder} style={{ marginRight: 4 }} />
                          <Text style={{ fontSize: 13, color: theme.colors.text }}>
                            Slot: {getBookingSlot(item.makeModel)}
                          </Text>
                        </View>

                        {item.rescheduled && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                            <MaterialCommunityIcons name="clock-alert-outline" size={12} color={theme.colors.primary} style={{ marginRight: 4 }} />
                            <Text style={{ fontSize: 11, fontWeight: 'bold', color: theme.colors.primary }}>Rescheduled</Text>
                          </View>
                        )}

                        {isRejected && (
                          <View style={[styles.rejectionReasonBox, { backgroundColor: theme.colors.error + '10', borderColor: theme.colors.error }]}>
                            <Text style={{ fontSize: 11, color: theme.colors.error, fontWeight: 'bold' }}>Rejection Reason:</Text>
                            <Text style={{ fontSize: 12, color: theme.colors.text, marginTop: 2 }}>
                              {item.rejectionReason || 'No reason provided.'}
                            </Text>
                          </View>
                        )}
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 }}>
                        <MaterialCommunityIcons name="clock-outline" size={12} color={theme.colors.placeholder} style={{ marginRight: 4 }} />
                        <Text style={[styles.historyDate, { color: theme.colors.placeholder }]}>
                          Requested: {new Date(item.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
            )}
          </ScrollView>
        )}

      </View>
    </View>
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
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'left',
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
    padding: 12,
    paddingBottom: 24,
  },
  welcomeBlock: {
    marginBottom: 12,
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  formCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  formTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  formRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 3,
  },
  input: {
    height: 34,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    fontSize: 12,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 6,
    height: 34,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  inputField: {
    flex: 1,
    height: '100%',
    fontSize: 12,
    paddingVertical: 0,
  },
  submitButton: {
    height: 36,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  formActionsRow: {
    flexDirection: 'row',
    marginTop: 6,
    gap: 10,
  },
  cancelFormBtn: {
    flex: 1,
    height: 36,
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelFormBtnText: {
    fontWeight: 'bold',
    fontSize: 12,
  },
  submitFormBtn: {
    flex: 1.5,
    height: 36,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 18,
  },
  vehicleCard: {
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
  },
  vehicleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    paddingBottom: 6,
  },
  vehicleIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plate: {
    backgroundColor: '#FFD300',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 8,
  },
  plateText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  makeModelText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  vehicleBody: {
    paddingHorizontal: 10,
    paddingBottom: 10,
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
    padding: 8,
  },
  actionBtn: {
    flex: 1,
    height: 30,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 3,
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
    fontSize: 11,
    fontWeight: 'bold',
  },
  bookedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
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
  footer: {
    flexDirection: 'row',
    height: 56,
    borderTopWidth: 1,
    paddingBottom: 4,
    paddingTop: 6,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  historyCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusBadge: {
    borderWidth: 0.5,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  statusText: {
    fontWeight: 'bold',
  },
  historyCardBody: {
    marginBottom: 8,
  },
  historyVehicleText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  rejectionReasonBox: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 6,
    padding: 8,
  },
  historyDate: {
    fontSize: 10,
    textAlign: 'right',
  },
  profileHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  profileSectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  contactPillRow: {
    flexDirection: 'row',
    gap: 6,
  },
  contactPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  contactPillText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    flexShrink: 1,
  },
  profileInfoCard: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 2,
    marginBottom: 20,
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  profileLogoutBtn: {
    height: 46,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    // elevation: 1,
    marginBottom: 24,
  },
  pendingApprovalBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginHorizontal: 12,
    marginVertical: 8,
  },
  segmentContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    height: 40,
  },
  segmentButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
  },
  segmentText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  statCard: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginHorizontal: 4,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.05,
    shadowRadius: 2.5,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    marginTop: 4,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '900',
    marginTop: 2,
    textAlign: 'center',
  },
  statSubtext: {
    fontSize: 9,
    marginTop: 1,
    textAlign: 'center',
    fontWeight: '600',
  },
  notificationAlertBox: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  notificationAlertText: {
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
    marginLeft: 8,
    lineHeight: 14,
  },
  notificationDismissBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  notificationDismissText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
});
