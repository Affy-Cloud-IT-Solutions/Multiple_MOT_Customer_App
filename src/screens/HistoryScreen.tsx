import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text, Alert, ActivityIndicator, SafeAreaView } from 'react-native';
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

export default function HistoryScreen({ navigation }: any) {
  const { theme } = useAppTheme();
  const { token, lookupVehicle, user } = useAppValues();
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

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (token) {
        loadSearchHistory();
      }
    });
    return unsubscribe;
  }, [navigation, token, user]);

  if (!token) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <MaterialCommunityIcons name="account-lock-outline" size={72} color={theme.colors.placeholder} style={{ marginBottom: 16 }} />
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.colors.text, marginBottom: 8, textAlign: 'center' }}>
          Access Search History
        </Text>
        <Text style={{ fontSize: 13, color: theme.colors.placeholder, textAlign: 'center', marginBottom: 24, paddingHorizontal: 20, lineHeight: 18 }}>
          Please sign in to view your recent vehicle search history and MOT checks.
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

  const handleCardPress = (item: any) => {
    navigation.navigate('Result', { vehicleData: item, fromHistory: true });
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {loading && (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      )}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          <MaterialCommunityIcons name="history" size={22} color={theme.colors.primary} style={{ marginRight: 6 }} />
          <Text style={[styles.title, { color: theme.colors.text, marginBottom: 0 }]}>
            Search History
          </Text>
        </View>
        <Text style={[styles.subtitle, { color: theme.colors.placeholder }]}>
          Select a vehicle from your recent searches to view MOT details
        </Text>
      </View>

      <View style={styles.listContainer}>
        {searchHistory.length === 0 ? (
          <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, padding: 24, alignItems: 'center' }]}>
            <Text style={{ color: theme.colors.placeholder }}>No recent checks found.</Text>
          </View>
        ) : (
          searchHistory.map((item) => {
            const isPass = item.status === 'PASS';
            return (
              <TouchableOpacity
                key={item.registration}
                style={[
                  styles.card,
                  { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                ]}
                onPress={() => handleCardPress(item)}
              >
                <View style={styles.cardContent}>
                  <View style={styles.leftContainer}>
                    <View style={styles.historyIconWrapper}>
                      <MaterialCommunityIcons name="car-sports" size={22} color={theme.colors.secondary} />
                    </View>
                    <View style={styles.vehicleDetails}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                        <View style={styles.plate}>
                          <View style={styles.ukStrip}>
                            <Text style={styles.ukText}>UK</Text>
                          </View>
                          <Text style={styles.plateText}>{item.registration}</Text>
                        </View>
                        <Text style={[styles.makeModelText, { color: theme.colors.text }]} numberOfLines={1}>
                          {item.make} {item.model}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <MaterialCommunityIcons name="calendar-clock" size={12} color={theme.colors.placeholder} style={{ marginRight: 4 }} />
                        <Text style={[styles.dateText, { color: theme.colors.placeholder }]}>
                          Checked on {item.testDate}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Status Badging */}
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
                      size={13}
                      color={isPass ? theme.colors.success : theme.colors.error}
                      style={styles.statusIcon}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 11,
    lineHeight: 15,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  card: {
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  cardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  historyIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(2, 132, 199, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  plate: {
    flexDirection: 'row',
    height: 22,
    backgroundColor: '#FFD300',
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: 4,
    overflow: 'hidden',
    alignSelf: 'flex-start',
    alignItems: 'center',
    marginRight: 8,
  },
  ukStrip: {
    width: 14,
    height: '100%',
    backgroundColor: '#0A4E9B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ukText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 5,
  },
  plateText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000000',
    paddingHorizontal: 6,
    letterSpacing: 0.5,
  },
  vehicleDetails: {
    flex: 1,
    paddingLeft: 2,
  },
  makeModelText: {
    fontWeight: 'bold',
    fontSize: 13,
    marginRight: 4,
  },
  dateText: {
    fontSize: 11,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'center',
  },
  statusIcon: {
    marginRight: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  loaderContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
});

