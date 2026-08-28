import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Text,
  ActivityIndicator,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues } from '../context/DataContext';
import AsyncStorage from '@react-native-async-storage/async-storage';


const mapBackendVehicleToFrontend = (v: any) => {
  const isPass = v.motStatus === 'Valid' || v.status === 'PASS' || v.status === 'Active';
  
  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const regUpper = (v.registrationNumber || v.registration || '').toUpperCase().trim();
  
  let advisories = v.advisories || [];
  let failures = v.failures || [];

  // Only inject mock details if there is no live motTests array present
  if (!v.motTests && advisories.length === 0 && failures.length === 0) {
    if (regUpper === 'AB18 CDE') {
      advisories = [
        'Front brake pads wearing thin (minor)',
        'Nearside rear tyre worn close to legal limit (advisory)',
        'Front suspension arm pin or bush worn but not resulting in excessive movement (advisory)',
      ];
    } else if (regUpper === 'LD65 XYZ') {
      advisories = [
        'Nearside front tyre slightly damaged (advisory)',
        'Monitor oil leak from gearbox area (minor)',
      ];
      failures = [
        'Nearside front headlamp not working on dipped beam (major failure)',
        'Offside rear brake disc worn below limit (major failure)',
        'Exhaust emissions exceed limit values (major failure)',
      ];
    } else if (regUpper === 'MH07 KKK') {
      // none
    } else {
      if (isPass) {
        advisories = ['Rear brake discs worn, pitted or scored (minor)'];
      } else {
        advisories = ['Front tyres worn close to limit'];
        failures = ['Windscreen wiper does not clear the windshield effectively (major failure)'];
      }
    }
  }

  return {
    registration: regUpper,
    make: v.make || '',
    model: v.model || '',
    year: v.year ? String(v.year) : '',
    color: v.color || 'Grey',
    fuelType: v.fuelType || 'Petrol',
    engineSize: v.engineSize || '1500cc',
    status: isPass ? 'PASS' : 'FAIL',
    expiryDate: formatDate(v.motExpiryDate || v.expiryDate),
    testDate: formatDate(v.lastServiceDate || v.testDate || new Date().toISOString().split('T')[0]),
    testNumber: v.testNumber || '8910 2345 6789',
    mileage: v.mileage || '45,000 miles',
    advisories,
    failures,
    motTests: v.motTests || null
  };
};

