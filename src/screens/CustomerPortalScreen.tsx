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
import { validateNewVehicleForm, VEHICLE_DROPDOWN_FORM_MESSAGES } from '../utils/validationUtils';
import { useModelAvailability } from '../hooks/useModelAvailability';
import { openGarageDirections } from '../utils/mapUtils';
import Toast from 'react-native-toast-message';
import CustomerHeader from '../components/CustomerHeader';
import { fonts } from '../theme/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function CustomerPortalScreen({ route, navigation }: any) {
  const { isDarkMode, theme, toggleTheme } = useAppTheme();
  const { customers, vehicles, alerts, addAlert, addVehicle, addAudit, updateVehicleStatus, lookupVehicle, refreshData, setToken, setUser, token, user } = useAppValues();

  // Find active customer
  const customerId = route?.params?.customerId || user?.customerId;
  const customer = customers.find((c) => 
    (customerId && (
      String(c.id).toLowerCase() === String(customerId).toLowerCase() ||
      String(c._id).toLowerCase() === String(customerId).toLowerCase()
    ))
  ) || customers[0] || {
    id: customerId,
    _id: customerId,
    firstName: user?.name?.split(' ')[0] || 'Customer',
    lastName: user?.name?.split(' ').slice(1).join(' ') || '',
    email: user?.email || '',
    mobile: '',
  };

  if (!token) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <MaterialCommunityIcons name="account-lock-outline" size={72} color={theme.colors.placeholder} style={{ marginBottom: 16 }} />
        <Text style={{ fontSize: 20, fontFamily: fonts.bold, color: theme.colors.text, marginBottom: 8, textAlign: 'center' }}>
          Access Customer Portal
        </Text>
        <Text style={{ fontSize: 13, fontFamily: fonts.regular, color: theme.colors.placeholder, textAlign: 'center', marginBottom: 24, paddingHorizontal: 20, lineHeight: 18 }}>
          Please sign in to view and manage your registered vehicles, check histories, and book new service appointments.
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
      </SafeAreaView>
    );
  }

  // Active customer vehicles
  const customerVehicles = vehicles.filter((v) => 
    v.customerId && (
      String(v.customerId).toLowerCase() === String(customer.id || '').toLowerCase() ||
      String(v.customerId).toLowerCase() === String(customer._id || '').toLowerCase()
    ) && v.status !== 'Sold' && v.status !== 'Scrapped' && v.status !== 'Rejected'
  );

  const getDaysUntilExpiry = (expiryDateStr?: string) => {
    if (!expiryDateStr) return -1;
    const expiryDate = new Date(expiryDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = expiryDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };




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
  // Per-field errors from the last Add Vehicle attempt - drives the red borders on the form
  const [vehicleErrors, setVehicleErrors] = useState<Record<string, string>>({});
  const clearVehicleError = (field: string) =>
    setVehicleErrors(prev => (prev[field] ? { ...prev, [field]: '' } : prev));
  useEffect(() => {
    if (!showAddForm) setVehicleErrors({});
  }, [showAddForm]);

  // Whether the selected make has models (decides if Model is required) + the Model dropdown's loader
  const { availability: modelAvailability, fetchModels } = useModelAvailability(make, BASE_URL, token);
  const [isSearchingPlate, setIsSearchingPlate] = useState(false);
  const [lookupSuccessInfo, setLookupSuccessInfo] = useState<string | null>(null);


  const handleLookupPlate = async () => {
    const vrnClean = regNo.trim().toUpperCase().replace(/\s+/g, '');
    if (!vrnClean) {
      Alert.alert('Registration Required', 'Please enter a vehicle registration number to look up.');
      return;
    }

    setIsSearchingPlate(true);
    setLookupSuccessInfo(null);

    try {
      const res = await lookupVehicle(vrnClean);
      if (res && res.found && res.vehicle) {
        const v = res.vehicle;
        setMake(v.make || '');
        setModel(v.model || '');
        setYear(v.year ? String(v.year) : '');
        setExpiry(v.motExpiryDate || '');
        setVehicleErrors({});
        const infoStr = `${v.make} ${v.model}${v.year ? ` (${v.year})` : ''}`;
        setLookupSuccessInfo(infoStr);

        Toast.show({
          type: 'success',
          text1: 'Vehicle Found on DVSA',
          text2: `${v.make} ${v.model} details autofilled!`,
        });
      } else {
        Alert.alert(
          'Vehicle Not Found',
          `No vehicle details found for "${regNo.trim().toUpperCase()}" in the DVSA database.\n\nPlease check the registration plate number or fill the details manually.`
        );
      }
    } catch (err: any) {
      console.error('[CustomerPortalScreen] lookup error:', err);
      const isBusy = err.isBusy || (err.message && (
        err.message.toLowerCase().includes('busy') ||
        err.message.toLowerCase().includes('taking too long')
      ));
      if (isBusy) {
        Alert.alert('Government API Busy', 'Government DVSA API is busy, please check again.');
      } else {
        Alert.alert(
          'Vehicle Not Found',
          'Vehicle details not found. Please check the registration plate or enter the vehicle details manually.'
        );
      }
    } finally {
      setIsSearchingPlate(false);
    }
  };

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

  const handleMarkAsSold = (vehicleId: string, reg: string, makeModel: string) => {
    const actionId = `sold_${vehicleId}`;
    
    Alert.alert(
      'Confirm Vehicle Sold',
      `Are you sure you want to mark your ${makeModel} (${reg}) as sold? Future service reminders will be stopped.`,
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
    // Field-by-field validation: names only the fields that are actually missing or invalid
    const vehicleCheck = validateNewVehicleForm(
      { registration: regNo, make, model, year, motExpiry: expiry },
      {
        modelAvailability,
        missingMessages: VEHICLE_DROPDOWN_FORM_MESSAGES,
      }
    );
    setVehicleErrors(vehicleCheck.errors);
    if (!vehicleCheck.isValid) {
      Alert.alert(vehicleCheck.title, vehicleCheck.message);
      return;
    }

    if (!token || !token.trim()) {
      Alert.alert(
        'Sign In Required',
        'Please sign in to your account to add a vehicle.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => navigation.navigate('Login') },
        ]
      );
      return;
    }

    setLoadingAction('add_vehicle');
    try {
      const targetCustId = customer.id || customer._id || user?.customerId || '';

      const cleaned = vehicleCheck.values;

      // 1. Create the vehicle in the database with Active status
      // (model may be blank only for a make with no models - the backend re-checks this)
      await addVehicle({
        customerId: targetCustId,
        registrationNumber: cleaned.registration,
        make: cleaned.make,
        model: cleaned.model,
        year: cleaned.year,
        motExpiryDate: cleaned.motExpiry,
        status: 'Active'
      });

      // 2. Send informational alert for vehicle registration
      await addAlert({
        type: 'NEW_VEHICLE',
        customerName: `${customer.firstName} ${customer.lastName}`,
        customerId: targetCustId,
        customerEmail: customer.email || user?.email || '',
        customerMobile: customer.mobile || '',
        registrationNumber: cleaned.registration,
        makeModel: `${cleaned.make} ${cleaned.model}`.trim(),
        status: 'Approved'
      });

      await addAudit(
        'New Vehicle Registered', 
        `${customer.firstName} ${customer.lastName} added vehicle ${cleaned.make} (${cleaned.registration}) - active immediately`
      );

      setLoadingAction(null);

      // Reset
      setRegNo('');
      setMake('');
      setModel('');
      setYear('');
      setExpiry('');
      setLookupSuccessInfo(null);
      setShowAddForm(false);

      Alert.alert(
        'Vehicle Added',
        'Your vehicle has been added successfully! You can now book service appointments and manage reminders.'
      );
    } catch (error: any) {
      setLoadingAction(null);
      console.error('[PORTAL] handleAddNewVehicle error:', error);
      const isAuthError = !token || (error?.message && (
        error.message.toLowerCase().includes('token') ||
        error.message.toLowerCase().includes('sign in') ||
        error.message.toLowerCase().includes('unauthorized') ||
        error.message.toLowerCase().includes('auth')
      ));
      if (isAuthError) {
        Alert.alert(
          'Sign In Required',
          'Please sign in to your account to add a vehicle.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign In', onPress: () => navigation.navigate('Login') },
          ]
        );
      } else {
        Alert.alert('Registration Failed', error?.message || 'Could not register vehicle. Please verify registration plate is unique.');
      }
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Customer Header with Great UI */}
      <CustomerHeader
        title="My Vehicles"
        subtitle="Registered Cars & Service Reminders"
        iconName="car-multiple"
        iconColor={theme.colors.secondary}
        iconBg={theme.colors.secondary + '15'}
      />

      {/* Vehicles Content */}
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">



            {/* Add Vehicle Button & Collapsible Form */}
            {showAddForm && (
              <View style={[styles.formCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <Text style={[styles.formTitle, { color: theme.colors.text }]}>Register New Vehicle</Text>
                
                <Text style={[styles.label, { color: theme.colors.text }]}>UK Registration Number</Text>
                {/* UK Plate Input & Lookup Row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: lookupSuccessInfo || vehicleErrors.registration ? 8 : 12 }}>
                  <View style={{ flexDirection: 'row', flex: 1, height: 42, backgroundColor: '#FFD300', borderWidth: vehicleErrors.registration ? 2 : 1.5, borderColor: vehicleErrors.registration ? theme.colors.error : '#000000', borderRadius: 8, overflow: 'hidden', alignItems: 'center' }}>
                    <View style={{ width: 32, height: '100%', backgroundColor: '#0A4E9B', justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ color: '#FFFFFF', fontFamily: fonts.bold, fontSize: 10 }}>UK</Text>
                    </View>
                    <TextInput
                      value={regNo}
                      onChangeText={(txt) => {
                        setRegNo(txt.toUpperCase());
                        clearVehicleError('registration');
                        if (lookupSuccessInfo) setLookupSuccessInfo(null);
                      }}
                      placeholder="eg AB19 CDE"
                      placeholderTextColor="#777777"
                      autoCapitalize="characters"
                      maxLength={9}
                      style={{ flex: 1, fontSize: 14, fontFamily: fonts.bold, color: '#000000', textAlign: 'center', height: '100%', padding: 0 }}
                    />
                  </View>
                  <TouchableOpacity
                    onPress={handleLookupPlate}
                    disabled={isSearchingPlate}
                    style={{ marginLeft: 8, height: 42, paddingHorizontal: 14, backgroundColor: theme.colors.primary, borderRadius: 8, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', elevation: 2 }}
                    activeOpacity={0.8}
                  >
                    {isSearchingPlate ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="magnify" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                        <Text style={{ color: '#FFFFFF', fontFamily: fonts.bold, fontSize: 12 }}>LOOKUP</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
                {vehicleErrors.registration ? (
                  <Text style={[styles.fieldErrorText, { color: theme.colors.error, marginTop: -4, marginBottom: 8 }]}>{vehicleErrors.registration}</Text>
                ) : null}

                {/* Lookup Success Banner */}
                {lookupSuccessInfo && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B98115', borderColor: '#10B98150', borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 12 }}>
                    <MaterialCommunityIcons name="check-decagram" size={16} color="#10B981" style={{ marginRight: 6 }} />
                    <Text style={{ fontSize: 11, color: '#10B981', fontFamily: fonts.semiBold, flex: 1 }}>
                      DVSA Verified: Autofilled details for {lookupSuccessInfo}
                    </Text>
                  </View>
                )}

                <View style={styles.formRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[styles.label, { color: theme.colors.text }]}>Make</Text>
                    <SearchableDropdown
                      placeholder="Make"
                      selectedValue={make}
                      onValueChange={(val) => {
                        setMake(val);
                        // A model from the previous make must never be submitted with the new one
                        setModel('');
                        clearVehicleError('make');
                        clearVehicleError('model');
                      }}
                      fetchItems={fetchMakesList}
                      hasError={!!vehicleErrors.make}
                    />
                    {vehicleErrors.make ? (
                      <Text style={[styles.fieldErrorText, { color: theme.colors.error }]}>{vehicleErrors.make}</Text>
                    ) : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: theme.colors.text }]}>Model</Text>
                    <SearchableDropdown
                      placeholder="Model"
                      selectedValue={model}
                      onValueChange={(val) => {
                        setModel(val);
                        clearVehicleError('model');
                      }}
                      fetchItems={fetchModels}
                      disabled={!make}
                      hasError={!!vehicleErrors.model}
                      emptyText={
                        modelAvailability === 'none'
                          ? `No models are listed for ${make}. You can add this vehicle without a model.`
                          : undefined
                      }
                    />
                    {vehicleErrors.model ? (
                      <Text style={[styles.fieldErrorText, { color: theme.colors.error }]}>{vehicleErrors.model}</Text>
                    ) : modelAvailability === 'none' ? (
                      <Text style={[styles.fieldErrorText, { color: theme.colors.placeholder }]}>No models listed - optional</Text>
                    ) : modelAvailability === 'error' ? (
                      <Text style={[styles.fieldErrorText, { color: theme.colors.error }]}>Couldn't load models - tap to retry</Text>
                    ) : null}
                  </View>
                </View>

                <View style={styles.formRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[styles.label, { color: theme.colors.text }]}>Year</Text>
                    <View style={[styles.inputWrapper, { borderColor: vehicleErrors.year ? theme.colors.error : theme.colors.border, backgroundColor: theme.colors.background }]}>
                      <MaterialCommunityIcons name="calendar-outline" size={16} color={theme.colors.placeholder} style={{ marginRight: 6 }} />
                      <TextInput
                        value={year}
                        onChangeText={(t) => { setYear(t); clearVehicleError('year'); }}
                        placeholder="E.g. 2018"
                        placeholderTextColor={theme.colors.placeholder}
                        keyboardType="numeric"
                        maxLength={4}
                        style={[styles.inputField, { color: theme.colors.text }]}
                      />
                    </View>
                    {vehicleErrors.year ? (
                      <Text style={[styles.fieldErrorText, { color: theme.colors.error }]}>{vehicleErrors.year}</Text>
                    ) : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: theme.colors.text }]}>MOT Expiry Date</Text>
                    <View style={[styles.inputWrapper, { borderColor: vehicleErrors.motExpiry ? theme.colors.error : theme.colors.border, backgroundColor: theme.colors.background }]}>
                      <MaterialCommunityIcons name="calendar-clock" size={16} color={theme.colors.placeholder} style={{ marginRight: 6 }} />
                      <TextInput
                        value={expiry}
                        onChangeText={(text) => { setExpiry(formatDateInput(text)); clearVehicleError('motExpiry'); }}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={theme.colors.placeholder}
                        keyboardType="numeric"
                        maxLength={10}
                        style={[styles.inputField, { color: theme.colors.text }]}
                      />
                    </View>
                    {vehicleErrors.motExpiry ? (
                      <Text style={[styles.fieldErrorText, { color: theme.colors.error }]}>{vehicleErrors.motExpiry}</Text>
                    ) : null}
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
                      setLookupSuccessInfo(null);
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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={[styles.sectionHeading, { color: theme.colors.text, marginBottom: 0 }]}>Your Registered Vehicles</Text>
              <TouchableOpacity
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setShowAddForm(!showAddForm);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: theme.colors.secondary,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 6,
                }}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name={showAddForm ? 'close' : 'plus'} size={15} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={{ color: '#FFFFFF', fontSize: 11.5, fontFamily: fonts.bold }}>
                  {showAddForm ? 'Close' : 'Add Vehicle'}
                </Text>
              </TouchableOpacity>
            </View>

            {customerVehicles.length === 0 ? (
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="car-outline" size={48} color={theme.colors.placeholder} style={{ marginBottom: 12 }} />
                <Text style={[styles.emptyText, { color: theme.colors.placeholder }]}>
                  You have no active vehicles registered for service reminders.
                </Text>
              </View>
            ) : (
              customerVehicles.map((v) => {
                const expiryDateObj = v.motExpiryDate ? new Date(v.motExpiryDate) : null;
                const isExpired = expiryDateObj && !isNaN(expiryDateObj.getTime()) ? expiryDateObj < new Date() : false;
                const motIconColor = isExpired ? theme.colors.error : theme.colors.success;
                const daysLeft = getDaysUntilExpiry(v.motExpiryDate);

                return (
                  <View key={v.id} style={[styles.vehicleCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    {/* Header Info */}
                    <View style={styles.vehicleHeader}>
                      <View style={[styles.vehicleIconCircle, { backgroundColor: theme.colors.secondary + '15' }]}>
                        <MaterialCommunityIcons name="car-sports" size={16} color={theme.colors.secondary} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 8, marginRight: 6 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                          <Text style={[styles.makeModelText, { color: theme.colors.text }]} numberOfLines={1}>
                            {v.make} {v.model}
                          </Text>
                          {v.year ? (
                            <Text style={{ fontSize: 11, color: theme.colors.placeholder, marginLeft: 4, fontFamily: fonts.regular }}>
                              • {v.year}
                            </Text>
                          ) : null}
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                          <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => navigation.navigate('MotHistory', { registration: v.registrationNumber })}
                            style={styles.smallPlate}
                          >
                            <Text style={styles.smallPlateText}>{v.registrationNumber}</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      {v.status === 'Pending' && (
                        <View style={[styles.bookedBadge, { backgroundColor: theme.colors.warning + '15', borderColor: theme.colors.warning }]}>
                          <MaterialCommunityIcons name="clock-outline" size={11} color={theme.colors.warning} style={{ marginRight: 2 }} />
                          <Text style={[styles.bookedBadgeText, { color: theme.colors.warning }]}>Pending</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.vehicleBody}>
                      <View style={[styles.infoRow, { alignItems: 'center' }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, flexWrap: 'wrap' }}>
                          <MaterialCommunityIcons 
                            name={isExpired ? "calendar-remove" : "calendar-check"} 
                            size={13} 
                            color={motIconColor} 
                            style={{ marginRight: 3 }} 
                          />
                          <Text style={{ color: theme.colors.placeholder, fontSize: 11.5, fontFamily: fonts.regular }}>MOT: </Text>
                          <Text style={{ color: isExpired ? theme.colors.error : theme.colors.text, fontFamily: fonts.bold, fontSize: 11.5 }}>
                            {formatShortDate(v.motExpiryDate)}
                          </Text>
                          {v.motExpiryDate && (
                            <Text style={{ color: isExpired ? theme.colors.error : daysLeft <= 30 ? theme.colors.warning : theme.colors.placeholder, fontSize: 11, marginLeft: 3, fontFamily: fonts.semiBold }}>
                              ({daysLeft >= 0 ? `${daysLeft}d left` : `${Math.abs(daysLeft)}d ago`})
                            </Text>
                          )}
                          {isExpired && (
                            <View style={[styles.miniStatusBadge, { backgroundColor: theme.colors.error + '15', marginLeft: 5 }]}>
                              <Text style={{ color: theme.colors.error, fontSize: 8.5, fontFamily: fonts.bold }}>EXPIRED</Text>
                            </View>
                          )}
                        </View>

                        {v.lastServiceDate && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 6 }}>
                            <MaterialCommunityIcons name="wrench-clock" size={13} color={theme.colors.secondary} style={{ marginRight: 3 }} />
                            <Text style={{ color: theme.colors.placeholder, fontSize: 11, fontFamily: fonts.regular }}>Svc: </Text>
                            <Text style={{ color: theme.colors.text, fontSize: 11, fontFamily: fonts.medium }}>{formatShortDate(v.lastServiceDate)}</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Action Buttons */}
                    {v.status === 'Pending' ? (
                      <View style={{ borderTopWidth: 0.5, borderTopColor: theme.colors.border }}>
                        <View style={[styles.pendingApprovalBox, { backgroundColor: theme.colors.warning + '10', borderColor: theme.colors.warning + '30', marginHorizontal: 8, marginTop: 5, marginBottom: 4 }]}>
                          <MaterialCommunityIcons name="clock-outline" size={14} color={theme.colors.warning} style={{ marginRight: 5 }} />
                          <Text style={{ color: theme.colors.text, fontSize: 11, fontFamily: fonts.bold, flex: 1 }}>
                            Awaiting registration approval from garage staff.
                          </Text>
                        </View>
                        <View style={[styles.actionRow, { borderTopWidth: 0, paddingTop: 0, paddingBottom: 6 }]}>
                          <TouchableOpacity
                            onPress={() => navigation.navigate('MotHistory', { registration: v.registrationNumber })}
                            style={[
                              styles.actionBtn, 
                              { 
                                borderColor: theme.colors.primary, 
                                borderWidth: 1, 
                                backgroundColor: theme.colors.primary + '10' 
                              }
                            ]}
                          >
                            <View style={styles.actionBtnContent}>
                              <MaterialCommunityIcons name="history" size={14} color={theme.colors.primary} style={{ marginRight: 4 }} />
                              <Text style={[styles.actionBtnText, { color: theme.colors.primary }]}>Vehicle & MOT History</Text>
                            </View>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <View style={{ borderTopWidth: 0.5, borderTopColor: theme.colors.border }}>
                        <View style={[styles.actionRow, { borderTopWidth: 0 }]}>
                          <TouchableOpacity
                            onPress={() => navigation.navigate('MotHistory', { registration: v.registrationNumber })}
                            style={[
                              styles.actionBtn, 
                              { 
                                borderColor: theme.colors.primary, 
                                borderWidth: 1, 
                                backgroundColor: theme.colors.primary + '10' 
                              }
                            ]}
                          >
                            <View style={styles.actionBtnContent}>
                              <MaterialCommunityIcons name="history" size={14} color={theme.colors.primary} style={{ marginRight: 4 }} />
                              <Text style={[styles.actionBtnText, { color: theme.colors.primary }]}>Vehicle & MOT History</Text>
                            </View>
                          </TouchableOpacity>


                          <TouchableOpacity
                            onPress={() => handleMarkAsSold(v.id, v.registrationNumber, `${v.make} ${v.model}`)}
                            disabled={loadingAction !== null}
                            style={[styles.actionBtn, styles.soldBtn, { borderColor: theme.colors.border }]}
                          >
                            {loadingAction === `sold_${v.id}` ? (
                              <ActivityIndicator size="small" color={theme.colors.error} />
                            ) : (
                              <View style={styles.actionBtnContent}>
                                <MaterialCommunityIcons name="car-off" size={14} color={theme.colors.error} style={{ marginRight: 4 }} />
                                <Text style={[styles.actionBtnText, { color: theme.colors.error }]}>Mark Sold</Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>
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
    fontFamily: fonts.bold,
    fontSize: 13,
    marginLeft: 4,
  },
  navTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
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
    padding: 10,
    paddingBottom: 20,
  },
  sectionHeading: {
    fontFamily: fonts.bold,
    fontSize: 13,
    marginBottom: 8,
  },
  formCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  formTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    marginBottom: 8,
  },
  formRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  fieldErrorText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    marginTop: 4,
  },
  label: {
    fontFamily: fonts.semiBold,
    fontSize: 10.5,
    marginBottom: 2,
  },
  input: {
    fontFamily: fonts.medium,
    height: 32,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    fontSize: 11.5,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 6,
    height: 32,
    paddingHorizontal: 8,
    marginBottom: 6,
  },
  inputField: {
    fontFamily: fonts.medium,
    flex: 1,
    height: '100%',
    fontSize: 11.5,
    paddingVertical: 0,
  },
  submitButton: {
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  submitButtonText: {
    fontFamily: fonts.bold,
    color: '#FFFFFF',
    fontSize: 11.5,
  },
  formActionsRow: {
    flexDirection: 'row',
    marginTop: 4,
    gap: 8,
  },
  cancelFormBtn: {
    flex: 1,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelFormBtnText: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
  },
  submitFormBtn: {
    flex: 1.5,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    fontFamily: fonts.italic,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  vehicleCard: {
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
  },
  motHistoryCard: {
    padding: 8,
    marginBottom: 8,
  },
  vehicleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 4,
  },
  vehicleIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniStatusBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plate: {
    backgroundColor: '#FFD300',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginRight: 6,
  },
  plateText: {
    fontFamily: fonts.bold,
    color: '#000',
    fontSize: 9.5,
    letterSpacing: 0.5,
  },
  makeModelText: {
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  vehicleBody: {
    paddingHorizontal: 8,
    paddingBottom: 6,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  divider: {
    height: 0.5,
  },
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderTopWidth: 0.5,
  },
  actionBtn: {
    flex: 1,
    height: 26,
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
  },
  soldBtn: {
    borderWidth: 1,
  },
  bookBtn: {
    elevation: 0,
  },
  actionBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtnText: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
  },
  bookedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
    alignSelf: 'center',
  },
  bookedBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
  },
  bookingDetailsContainer: {
    marginTop: 6,
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  bookingDetailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    paddingBottom: 3,
  },
  bookingDetailsTitle: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
  },
  bookingInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  bookingInfoLabel: {
    fontFamily: fonts.regular,
    fontSize: 11,
  },
  bookingInfoValue: {
    fontFamily: fonts.medium,
    fontSize: 11,
  },
  smallPlate: {
    backgroundColor: '#FFD300',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  smallPlateText: {
    fontFamily: fonts.bold,
    color: '#000',
    fontSize: 9.5,
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
    fontFamily: fonts.semiBold,
    fontSize: 10,
    marginTop: 2,
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
    fontFamily: fonts.bold,
    fontSize: 11,
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
    fontFamily: fonts.bold,
    fontSize: 10,
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
    fontFamily: fonts.bold,
    color: '#FFFFFF',
    fontSize: 22,
  },
  profileName: {
    fontFamily: fonts.bold,
    fontSize: 18,
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
    marginBottom: 24,
  },
  pendingApprovalBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 6,
    padding: 6,
    marginHorizontal: 8,
    marginVertical: 4,
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
    fontFamily: fonts.semiBold,
    fontSize: 11,
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
    fontFamily: fonts.bold,
    fontSize: 10,
  },
  homeGarageCard: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 6,
    marginTop: 6,
  },
  homeGarageName: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
  },
  bookingDirectionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 5,
  },
  bookingDirectionsBtnText: {
    fontFamily: fonts.bold,
    color: '#FFFFFF',
    fontSize: 10.5,
  },
});
