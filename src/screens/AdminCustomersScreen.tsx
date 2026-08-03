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
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues } from '../context/DataContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function AdminCustomersScreen() {
  const { theme } = useAppTheme();
  const { customers, vehicles, addCustomer, addVehicle, updateVehicleStatus } = useAppValues();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');

  // Expandable customer ID state
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);

  // Add Customer Form states
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');
  const [preferredContact, setPreferredContact] = useState<'SMS' | 'Email' | 'WhatsApp'>('SMS');

  // Add Vehicle Form state (for selected customer)
  const [addingVehicleForCustId, setAddingVehicleForCustId] = useState<string | null>(null);
  const [regNo, setRegNo] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [expiry, setExpiry] = useState('');

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
  const [serviceDate, setServiceDate] = useState('');

  const toggleExpandCustomer = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedCustomerId(expandedCustomerId === id ? null : id);
    setAddingVehicleForCustId(null); // Reset vehicle form
  };

  const handleCreateCustomer = () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !mobile.trim()) {
      Alert.alert('Error', 'Please fill in Name, Email, and Mobile fields');
      return;
    }

    addCustomer({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      mobile: mobile.trim(),
      preferredContact,
      address: address.trim() || undefined,
    });

    // Reset Form
    setFirstName('');
    setLastName('');
    setEmail('');
    setMobile('');
    setAddress('');
    setPreferredContact('SMS');
    setShowAddCustomer(false);
    Alert.alert('Success', 'Customer profile created successfully!');
  };

  const handleCreateVehicle = (customerId: string) => {
    if (!regNo.trim() || !make.trim() || !model.trim() || !expiry.trim()) {
      Alert.alert('Error', 'Please fill in Registration, Make, Model, and MOT Expiry Date');
      return;
    }

    addVehicle({
      customerId,
      registrationNumber: regNo.trim().toUpperCase(),
      make: make.trim().toUpperCase(),
      model: model.trim().toUpperCase(),
      year: year.trim() || '2018',
      motExpiryDate: expiry.trim(),
      lastServiceDate: serviceDate.trim() || undefined,
      status: 'Active',
    });

    // Reset Form
    setRegNo('');
    setMake('');
    setModel('');
    setYear('');
    setExpiry('');
    setServiceDate('');
    setAddingVehicleForCustId(null);
    Alert.alert('Success', 'Vehicle record added successfully!');
  };

  const handleChangeVehicleStatus = (vehicleId: string, currentStatus: string) => {
    Alert.alert(
      'Change Vehicle Status',
      'Select new ownership/operational status:',
      [
        { text: 'Active', onPress: () => updateVehicleStatus(vehicleId, 'Active') },
        { text: 'Sold', onPress: () => updateVehicleStatus(vehicleId, 'Sold') },
        { text: 'Scrapped', onPress: () => updateVehicleStatus(vehicleId, 'Scrapped') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  // Filter customers by SearchQuery (PDF criteria: Name, Registration, Mobile, Email)
  const filteredCustomers = customers.filter((c) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;

    const nameMatch = `${c.firstName} ${c.lastName}`.toLowerCase().includes(query);
    const emailMatch = c.email.toLowerCase().includes(query);
    const mobileMatch = c.mobile.toLowerCase().includes(query);
    
    // Check if any of this customer's vehicles registration matches
    const customerVehicles = vehicles.filter((v) => v.customerId === c.id);
    const regMatch = customerVehicles.some((v) =>
      v.registrationNumber.toLowerCase().includes(query)
    );

    return nameMatch || emailMatch || mobileMatch || regMatch;
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header and Search Box */}
      <View style={styles.header}>
        <View style={styles.searchRow}>
          <View style={[styles.searchBar, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <MaterialCommunityIcons name="magnify" size={20} color={theme.colors.placeholder} style={{ marginRight: 8 }} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by name, plate, mobile, email..."
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
            <MaterialCommunityIcons name="account-plus" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Add Customer Form (Collapsible) */}
        {showAddCustomer && (
          <View style={[styles.formCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <Text style={[styles.formTitle, { color: theme.colors.text }]}>Add New Customer</Text>

            <View style={styles.formRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={[styles.label, { color: theme.colors.text }]}>First Name</Text>
                <TextInput
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="John"
                  placeholderTextColor={theme.colors.placeholder}
                  style={[styles.formInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                />
              </View>
              <View style={{ flex: 1 }}>
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

            <Text style={[styles.label, { color: theme.colors.text }]}>Email Address</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="john@example.com"
              placeholderTextColor={theme.colors.placeholder}
              keyboardType="email-address"
              autoCapitalize="none"
              style={[styles.formInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
            />

            <Text style={[styles.label, { color: theme.colors.text }]}>Mobile Number</Text>
            <TextInput
              value={mobile}
              onChangeText={setMobile}
              placeholder="07700 900000"
              placeholderTextColor={theme.colors.placeholder}
              keyboardType="phone-pad"
              style={[styles.formInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
            />

            <Text style={[styles.label, { color: theme.colors.text }]}>Address (Optional)</Text>
            <TextInput
              value={address}
              onChangeText={setAddress}
              placeholder="E.g. 12 High St, London"
              placeholderTextColor={theme.colors.placeholder}
              style={[styles.formInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
            />

            <Text style={[styles.label, { color: theme.colors.text }]}>Preferred Contact Method</Text>
            <View style={styles.contactTypeRow}>
              {(['SMS', 'Email', 'WhatsApp'] as const).map((method) => (
                <TouchableOpacity
                  key={method}
                  onPress={() => setPreferredContact(method)}
                  style={[
                    styles.contactOption,
                    {
                      borderColor: preferredContact === method ? theme.colors.secondary : theme.colors.border,
                      backgroundColor: preferredContact === method ? theme.colors.secondary + '15' : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: preferredContact === method ? theme.colors.secondary : theme.colors.text,
                      fontWeight: 'bold',
                      fontSize: 13,
                    }}
                  >
                    {method}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity onPress={handleCreateCustomer} style={[styles.submitButton, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.submitButtonText}>Create Customer Record</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Customer Directory List */}
        <Text style={[styles.directoryTitle, { color: theme.colors.text }]}>Customer Directory</Text>

        {filteredCustomers.length === 0 ? (
          <Text style={[styles.emptyText, { color: theme.colors.placeholder }]}>No matching customer profiles found.</Text>
        ) : (
          filteredCustomers.map((c) => {
            const customerVehicles = vehicles.filter((v) => v.customerId === c.id);
            const isExpanded = expandedCustomerId === c.id;

            return (
              <View key={c.id} style={[styles.customerCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                {/* Header/Info Box */}
                <TouchableOpacity onPress={() => toggleExpandCustomer(c.id)} style={styles.customerHeader}>
                  <View style={styles.customerHeaderLeft}>
                    <Text style={[styles.customerNameText, { color: theme.colors.text }]}>
                      {c.firstName} {c.lastName}
                    </Text>
                    <Text style={{ fontSize: 12, color: theme.colors.placeholder, marginTop: 2 }}>
                      {c.mobile} • {c.email}
                    </Text>
                  </View>
                  <View style={styles.customerHeaderRight}>
                    <View style={[styles.prefBadge, { backgroundColor: theme.colors.secondary + '15' }]}>
                      <Text style={{ fontSize: 10, fontWeight: 'bold', color: theme.colors.secondary }}>
                        {c.preferredContact}
                      </Text>
                    </View>
                    <MaterialCommunityIcons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={theme.colors.placeholder}
                    />
                  </View>
                </TouchableOpacity>

                {/* Expanded Vehicle Details */}
                {isExpanded && (
                  <View style={styles.expandedContent}>
                    <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
                    
                    {c.address && (
                      <View style={{ marginBottom: 12 }}>
                        <Text style={{ fontSize: 11, color: theme.colors.placeholder }}>Address Details:</Text>
                        <Text style={{ fontSize: 13, color: theme.colors.text, marginTop: 2 }}>{c.address}</Text>
                      </View>
                    )}

                    <View style={styles.vehiclesHeaderRow}>
                      <Text style={[styles.vehiclesTitleText, { color: theme.colors.text }]}>Managed Vehicles</Text>
                      <TouchableOpacity
                        onPress={() => {
                          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                          setAddingVehicleForCustId(addingVehicleForCustId === c.id ? null : c.id);
                        }}
                        style={[styles.addVehicleBadge, { borderColor: theme.colors.secondary }]}
                      >
                        <MaterialCommunityIcons name="plus" size={14} color={theme.colors.secondary} style={{ marginRight: 4 }} />
                        <Text style={{ fontSize: 11, fontWeight: 'bold', color: theme.colors.secondary }}>Add Vehicle</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Add Vehicle Sub-Form */}
                    {addingVehicleForCustId === c.id && (
                      <View style={[styles.vehicleForm, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                        <Text style={{ fontWeight: 'bold', fontSize: 13, color: theme.colors.text, marginBottom: 10 }}>Add Vehicle Details</Text>
                        
                        <View style={styles.formRow}>
                          <View style={{ flex: 1, marginRight: 8 }}>
                            <TextInput
                              value={regNo}
                              onChangeText={setRegNo}
                              placeholder="Reg Plate (e.g. AB12 XYZ)"
                              placeholderTextColor={theme.colors.placeholder}
                              autoCapitalize="characters"
                              style={[styles.subFormInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <TextInput
                              value={make}
                              onChangeText={setMake}
                              placeholder="Make (e.g. FORD)"
                              placeholderTextColor={theme.colors.placeholder}
                              autoCapitalize="characters"
                              style={[styles.subFormInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                            />
                          </View>
                        </View>

                        <View style={styles.formRow}>
                          <View style={{ flex: 1, marginRight: 8 }}>
                            <TextInput
                              value={model}
                              onChangeText={setModel}
                              placeholder="Model (e.g. FOCUS)"
                              placeholderTextColor={theme.colors.placeholder}
                              autoCapitalize="characters"
                              style={[styles.subFormInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <TextInput
                              value={year}
                              onChangeText={setYear}
                              placeholder="Year (e.g. 2018)"
                              placeholderTextColor={theme.colors.placeholder}
                              keyboardType="numeric"
                              style={[styles.subFormInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                            />
                          </View>
                        </View>

                        <View style={styles.formRow}>
                          <View style={{ flex: 1, marginRight: 8 }}>
                            <TextInput
                              value={expiry}
                              onChangeText={(text) => setExpiry(formatDateInput(text))}
                              placeholder="Expiry Date (YYYY-MM-DD)"
                              placeholderTextColor={theme.colors.placeholder}
                              keyboardType="numeric"
                              maxLength={10}
                              style={[styles.subFormInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <TextInput
                              value={serviceDate}
                              onChangeText={setServiceDate}
                              placeholder="Service Date (Optional)"
                              placeholderTextColor={theme.colors.placeholder}
                              style={[styles.subFormInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                            />
                          </View>
                        </View>

                        <TouchableOpacity
                          onPress={() => handleCreateVehicle(c.id)}
                          style={[styles.vehicleSubmitBtn, { backgroundColor: theme.colors.secondary }]}
                        >
                          <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 }}>Save Vehicle Record</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Vehicles List */}
                    {customerVehicles.length === 0 ? (
                      <Text style={{ fontSize: 13, fontStyle: 'italic', color: theme.colors.placeholder, marginTop: 8 }}>
                        No vehicles registered under this customer.
                      </Text>
                    ) : (
                      customerVehicles.map((v) => {
                        const isSold = v.status === 'Sold';
                        const isScrapped = v.status === 'Scrapped';
                        
                        return (
                          <View key={v.id} style={[styles.vehicleRow, { borderColor: theme.colors.border }]}>
                            <View style={styles.vehicleRowLeft}>
                              <View style={styles.recentPlate}>
                                <Text style={styles.recentPlateText}>{v.registrationNumber}</Text>
                              </View>
                              <View style={{ flex: 1, marginLeft: 8 }}>
                                <Text style={[styles.vehicleMakeText, { color: theme.colors.text }]}>
                                  {v.make} {v.model} ({v.year})
                                </Text>
                                <Text style={{ fontSize: 11, color: theme.colors.placeholder, marginTop: 2 }}>
                                  MOT Expiry: {v.motExpiryDate}
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
                                    : isScrapped
                                    ? theme.colors.error + '20'
                                    : theme.colors.success + '20',
                                },
                              ]}
                            >
                              <Text
                                style={{
                                  fontSize: 10,
                                  fontWeight: 'bold',
                                  color: isSold
                                    ? theme.colors.placeholder
                                    : isScrapped
                                    ? theme.colors.error
                                    : theme.colors.success,
                                }}
                              >
                                {v.status}
                              </Text>
                            </TouchableOpacity>
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
    borderRadius: 8,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    padding: 0,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
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
  formTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  formRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  formInput: {
    height: 40,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    fontSize: 14,
    marginBottom: 12,
  },
  subFormInput: {
    height: 36,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    fontSize: 12,
    backgroundColor: '#FFFFFF10',
  },
  contactTypeRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  contactOption: {
    flex: 1,
    height: 36,
    borderWidth: 1.5,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  submitButton: {
    height: 44,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  directoryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 14,
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 16,
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
    padding: 16,
  },
  customerHeaderLeft: {
    flex: 1,
    paddingRight: 8,
  },
  customerNameText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  customerHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  prefBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginRight: 8,
  },
  expandedContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  divider: {
    height: 1,
    marginBottom: 12,
  },
  vehiclesHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 4,
  },
  vehiclesTitleText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  addVehicleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  vehicleForm: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  vehicleSubmitBtn: {
    height: 32,
    borderRadius: 4,
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
    color: '#000',
    fontWeight: 'bold',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  vehicleMakeText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 64,
    alignItems: 'center',
  },
});