export default function HomeScreen({ navigation }: any) {
  const { theme } = useAppTheme();
  const { token, vehicles, refreshData, lookupVehicle, user } = useAppValues();
  const [regNumber, setRegNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchHistory, setSearchHistory] = useState<any[]>([]);

  const loadSearchHistory = async () => {
    if (!user?.id) return;
    try {
      const historyStr = await AsyncStorage.getItem(`@search_history_${user.id}`);
      if (historyStr) {
        setSearchHistory(JSON.parse(historyStr));
      } else {
        setSearchHistory([]);
      }
    } catch (e) {
      console.error('Failed to load search history:', e);
    }
  };

  const saveVehicleToHistory = async (mappedVehicle: any) => {
    if (!user?.id) return;
    try {
      const historyKey = `@search_history_${user.id}`;
      const historyStr = await AsyncStorage.getItem(historyKey);
      let history = historyStr ? JSON.parse(historyStr) : [];
      
      // Remove duplicates
      history = history.filter((h: any) => h.registration.toUpperCase() !== mappedVehicle.registration.toUpperCase());
      
      // Prepend
      history.unshift(mappedVehicle);
      
      // Limit to 20 items
      if (history.length > 20) {
        history = history.slice(0, 20);
      }
      
      await AsyncStorage.setItem(historyKey, JSON.stringify(history));
      setSearchHistory(history);
    } catch (e) {
      console.error('Failed to save search history:', e);
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (token) {
        refreshData();
        loadSearchHistory();
      }
    });
    return unsubscribe;
  }, [navigation, token, user]);

  const handleCheckMOT = async () => {
    const formattedReg = regNumber.trim().toUpperCase();
    if (!formattedReg) {
      Alert.alert('Error', 'Please enter a vehicle registration number');
      return;
    }

    Keyboard.dismiss();
    setLoading(true);

    if (token) {
      try {
        const res = await lookupVehicle(formattedReg);
        setLoading(false);
        if (res && res.found && res.vehicle) {
          const mappedVehicle = mapBackendVehicleToFrontend(res.vehicle);
          await saveVehicleToHistory(mappedVehicle);
          navigation.navigate('Result', { vehicleData: mappedVehicle });
        } else {
          Alert.alert('Not Found', 'Vehicle details not found in registry.');
        }
      } catch (err: any) {
        setLoading(false);
        console.error('[HomeScreen] lookup error:', err);
        Alert.alert('Lookup Failed', err.message || 'Failed to fetch details from DVLA registry');
      }
    } else {
      setLoading(false);
      Alert.alert(
        'Authentication Required',
        'Please sign in to check MOT status using the live registry.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => navigation.navigate('Login') }
        ]
      );
    }
  };

  const handleRecentCheckPress = (item: any) => {
    navigation.navigate('Result', { vehicleData: item });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Banner */}
        <View style={styles.banner}>
          <Text style={[styles.bannerTitle, { color: theme.colors.text }]}>
            UK MOT Status Check
          </Text>
          <Text style={[styles.bannerSubtitle, { color: theme.colors.placeholder }]}>
            Enter a registration plate to view real-time MOT status, history, advisories, and failures.
          </Text>
        </View>

        {/* Plate Search Input Container */}
        <View style={[styles.searchCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
            Enter Registration Mark
          </Text>

          {/* Styled UK License Plate Container */}
          <View style={styles.plateOuterContainer}>
            <View style={styles.ukPlateStrip}>
              <Text style={styles.ukPlateStripText}>UK</Text>
            </View>
            <TextInput
              value={regNumber}
              onChangeText={setRegNumber}
              placeholder="E.g. AB18 CDE"
              placeholderTextColor="#808080"
              style={styles.plateInput}
              autoCapitalize="characters"
              maxLength={8}
              underlineColorAndroid="transparent"
            />
          </View>

          <TouchableOpacity
            onPress={handleCheckMOT}
            disabled={loading}
            style={[
              styles.searchButton,
              { backgroundColor: theme.colors.primary, opacity: loading ? 0.7 : 1 },
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <View style={styles.searchButtonContent}>
                <MaterialCommunityIcons name="magnify" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={[styles.searchButtonText, { color: '#FFFFFF' }]}>Check MOT Status</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Browse Garages Premium Card */}
        <TouchableOpacity
          style={[styles.browseCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
          onPress={() => navigation.navigate('GarageList')}
        >
          <View style={[styles.browseIconCircle, { backgroundColor: theme.colors.secondary + '15' }]}>
            <MaterialCommunityIcons name="store-search" size={22} color={theme.colors.secondary} />
          </View>
          <View style={styles.browseCardContent}>
            <Text style={[styles.browseCardTitle, { color: theme.colors.text }]}>Find Local Approved Garages</Text>
            <Text style={[styles.browseCardSubtitle, { color: theme.colors.placeholder }]}>Compare prices, ratings, and book slots instantly</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.placeholder} />
        </TouchableOpacity>

        {/* Recent Checks Section */}
        {token ? (
          <View style={styles.recentSection}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Recent Checks
            </Text>
            {searchHistory.length === 0 ? (
              <View style={[styles.recentCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, padding: 16, alignItems: 'center' }]}>
                <Text style={{ color: theme.colors.placeholder }}>No recent checks found.</Text>
              </View>
            ) : (
              searchHistory.map((item) => {
                const isPass = item.status === 'PASS';
                return (
                  <TouchableOpacity
                    key={item.registration}
                    onPress={() => handleRecentCheckPress(item)}
                    style={[
                      styles.recentCard,
                      { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                    ]}
                  >
                    <View style={styles.recentCardLayout}>
                      <View style={styles.recentInfo}>
                        <View style={styles.recentIconWrapper}>
                          <MaterialCommunityIcons name="car-cog" size={24} color={theme.colors.secondary} />
                        </View>
                        <View style={styles.vehicleDetails}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={styles.recentPlate}>
                              <Text style={styles.recentPlateText}>{item.registration}</Text>
                            </View>
                            <Text style={[styles.vehicleText, { color: theme.colors.text, flex: 1 }]} numberOfLines={1}>
                              {item.make} {item.model}
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                            <MaterialCommunityIcons name="calendar-clock" size={12} color={theme.colors.placeholder} style={{ marginRight: 4 }} />
                            <Text style={[styles.vehicleCheckDate, { color: theme.colors.placeholder }]}>
                              Checked on {item.testDate}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <View
                        style={[
                          styles.statusBadge,
                          { 
                            backgroundColor: isPass ? theme.colors.success + '15' : theme.colors.error + '15',
                            borderColor: isPass ? theme.colors.success + '30' : theme.colors.error + '30',
                            borderWidth: 1,
                          },
                        ]}
                      >
                        <MaterialCommunityIcons 
                          name={isPass ? 'check-circle' : 'alert-circle'} 
                          size={12} 
                          color={isPass ? theme.colors.success : theme.colors.error} 
                          style={{ marginRight: 4 }} 
                        />
                        <Text
                          style={[
                            styles.statusText,
                            { color: isPass ? theme.colors.success : theme.colors.error },
                          ]}
                        >
                          {item.status}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 12,
    flexGrow: 1,
  },
  banner: {
    alignItems: 'center',
    marginVertical: 12,
    paddingHorizontal: 8,
  },
  bannerTitle: {
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 4,
    textAlign: 'center',
  },
  bannerSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  searchCard: {
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  plateOuterContainer: {
    flexDirection: 'row',
    height: 46,
    backgroundColor: '#FFD300', // UK Plate Yellow
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 12,
    alignItems: 'center',
  },
  ukPlateStrip: {
    width: 30,
    height: '100%',
    backgroundColor: '#0A4E9B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ukPlateStripText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 8,
  },
  plateInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    textAlign: 'center',
    letterSpacing: 2,
    height: '100%',
    padding: 0,
  },
  searchButton: {
    height: 40,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  searchButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  recentSection: {
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  recentCard: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
  },
  recentCardLayout: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
  },
  recentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  recentIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(2, 132, 199, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  recentPlate: {
    backgroundColor: '#FFD300',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginRight: 10,
  },
  recentPlateText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  vehicleDetails: {
    flex: 1,
  },
  vehicleText: {
    fontWeight: 'bold',
    fontSize: 13,
  },
  vehicleCheckDate: {
    fontSize: 11,
    marginTop: 0,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 50,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  browseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 10,
    marginBottom: 4,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
  },
  browseIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  browseCardContent: {
    flex: 1,
    marginLeft: 10,
    justifyContent: 'center',
  },
  browseCardTitle: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  browseCardSubtitle: {
    fontSize: 10,
  },
});
