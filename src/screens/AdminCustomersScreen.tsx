import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  LayoutAnimation,
  Platform,
  UIManager,
  Switch,
  ActivityIndicator,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues, BASE_URL } from '../context/DataContext';
import SearchableDropdown from '../components/SearchableDropdown';
import {
  validateFirstName,
  validateLastName,
  validateEmail,
  validatePhoneNumber,
  validateMotExpiryDate,
  validateNewVehicleForm,
  VEHICLE_DROPDOWN_FORM_MESSAGES,
} from '../utils/validationUtils';
import { useModelAvailability } from '../hooks/useModelAvailability';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function AdminCustomersScreen({ navigation }: any) {
  const { theme } = useAppTheme();
  const { customers, vehicles, addCustomer, addVehicle, updateVehicleStatus, lookupVehicle, token } = useAppValues();

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');
  
  // States for new customer's vehicle form
  const [addVehicleNow, setAddVehicleNow] = useState(true);
  const [newCustRegNo, setNewCustRegNo] = useState('');
  const [newCustMake, setNewCustMake] = useState('');
  const [newCustModel, setNewCustModel] = useState('');
  const [newCustYear, setNewCustYear] = useState('');
  const [newCustExpiry, setNewCustExpiry] = useState('');
  const [newCustServiceDate, setNewCustServiceDate] = useState('');
  const [isSearchingPlate, setIsSearchingPlate] = useState(false);

  const [addingVehicleForCustId, setAddingVehicleForCustId] = useState<string | null>(null);
  const [isBookingMotForCustId, setIsBookingMotForCustId] = useState<string | null>(null);
  const [regNo, setRegNo] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [expiry, setExpiry] = useState('');
  const [serviceDate, setServiceDate] = useState('');

  // Whether each form's selected make has models (decides if Model is required) + the Model dropdown loaders
  const newCustModels = useModelAvailability(newCustMake, BASE_URL, token);
  const vehicleModels = useModelAvailability(make, BASE_URL, token);

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

  const formatShortDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const toggleExpandCustomer = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedCustomerId(expandedCustomerId === id ? null : id);
    setAddingVehicleForCustId(null);
    setIsBookingMotForCustId(null);
  };

  const handleLookupPlate = async () => {
    const vrnClean = newCustRegNo.trim().toUpperCase();
    if (!vrnClean) {
      Alert.alert('Error', 'Please enter a vehicle registration number first');
      return;
    }
    
    setIsSearchingPlate(true);
    try {
      const res = await lookupVehicle(vrnClean);
      if (res && res.found && res.vehicle) {
        const v = res.vehicle;
        setNewCustMake(v.make || '');
        setNewCustModel(v.model || '');
        setNewCustYear(v.year ? String(v.year) : '');
        setNewCustExpiry(v.motExpiryDate || '');
        Alert.alert('Plate Found', `Autofilled details for ${v.make} ${v.model}`);
      } else {
        Alert.alert('Not Found', 'Vehicle details not found. Please enter them manually.');
      }
    } catch (err: any) {
      console.error('[AdminCustomersScreen] lookup error:', err);
      const isBusy = err.isBusy || (err.message && (
        err.message.toLowerCase().includes('busy') ||
        err.message.toLowerCase().includes('taking too long')
      ));
      if (isBusy) {
        Alert.alert('Government API Busy', 'Government DVSA API is busy, please check again.');
      } else {
        Alert.alert('Vehicle Not Found', err.message || 'Vehicle details not found. Please enter them manually.');
      }
    } finally {
      setIsSearchingPlate(false);
    }
  };

  const handleCreateCustomer = async () => {
    const firstVal = validateFirstName(firstName);
    if (firstVal.error) {
      Alert.alert('Validation Error', `First Name: ${firstVal.error}`);
      return;
    }

    if (lastName.trim()) {
      const lastVal = validateLastName(lastName);
      if (lastVal.error) {
        Alert.alert('Validation Error', `Last Name: ${lastVal.error}`);
        return;
      }
    }

    const emailVal = validateEmail(email);
    if (emailVal.error) {
      Alert.alert('Validation Error', emailVal.error);
      return;
    }

    const mobileVal = validatePhoneNumber(mobile);
    if (mobileVal.error) {
      Alert.alert('Validation Error', mobileVal.error);
      return;
    }

    // If adding vehicle details now, validate vehicle inputs first
    if (addVehicleNow) {
      // Field-by-field validation: names only the vehicle fields that are actually missing or invalid
      const vehicleCheck = validateNewVehicleForm(
        { registration: newCustRegNo, make: newCustMake, model: newCustModel, year: newCustYear, motExpiry: newCustExpiry },
        { modelAvailability: newCustModels.availability, missingMessages: VEHICLE_DROPDOWN_FORM_MESSAGES }
      );
      if (!vehicleCheck.isValid) {
        Alert.alert(
          vehicleCheck.title,
          `${vehicleCheck.message}\n\nOr toggle off "Include Vehicle Details" to create the customer only.`
        );
        return;
      }

      // Validate Last Service Date (if provided)
      if (newCustServiceDate.trim()) {
        const serviceVal = validateMotExpiryDate(newCustServiceDate);
        if (serviceVal.error) {
          Alert.alert('Validation Error', `Last Service Date: ${serviceVal.error}`);
          return;
        }
      }
    }

    try {
      // 1. Create Customer
      const customerId = await addCustomer({
        firstName: firstName.trim(),
        lastName: lastName.trim() || '',
        email: email.trim(),
        mobile: mobile.trim(),
        address: address.trim() || undefined,
        preferredContact: 'SMS',
      });

      // 2. Create Vehicle if needed
      if (addVehicleNow && customerId) {
        await addVehicle({
          customerId,
          registrationNumber: newCustRegNo.trim().toUpperCase(),
          make: newCustMake.trim().toUpperCase(),
          // may be blank only for a make with no models - the backend re-checks this
          model: newCustModel.trim().toUpperCase(),
          year: newCustYear.trim(),
          motExpiryDate: newCustExpiry.trim(),
          lastServiceDate: newCustServiceDate.trim() || undefined,
          status: 'Active',
        });
      }

      // 3. Clear inputs
      setFirstName('');
      setLastName('');
      setEmail('');
      setMobile('');
      setAddress('');
      
      setNewCustRegNo('');
      setNewCustMake('');
      setNewCustModel('');
      setNewCustYear('');
      setNewCustExpiry('');
      setNewCustServiceDate('');
      setAddVehicleNow(true);
      
      setShowAddCustomer(false);
      
      if (addVehicleNow) {
        Alert.alert('Success', 'Customer profile and vehicle created successfully!');
      } else {
        Alert.alert('Success', 'Customer profile created successfully!');
      }
    } catch (error: any) {
      console.error(error);
      Alert.alert('Error', error.message || 'Failed to create customer profile.');
    }
  };

  const handleCreateVehicle = async (customerId: string) => {
    // Field-by-field validation: names only the fields that are actually missing or invalid
    const vehicleCheck = validateNewVehicleForm(
      { registration: regNo, make, model, year, motExpiry: expiry },
      { modelAvailability: vehicleModels.availability, missingMessages: VEHICLE_DROPDOWN_FORM_MESSAGES }
    );
    if (!vehicleCheck.isValid) {
      Alert.alert(vehicleCheck.title, vehicleCheck.message);
      return;
    }

    // Validate Last Service Date (if provided)
    if (serviceDate.trim()) {
      const serviceVal = validateMotExpiryDate(serviceDate);
      if (serviceVal.error) {
        Alert.alert('Validation Error', `Last Service Date: ${serviceVal.error}`);
        return;
      }
    }

    // Await the save so a rejected vehicle (e.g. duplicate plate) isn't reported as added
    try {
      await addVehicle({
        customerId,
        registrationNumber: regNo.trim().toUpperCase(),
        make: make.trim().toUpperCase(),
        // may be blank only for a make with no models - the backend re-checks this
        model: model.trim().toUpperCase(),
        year: year.trim(),
        motExpiryDate: expiry.trim(),
        lastServiceDate: serviceDate.trim() || undefined,
        status: 'Active',
      });
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to add vehicle.');
      return;
    }

    setRegNo('');
    setMake('');
    setModel('');
    setYear('');
    setExpiry('');
    setServiceDate('');
    setAddingVehicleForCustId(null);
    Alert.alert('Success', 'Vehicle added successfully!');
  };

  const handleChangeVehicleStatus = (vehicleId: string, currentStatus: string) => {
    Alert.alert(
      'Update Vehicle Status',
      'Select new status:',
      [
        { text: 'Active', onPress: () => updateVehicleStatus(vehicleId, 'Active') },
        { text: 'Sold', onPress: () => updateVehicleStatus(vehicleId, 'Sold') },
        { text: 'Scrapped', onPress: () => updateVehicleStatus(vehicleId, 'Scrapped') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const filteredCustomers = customers.filter((c) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;

    const nameMatch = `${c.firstName} ${c.lastName}`.toLowerCase().includes(query);
    const emailMatch = c.email.toLowerCase().includes(query);
    const mobileMatch = c.mobile.toLowerCase().includes(query);
    const customerVehicles = vehicles.filter((v) => 
      v.customerId && (
        String(v.customerId).toLowerCase() === String(c.id || '').toLowerCase() ||
        String(v.customerId).toLowerCase() === String(c._id || '').toLowerCase()
      )
    );
    const regMatch = customerVehicles.some((v) =>
      v.registrationNumber.toLowerCase().includes(query)
    );

    return nameMatch || emailMatch || mobileMatch || regMatch;
  });

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'Active': return 'check-circle';
      case 'Sold': return 'cash';
      case 'Scrapped': return 'delete-circle';
      case 'Pending': return 'clock-outline';
      case 'Rejected': return 'close-circle';
      default: return 'circle';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.searchRow}>
          <View style={[styles.searchBar, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <MaterialCommunityIcons name="magnify" size={20} color={theme.colors.placeholder} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search customers..."
              placeholderTextColor={theme.colors.placeholder}
              style={[styles.searchInput, { color: theme.colors.text }]}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <MaterialCommunityIcons name="close-circle" size={18} color={theme.colors.placeholder} />
              </TouchableOpacity>
            )}
          </View>
          
          <TouchableOpacity
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setShowAddCustomer(!showAddCustomer);
            }}
            style={[styles.addButton, { backgroundColor: theme.colors.primary }]}
          >
            <MaterialCommunityIcons 
              name={showAddCustomer ? 'close' : 'account-plus'} 
              size={24} 
              color={theme.dark ? theme.colors.background : '#FFFFFF'} 
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Add Customer Form */}
        {showAddCustomer && (
          <View style={[styles.formCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.formHeader}>
              <MaterialCommunityIcons name="account-plus" size={24} color={theme.colors.primary} />
              <Text style={[styles.formTitle, { color: theme.colors.text }]}>New Customer</Text>
            </View>

            <View style={styles.formRow}>
              <View style={styles.formField}>
                <Text style={[styles.label, { color: theme.colors.text }]}>First Name</Text>
                <TextInput
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="John"
                  placeholderTextColor={theme.colors.placeholder}
                  style={[styles.formInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                />
              </View>
              <View style={styles.formField}>
                <Text style={[styles.label, { color: theme.colors.text }]}>Last Name</Text>
                <TextInput
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Doe"
                  placeholderTextColor={theme.colors.placeholder}
                  style={[styles.formInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                />
              </View>
            </View>

            <View style={styles.iconInput}>
              <MaterialCommunityIcons name="email" size={20} color={theme.colors.placeholder} />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Email Address"
                placeholderTextColor={theme.colors.placeholder}
                keyboardType="email-address"
                autoCapitalize="none"
                style={[styles.iconInputField, { color: theme.colors.text }]}
              />
            </View>

            <View style={styles.iconInput}>
              <MaterialCommunityIcons name="phone" size={20} color={theme.colors.placeholder} />
              <TextInput
                value={mobile}
                onChangeText={setMobile}
                placeholder="Mobile Number"
                placeholderTextColor={theme.colors.placeholder}
                keyboardType="phone-pad"
                style={[styles.iconInputField, { color: theme.colors.text }]}
              />
            </View>

            <View style={styles.iconInput}>
              <MaterialCommunityIcons name="home" size={20} color={theme.colors.placeholder} />
              <TextInput
                value={address}
                onChangeText={setAddress}
                placeholder="Address (Optional)"
                placeholderTextColor={theme.colors.placeholder}
                style={[styles.iconInputField, { color: theme.colors.text }]}
              />
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 10, paddingHorizontal: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="car" size={20} color={theme.colors.placeholder} style={{ marginRight: 8 }} />
                <Text style={{ fontFamily: fonts.semiBold, fontSize: 14, color: theme.colors.text }}>Include Vehicle Details?</Text>
              </View>
              <Switch
                value={addVehicleNow}
                onValueChange={(val) => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setAddVehicleNow(val);
                }}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor={addVehicleNow ? (theme.dark ? theme.colors.background : '#FFFFFF') : theme.colors.placeholder}
              />
            </View>

            {addVehicleNow && (
              <View style={{ marginTop: 4, padding: 12, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, backgroundColor: theme.dark ? '#1C1C1E' : '#F2F2F7', marginBottom: 12 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: theme.colors.text, marginBottom: 10 }}>Vehicle Details</Text>
                
                {/* Plate input & lookup row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', flex: 1, height: 40, backgroundColor: '#FFD300', borderWidth: 1.5, borderColor: '#000000', borderRadius: 6, overflow: 'hidden', alignItems: 'center' }}>
                    <View style={{ width: 28, height: '100%', backgroundColor: '#0A4E9B', justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ fontFamily: fonts.bold, color: '#FFFFFF', fontSize: 8 }}>UK</Text>
                    </View>
                    <TextInput
                      value={newCustRegNo}
                      onChangeText={(txt) => setNewCustRegNo(txt.toUpperCase())}
                      placeholder="REG PLATE"
                      placeholderTextColor="#808080"
                      autoCapitalize="characters"
                      maxLength={8}
                      style={{ flex: 1, fontFamily: fonts.bold, fontSize: 15, color: '#000000', textAlign: 'center', height: '100%', padding: 0 }}
                    />
                  </View>
                  <TouchableOpacity
                    onPress={handleLookupPlate}
                    disabled={isSearchingPlate}
                    style={{ marginLeft: 8, height: 40, paddingHorizontal: 12, backgroundColor: theme.colors.secondary, borderRadius: 6, justifyContent: 'center', alignItems: 'center', flexDirection: 'row' }}
                  >
                    {isSearchingPlate ? (
                      <ActivityIndicator size="small" color={theme.dark ? theme.colors.background : '#FFFFFF'} />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="magnify" size={16} color={theme.dark ? theme.colors.background : '#FFFFFF'} style={{ marginRight: 4 }} />
                        <Text style={{ fontFamily: fonts.bold, color: theme.dark ? theme.colors.background : '#FFFFFF', fontSize: 12 }}>LOOKUP</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Make and Model fields */}
                <View style={styles.formRow}>
                  <View style={styles.formField}>
                    <Text style={[styles.label, { color: theme.colors.text, fontSize: 11 }]}>Make / Brand</Text>
                    <SearchableDropdown
                      placeholder="Make"
                      selectedValue={newCustMake}
                      onValueChange={(val) => {
                        setNewCustMake(val);
                        setNewCustModel('');
                      }}
                      fetchItems={fetchMakesList}
                    />
                  </View>
                  <View style={styles.formField}>
                    <Text style={[styles.label, { color: theme.colors.text, fontSize: 11 }]}>Model</Text>
                    <SearchableDropdown
                      placeholder="Model"
                      selectedValue={newCustModel}
                      onValueChange={setNewCustModel}
                      fetchItems={newCustModels.fetchModels}
                      disabled={!newCustMake}
                      emptyText={
                        newCustModels.availability === 'none'
                          ? `No models are listed for ${newCustMake}. You can add this vehicle without a model.`
                          : undefined
                      }
                    />
                  </View>
                </View>

                {/* Year and MOT Expiry */}
                <View style={styles.formRow}>
                  <View style={styles.formField}>
                    <Text style={[styles.label, { color: theme.colors.text, fontSize: 11 }]}>Year (YYYY)</Text>
                    <TextInput
                      value={newCustYear}
                      onChangeText={setNewCustYear}
                      placeholder="e.g. 2018"
                      placeholderTextColor={theme.colors.placeholder}
                      keyboardType="numeric"
                      maxLength={4}
                      style={[styles.subFormInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                    />
                  </View>
                  <View style={styles.formField}>
                    <Text style={[styles.label, { color: theme.colors.text, fontSize: 11 }]}>MOT Expiry (YYYY-MM-DD)</Text>
                    <TextInput
                      value={newCustExpiry}
                      onChangeText={(text) => setNewCustExpiry(formatDateInput(text))}
                      placeholder="e.g. 2027-07-12"
                      placeholderTextColor={theme.colors.placeholder}
                      keyboardType="numeric"
                      maxLength={10}
                      style={[styles.subFormInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                    />
                  </View>
                </View>

                {/* Last Service Date */}
                <View style={[styles.formRow, { marginBottom: 0 }]}>
                  <View style={styles.formField}>
                    <Text style={[styles.label, { color: theme.colors.text, fontSize: 11 }]}>Last Service (Optional, YYYY-MM-DD)</Text>
                    <TextInput
                      value={newCustServiceDate}
                      onChangeText={(text) => setNewCustServiceDate(formatDateInput(text))}
                      placeholder="e.g. 2026-07-13"
                      placeholderTextColor={theme.colors.placeholder}
                      keyboardType="numeric"
                      maxLength={10}
                      style={[styles.subFormInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                    />
                  </View>
                </View>
              </View>
            )}

            <TouchableOpacity onPress={handleCreateCustomer} style={[styles.submitButton, { backgroundColor: theme.colors.primary }]}>
              <Text style={[styles.submitButtonText, { color: theme.dark ? theme.colors.background : '#FFFFFF' }]}>Create Customer</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Customer List */}
        {/* <Text style={[styles.directoryTitle, { color: theme.colors.text }]}>
          <MaterialCommunityIcons name="account-group" size={20} color={theme.colors.text} /> 
          {"  "}Customers ({filteredCustomers.length})
        </Text> */}

        {filteredCustomers.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="account-off" size={48} color={theme.colors.placeholder} />
            <Text style={[styles.emptyText, { color: theme.colors.placeholder }]}>No customers found</Text>
          </View>
        ) : (
          filteredCustomers.map((c) => {
            const customerVehicles = vehicles.filter((v) => 
              v.customerId && (
                String(v.customerId).toLowerCase() === String(c.id || '').toLowerCase() ||
                String(v.customerId).toLowerCase() === String(c._id || '').toLowerCase()
              )
            );
            const isExpanded = expandedCustomerId === c.id;

            return (
              <View key={c.id} style={[styles.customerCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <TouchableOpacity onPress={() => toggleExpandCustomer(c.id)} style={styles.customerHeader}>
                  <View style={styles.customerHeaderLeft}>
                    <View style={styles.customerIcon}>
                      <Text style={styles.customerInitial}>
                        {c.firstName[0]}{c.lastName[0]}
                      </Text>
                    </View>
                    <View>
                      <Text style={[styles.customerNameText, { color: theme.colors.text }]}>
                        {c.firstName} {c.lastName}
                      </Text>
                      <View style={styles.customerInfoCol}>
                        <View style={styles.customerInfoItem}>
                          <MaterialCommunityIcons name="phone" size={12} color={theme.colors.placeholder} />
                          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: theme.colors.placeholder, marginLeft: 4 }}>
                            {c.mobile}
                          </Text>
                        </View>
                        <View style={styles.customerInfoItem}>
                          <MaterialCommunityIcons name="email" size={12} color={theme.colors.placeholder} />
                          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: theme.colors.placeholder, marginLeft: 4 }}>
                            {c.email}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                  <View style={styles.customerHeaderRight}>
                    <MaterialCommunityIcons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={theme.colors.placeholder}
                    />
                  </View>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.expandedContent}>
                    <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

                    <View style={{ flexDirection: 'row', gap: 8, marginVertical: 10 }}>
                      <TouchableOpacity
                        onPress={() => navigation.navigate('CustomerDetail', { customerId: c.id })}
                        style={[styles.viewDetailsBtn, { flex: 1, backgroundColor: theme.colors.secondary + '12', borderColor: theme.colors.secondary, marginVertical: 0 }]}
                      >
                        <MaterialCommunityIcons name="account-details-outline" size={18} color={theme.colors.secondary} />
                        <Text style={{ fontFamily: fonts.bold, color: theme.colors.secondary, fontSize: 12, marginLeft: 6 }} numberOfLines={1}>
                          Details & History
                        </Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        onPress={() => {
                          const bookableVehicles = customerVehicles.filter(v => v.status === 'Active');
                          if (bookableVehicles.length === 0) {
                            Alert.alert(
                              'No Approved Vehicles',
                              'This customer has no active/approved vehicles. Please add or approve a vehicle first.',
                              [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                  text: 'Add',
                                  onPress: () => navigation.navigate('CustomerDetail', { customerId: c.id }),
                                },
                              ]
                            );
                            return;
                          }
                          
                          // If they only have 1 active vehicle, directly navigate to booking
                          if (bookableVehicles.length === 1) {
                            navigation.navigate('AdminBookMot', {
                              customer: c,
                              vehicle: bookableVehicles[0]
                            });
                            return;
                          }

                          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                          setIsBookingMotForCustId(c.id);
                        }}
                        style={[styles.viewDetailsBtn, { flex: 1, backgroundColor: theme.colors.primary + '12', borderColor: theme.colors.primary, marginVertical: 0 }]}
                      >
                        <MaterialCommunityIcons name="calendar-plus" size={18} color={theme.colors.primary} />
                        <Text style={{ fontFamily: fonts.bold, color: theme.colors.primary, fontSize: 12, marginLeft: 6 }} numberOfLines={1}>
                          Book Service
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {isBookingMotForCustId === c.id && (
                      <View style={[styles.vehicleForm, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, marginBottom: 12 }]}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: theme.colors.text, marginBottom: 10 }}>
                          Select Vehicle for Booking:
                        </Text>
                        {customerVehicles.filter(v => v.status === 'Active').map(v => (
                          <TouchableOpacity
                            key={v.id}
                            onPress={() => {
                              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                              setIsBookingMotForCustId(null);
                              navigation.navigate('AdminBookMot', {
                                customer: c,
                                vehicle: v
                              });
                            }}
                            style={{
                              flexDirection: 'row',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              paddingVertical: 10,
                              borderBottomWidth: 0.5,
                              borderColor: theme.colors.border
                            }}
                          >
                            <View style={styles.recentPlate}>
                              <Text style={styles.recentPlateText}>{v.registrationNumber}</Text>
                            </View>
                            <Text style={{ fontFamily: fonts.medium, color: theme.colors.text, fontSize: 12, flex: 1, marginLeft: 10 }}>
                              {v.make} {v.model} {v.year ? `(${v.year})` : ''}
                            </Text>
                            <MaterialCommunityIcons name="chevron-right" size={18} color={theme.colors.placeholder} />
                          </TouchableOpacity>
                        ))}
                        <TouchableOpacity
                          onPress={() => {
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                            setIsBookingMotForCustId(null);
                          }}
                          style={{ marginTop: 10, alignItems: 'center', paddingVertical: 4 }}
                        >
                          <Text style={{ fontFamily: fonts.bold, color: theme.colors.error, fontSize: 13 }}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    
                    {c.address && (
                      <View style={styles.addressBox}>
                        <MaterialCommunityIcons name="map-marker" size={16} color={theme.colors.placeholder} />
                        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: theme.colors.text, marginLeft: 8 }}>{c.address}</Text>
                      </View>
                    )}

                    <View style={styles.vehiclesHeaderRow}>
                      <View style={styles.vehiclesTitle}>
                        <MaterialCommunityIcons name="car" size={18} color={theme.colors.text} />
                        <Text style={[styles.vehiclesTitleText, { color: theme.colors.text }]}>
                          Vehicles ({customerVehicles.length})
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                          setAddingVehicleForCustId(addingVehicleForCustId === c.id ? null : c.id);
                        }}
                        style={[styles.addVehicleBadge, { borderColor: theme.colors.secondary }]}
                      >
                        <MaterialCommunityIcons name="plus-circle" size={16} color={theme.colors.secondary} />
                        <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: theme.colors.secondary, marginLeft: 4 }}>
                          Add
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {addingVehicleForCustId === c.id && (
                      <View style={[styles.vehicleForm, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: theme.colors.text, marginBottom: 10 }}>
                          <MaterialCommunityIcons name="car" size={16} color={theme.colors.secondary} /> Add Vehicle
                        </Text>
                        
                        <View style={styles.formRow}>
                          <View style={styles.formField}>
                            <TextInput
                              value={regNo}
                              onChangeText={setRegNo}
                              placeholder="Reg Plate"
                              placeholderTextColor={theme.colors.placeholder}
                              autoCapitalize="characters"
                              style={[styles.subFormInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                            />
                          </View>
                          <View style={styles.formField}>
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
                        </View>

                        <View style={styles.formRow}>
                          <View style={styles.formField}>
                            <SearchableDropdown
                              placeholder="Model"
                              selectedValue={model}
                              onValueChange={setModel}
                              fetchItems={vehicleModels.fetchModels}
                              disabled={!make}
                              emptyText={
                                vehicleModels.availability === 'none'
                                  ? `No models are listed for ${make}. You can add this vehicle without a model.`
                                  : undefined
                              }
                            />
                          </View>
                          <View style={styles.formField}>
                            <TextInput
                              value={year}
                              onChangeText={setYear}
                              placeholder="Year (YYYY)"
                              placeholderTextColor={theme.colors.placeholder}
                              keyboardType="numeric"
                              maxLength={4}
                              style={[styles.subFormInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                            />
                          </View>
                        </View>

                        <View style={styles.formRow}>
                          <View style={styles.formField}>
                            <TextInput
                              value={expiry}
                              onChangeText={(text) => setExpiry(formatDateInput(text))}
                              placeholder="MOT Expiry (YYYY-MM-DD)"
                              placeholderTextColor={theme.colors.placeholder}
                              keyboardType="numeric"
                              maxLength={10}
                              style={[styles.subFormInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                            />
                          </View>
                          <View style={styles.formField}>
                            <TextInput
                              value={serviceDate}
                              onChangeText={(text) => setServiceDate(formatDateInput(text))}
                              placeholder="Last Service (YYYY-MM-DD)"
                              placeholderTextColor={theme.colors.placeholder}
                              keyboardType="numeric"
                              maxLength={10}
                              style={[styles.subFormInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                            />
                          </View>
                        </View>

                        <TouchableOpacity
                          onPress={() => handleCreateVehicle(c.id)}
                          style={[styles.vehicleSubmitBtn, { backgroundColor: theme.colors.secondary }]}
                        >
                          <Text style={{ fontFamily: fonts.bold, color: theme.dark ? theme.colors.background : '#FFFFFF', fontSize: 13 }}>Save Vehicle</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {customerVehicles.length === 0 ? (
                      <View style={styles.emptyVehicleState}>
                        <MaterialCommunityIcons name="car-off" size={20} color={theme.colors.placeholder} />
                        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: theme.colors.placeholder, marginLeft: 8 }}>
                          No vehicles registered
                        </Text>
                      </View>
                    ) : (
                      customerVehicles.map((v) => {
                        const isSold = v.status === 'Sold';
                        const isScrapped = v.status === 'Scrapped';
                        
                        return (
                          <View key={v.id} style={{ borderBottomWidth: 0.8, borderColor: theme.colors.border, paddingVertical: 10 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <View style={styles.vehicleRowLeft}>
                                <View style={styles.recentPlate}>
                                  <Text style={styles.recentPlateText}>{v.registrationNumber}</Text>
                                </View>
                                <View style={{ flex: 1, marginLeft: 8 }}>
                                  <Text style={[styles.vehicleMakeText, { color: theme.colors.text }]}>
                                    {v.make} {v.model}
                                  </Text>
                                    <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: theme.colors.placeholder }}>
                                      {v.year} • MOT: {formatShortDate(v.motExpiryDate)} {v.motExpiryDate ? (() => {
                                        const d = new Date(v.motExpiryDate);
                                        const today = new Date();
                                        today.setHours(0, 0, 0, 0);
                                        const diff = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                                        return `(${diff >= 0 ? `${diff} days left` : `${Math.abs(diff)} days ago`})`;
                                      })() : ''}
                                    </Text>
                                </View>
                              </View>

                              <TouchableOpacity
                                onPress={() => handleChangeVehicleStatus(v.id, v.status)}
                                style={[
                                  styles.statusPill,
                                  {
                                    backgroundColor: isSold
                                      ? theme.colors.placeholder + '20'
                                      : (isScrapped || v.status === 'Rejected')
                                      ? theme.colors.error + '20'
                                      : v.status === 'Pending'
                                      ? theme.colors.warning + '20'
                                      : theme.colors.success + '20',
                                  },
                                ]}
                              >
                                <MaterialCommunityIcons 
                                  name={getStatusIcon(v.status)} 
                                  size={12} 
                                  color={isSold ? theme.colors.placeholder : (isScrapped || v.status === 'Rejected') ? theme.colors.error : v.status === 'Pending' ? theme.colors.warning : theme.colors.success} 
                                />
                                <Text
                                  style={{
                                    fontFamily: fonts.bold,
                                    fontSize: 10,
                                    marginLeft: 3,
                                    color: isSold
                                      ? theme.colors.placeholder
                                      : (isScrapped || v.status === 'Rejected')
                                      ? theme.colors.error
                                      : v.status === 'Pending'
                                      ? theme.colors.warning
                                      : theme.colors.success,
                                  }}
                                >
                                  {v.status}
                                </Text>
                              </TouchableOpacity>
                            </View>

                            {v.status === 'Rejected' && v.rejectionReason && (
                              <View style={[styles.custRejectionReasonBox, { backgroundColor: theme.colors.error + '10', borderColor: theme.colors.error }]}>
                                <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: theme.colors.error }}>Rejection Reason:</Text>
                                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: theme.colors.text, marginTop: 2 }}>{v.rejectionReason}</Text>
                              </View>
                            )}
                          </View>
                        );
                      })
                    )}
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

import { fonts } from '../theme/theme';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  searchInput: {
    fontFamily: fonts.regular,
    flex: 1,
    height: '100%',
    fontSize: 14,
    paddingHorizontal: 8,
    padding: 0,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  formCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  formTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    marginLeft: 8,
  },
  formRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  formField: {
    flex: 1,
    marginHorizontal: 4,
  },
  label: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    marginBottom: 4,
  },
  formInput: {
    fontFamily: fonts.regular,
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 14,
  },
  subFormInput: {
    fontFamily: fonts.regular,
    height: 36,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    fontSize: 12,
  },
  iconInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 12,
    height: 40,
  },
  iconInputField: {
    fontFamily: fonts.regular,
    flex: 1,
    height: '100%',
    fontSize: 14,
    paddingHorizontal: 8,
    padding: 0,
  },
  submitButton: {
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  submitButtonText: {
    fontFamily: fonts.bold,
    color: '#FFFFFF',
    fontSize: 14,
  },
  directoryTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    marginBottom: 14,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  customerCard: {
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  customerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  customerHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  customerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFD300',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  customerInitial: {
    fontFamily: fonts.bold,
    color: '#000',
    fontSize: 14,
  },
  customerInfoCol: {
    flexDirection: 'column',
    marginTop: 4,
    gap: 3,
  },
  customerInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customerNameText: {
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  customerHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expandedContent: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  divider: {
    height: 1,
    marginBottom: 12,
  },
  addressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  vehiclesHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 4,
  },
  vehiclesTitle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vehiclesTitleText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    marginLeft: 6,
  },
  addVehicleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  vehicleForm: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  vehicleSubmitBtn: {
    height: 36,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
  },
  vehicleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.8,
  },
  vehicleRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  recentPlate: {
    backgroundColor: '#FFD300',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  recentPlateText: {
    fontFamily: fonts.bold,
    color: '#000',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  cancelButtonText: {
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  viewDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 8,
    marginVertical: 10,
  },
  custRejectionReasonBox: {
    marginTop: 8,
    padding: 8,
    borderRadius: 6,
    borderWidth: 0.5,
  },
  vehicleMakeText: {
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  statusPill: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyVehicleState: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
});