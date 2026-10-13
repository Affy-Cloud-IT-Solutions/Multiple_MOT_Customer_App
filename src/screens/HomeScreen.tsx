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
  RefreshControl,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues } from '../context/DataContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestUserLiveLocation, isWithinUKBoundary, Coordinates } from '../utils/mapUtils';
import CustomerHeader from '../components/CustomerHeader';

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

const BOOKABLE_SERVICES = [
  {
    id: 'mot_class_4',
    title: 'MOT Test',
    subtitle: 'Class 4 inspection',
    icon: 'shield-check',
    iconBg: '#10B98115',
    iconColor: '#10B981',
    searchQuery: 'MOT',
  },
  {
    id: 'full_service',
    title: 'Full Service',
    subtitle: '50+ point check',
    icon: 'car-cog',
    iconBg: '#1677FF15',
    iconColor: '#1677FF',
    searchQuery: 'Full Service',
  },
  {
    id: 'interim_service',
    title: 'Interim Service',
    subtitle: 'Oil & filter refresh',
    icon: 'oil',
    iconBg: '#8B5CF615',
    iconColor: '#8B5CF6',
    searchQuery: 'Interim Service',
  },
  {
    id: 'brakes',
    title: 'Brakes & Discs',
    subtitle: 'Pads & discs check',
    icon: 'car-brake-alert',
    iconBg: '#EF444415',
    iconColor: '#EF4444',
    searchQuery: 'Brake',
  },
  {
    id: 'tyres',
    title: 'Tyres & Tracking',
    subtitle: 'Fitting & laser tracking',
    icon: 'tire',
    iconBg: '#F59E0B15',
    iconColor: '#F59E0B',
    searchQuery: 'Tyre',
  },
  {
    id: 'diagnostics',
    title: 'Diagnostics Scan',
    subtitle: 'ECU fault code check',
    icon: 'engine',
    iconBg: '#06B6D415',
    iconColor: '#06B6D4',
    searchQuery: 'Diagnostic',
  },
  {
    id: 'air_con',
    title: 'Air Con Regas',
    subtitle: 'Refrigerant recharge',
    icon: 'snowflake',
    iconBg: '#3B82F615',
    iconColor: '#3B82F6',
    searchQuery: 'Air Conditioning',
  },
  {
    id: 'repairs',
    title: 'General Repairs',
    subtitle: 'Clutch, exhaust & fixes',
    icon: 'wrench',
    iconBg: '#EC489915',
    iconColor: '#EC4899',
    searchQuery: 'Repair',
  },
];

export default function HomeScreen({ navigation }: any) {
  const { theme } = useAppTheme();
  const { token, vehicles, refreshData, lookupVehicle, user } = useAppValues();
  const [regNumber, setRegNumber] = useState('');
  const [garageSearchText, setGarageSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchHistory, setSearchHistory] = useState<any[]>([]);
  const [userCoords, setUserCoords] = useState<Coordinates | null>(null);

  const handleRefreshAndReset = async () => {
    setRefreshing(true);
    // Reset all search inputs on pull to reload
    setRegNumber('');
    setGarageSearchText('');
    try {
      if (token) {
        await refreshData();
      }
      await loadSearchHistory();
      const coords = await requestUserLiveLocation();
      if (coords) {
        setUserCoords(coords);
      }
    } catch (e) {
      console.error('Home refresh error:', e);
    } finally {
      setRefreshing(false);
    }
  };

  const loadSearchHistory = async () => {
    try {
      const historyKey = user?.id ? `@search_history_${user.id}` : '@search_history_guest';
      const historyStr = await AsyncStorage.getItem(historyKey);
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
    try {
      const historyKey = user?.id ? `@search_history_${user.id}` : '@search_history_guest';
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
    requestUserLiveLocation().then((coords) => {
      if (coords) {
        setUserCoords(coords);
      }
    });
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (token) {
        refreshData();
      }
      loadSearchHistory();
      requestUserLiveLocation().then((coords) => {
        if (coords) {
          setUserCoords(coords);
        }
      });
    });
    loadSearchHistory();
    return unsubscribe;
  }, [navigation, token, user]);

  const handleCheckMOT = async (overrideReg?: string) => {
    const targetReg = (overrideReg || regNumber).trim().toUpperCase();
    if (!targetReg) {
      Alert.alert('Registration Required', 'Please enter a valid UK vehicle registration mark (e.g. AB18 CDE).');
      return;
    }

    Keyboard.dismiss();
    setLoading(true);

    try {
      const res = await lookupVehicle(targetReg);
      setLoading(false);
      if (res && res.found && res.vehicle) {
        const mappedVehicle = mapBackendVehicleToFrontend(res.vehicle);
        await saveVehicleToHistory(mappedVehicle);
        navigation.navigate('Result', { vehicleData: mappedVehicle });
      } else {
        Alert.alert('Not Found', `Vehicle registration "${targetReg}" was not found in the DVLA registry.`);
      }
    } catch (err: any) {
      setLoading(false);
      console.error('[HomeScreen] lookup error:', err);
      Alert.alert('Lookup Failed', err.message || 'Failed to fetch details from DVLA registry. Please verify the registration.');
    }
  };

  const handleRecentCheckPress = (item: any) => {
    navigation.navigate('Result', { vehicleData: item });
  };

  const handleSearchGarages = () => {
    Keyboard.dismiss();
    const query = garageSearchText.trim();
    navigation.navigate('Garages', { searchQuery: query });
  };

  const handleSelectService = (service: typeof BOOKABLE_SERVICES[0]) => {
    navigation.navigate('Garages', {
      serviceFilter: service.searchQuery,
      searchQuery: service.searchQuery,
      serviceTitle: service.title,
    });
  };

  const userVehicles = vehicles || [];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Customer Header with Great UI */}
      <CustomerHeader
        title={user?.name ? `Hi, ${user.name.split(' ')[0]}` : 'MOT Search'}
        subtitle="UK Vehicle Check & Garage Network"
        iconName="magnify"
        iconColor={theme.colors.secondary}
        iconBg={theme.colors.secondary + '15'}
        rightAction={
          <TouchableOpacity
            onPress={() => navigation.navigate(token ? 'Profile' : 'Login')}
            style={[styles.topProfileBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons 
              name={token ? 'account-check' : 'account-circle-outline'} 
              size={20} 
              color={theme.colors.secondary} 
            />
          </TouchableOpacity>
        }
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefreshAndReset}
              colors={[theme.colors.secondary, theme.colors.primary]}
              tintColor={theme.colors.secondary}
            />
          }
        >

        {/* 1. Live Location & Region Status Banner */}
        {userCoords && (() => {
          const isUK = isWithinUKBoundary(userCoords);
          return (
            <TouchableOpacity
              style={[
                styles.locationStatusBar,
                {
                  backgroundColor: isUK ? '#10B98112' : '#EF444412',
                  borderColor: isUK ? '#10B98135' : '#EF444435',
                },
              ]}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Garages', { nearMe: true })}
            >
              <View style={[styles.pulseDot, { backgroundColor: isUK ? '#10B981' : '#EF4444' }]} />
              <Text
                style={[
                  styles.locationStatusText,
                  { color: isUK ? '#059669' : '#2563EB' },
                ]}
                numberOfLines={1}
              >
                {`📍 Live Location • ${userCoords.label || userCoords.cityName || 'Current Area'}`}
              </Text>
              <View style={[styles.locationBadge, { backgroundColor: isUK ? '#10B98120' : '#3B82F620' }]}>
                <Text style={[styles.locationBadgeText, { color: isUK ? '#059669' : '#2563EB' }]}>
                  Garages Near Me
                </Text>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={14}
                  color={isUK ? '#059669' : '#2563EB'}
                />
              </View>
            </TouchableOpacity>
          );
        })()}

        {/* 2. Instant Vehicle MOT Lookup Card (Fast registration plate lookup) */}
        <View style={[styles.heroSearchCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.cardHeaderIconWrap, { backgroundColor: theme.colors.secondary + '15' }]}>
              <MaterialCommunityIcons name="card-search-outline" size={20} color={theme.colors.secondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardHeaderTitle, { color: theme.colors.text }]}>
                Instant Vehicle MOT Lookup
              </Text>
              <Text style={[styles.cardHeaderSub, { color: theme.colors.placeholder }]}>
                Live DVSA registry data & MOT history
              </Text>
            </View>
          </View>

          {/* Authentic UK Registration Plate Input */}
          <View style={styles.plateWrapper}>
            <View style={styles.plateShadowBase}>
              <View style={styles.ukPlateStrip}>
                <Text style={styles.ukFlagSymbol}>🇬🇧</Text>
                <Text style={styles.ukPlateStripText}>UK</Text>
              </View>
              <TextInput
                value={regNumber}
                onChangeText={(txt) => setRegNumber(txt.toUpperCase())}
                placeholder="eg AB19 CDE"
                placeholderTextColor="#6B7280"
                style={styles.plateInput}
                autoCapitalize="characters"
                maxLength={8}
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={() => handleCheckMOT()}
              />
              {regNumber.length > 0 && (
                <TouchableOpacity onPress={() => setRegNumber('')} style={styles.plateClearBtn}>
                  <MaterialCommunityIcons name="close-circle" size={20} color="#374151" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Quick Demo Registration Chips */}
          <View style={styles.quickTagsContainer}>
            <Text style={[styles.quickTagsLabel, { color: theme.colors.placeholder }]}>Examples:</Text>
            {['AB18 CDE', 'LD65 XYZ', 'MH07 KKK'].map((sample) => (
              <TouchableOpacity
                key={sample}
                onPress={() => {
                  setRegNumber(sample);
                  handleCheckMOT(sample);
                }}
                style={[styles.sampleChip, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
              >
                <Text style={[styles.sampleChipText, { color: theme.colors.text }]}>{sample}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Lookup Button */}
          <TouchableOpacity
            onPress={() => handleCheckMOT()}
            disabled={loading}
            activeOpacity={0.85}
            style={[
              styles.primarySearchBtn,
              { backgroundColor: theme.colors.secondary, opacity: loading ? 0.75 : 1 },
            ]}
          >
            {loading ? (
              <View style={styles.btnLoadingRow}>
                <ActivityIndicator color="#FFFFFF" size="small" style={{ marginRight: 8 }} />
                <Text style={styles.primarySearchBtnText}>Connecting to DVLA Database...</Text>
              </View>
            ) : (
              <View style={styles.btnContentRow}>
                <MaterialCommunityIcons name="magnify" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.primarySearchBtnText}>Check MOT Expiry & Details</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* 3. Book a Service Catalog (Enlarged Icons & Clickable Flow) */}
        <View style={styles.servicesSectionWrap}>
          <View style={styles.servicesSectionHeader}>
            <View style={styles.servicesHeaderTitleRow}>
              <Text style={[styles.servicesSectionTitle, { color: theme.colors.text }]}>
                Select a Service
              </Text>
              <View style={[styles.tapHintBadge, { backgroundColor: theme.colors.primary + '12' }]}>
                <MaterialCommunityIcons name="cursor-default-click-outline" size={12} color={theme.colors.primary} style={{ marginRight: 4 }} />
                <Text style={[styles.tapHintText, { color: theme.colors.primary }]}>Tap to Book</Text>
              </View>
            </View>
            <Text style={[styles.servicesSectionSub, { color: theme.colors.placeholder }]}>
              Swipe & tap a service to find verified garages
            </Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.servicesHorizontalScroll}
          >
            {BOOKABLE_SERVICES.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.horizontalServiceItem}
                activeOpacity={0.65}
                onPress={() => handleSelectService(item)}
              >
                <View style={[styles.enlargedIconCircle, { backgroundColor: item.iconBg, borderColor: item.iconColor + '35' }]}>
                  <MaterialCommunityIcons name={item.icon} size={28} color={item.iconColor} />
                  <View style={[styles.iconActionBadge, { backgroundColor: item.iconColor, borderColor: theme.colors.background }]}>
                    <MaterialCommunityIcons name="arrow-right" size={10} color="#FFFFFF" />
                  </View>
                </View>

                <Text style={[styles.horizontalServiceTitle, { color: theme.colors.text }]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={[styles.horizontalServiceSubtitle, { color: theme.colors.placeholder }]} numberOfLines={1}>
                  {item.subtitle}
                </Text>

                <View style={[styles.selectPill, { backgroundColor: item.iconBg, borderColor: item.iconColor + '30' }]}>
                  <Text style={[styles.selectPillText, { color: item.iconColor }]}>Select</Text>
                  <MaterialCommunityIcons name="chevron-right" size={11} color={item.iconColor} />
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* 4. Garage Finder Quick Search Bar */}
        <View style={[styles.garageSearchCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.cardHeaderIconWrap, { backgroundColor: '#10B98115' }]}>
              <MaterialCommunityIcons name="map-search-outline" size={20} color="#10B981" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardHeaderTitle, { color: theme.colors.text }]}>
                Find Local MOT Test Centres
              </Text>
              <Text style={[styles.cardHeaderSub, { color: theme.colors.placeholder }]}>
                Search by garage name, town, or UK postcode
              </Text>
            </View>
          </View>

          <View style={[styles.garageSearchInputWrapper, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
            <MaterialCommunityIcons name="magnify" size={20} color={theme.colors.placeholder} style={{ marginRight: 8 }} />
            <TextInput
              value={garageSearchText}
              onChangeText={setGarageSearchText}
              placeholder="e.g. Apex Autos, Manchester, M1..."
              placeholderTextColor={theme.colors.placeholder}
              style={[styles.garageSearchInput, { color: theme.colors.text }]}
              returnKeyType="search"
              onSubmitEditing={handleSearchGarages}
            />
            {garageSearchText.length > 0 && (
              <TouchableOpacity onPress={() => setGarageSearchText('')} style={{ padding: 4, marginRight: 4 }}>
                <MaterialCommunityIcons name="close-circle" size={18} color={theme.colors.placeholder} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.garageBtnRow}>
            <TouchableOpacity
              onPress={handleSearchGarages}
              activeOpacity={0.8}
              style={[styles.garagePrimaryBtn, { backgroundColor: theme.colors.secondary }]}
            >
              <MaterialCommunityIcons name="magnify" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.garagePrimaryBtnText}>Search Garages</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                Keyboard.dismiss();
                navigation.navigate('Garages', { nearMe: true });
              }}
              activeOpacity={0.8}
              style={styles.garageNearMeBtn}
            >
              <MaterialCommunityIcons name="crosshairs-gps" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.garageNearMeBtnText}>Near Me</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 5. Core Navigation Hub Grid (4 Action Boxes) */}
        <View style={styles.quickGrid}>
          {/* Card 1: Book MOT Slot */}
          <TouchableOpacity
            style={[styles.quickHubCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
            activeOpacity={0.8}
            onPress={() => {
              if (token) {
                navigation.navigate('My Portal');
              } else {
                Alert.alert('Sign In Required', 'Please sign in to book your MOT appointment.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Sign In', onPress: () => navigation.navigate('Login') }
                ]);
              }
            }}
          >
            <View style={[styles.quickHubIconCircle, { backgroundColor: '#1677FF18' }]}>
              <MaterialCommunityIcons name="calendar-plus" size={22} color="#1677FF" />
            </View>
            <View style={styles.quickHubTextContainer}>
              <View style={styles.badgeInlineRow}>
                <Text style={[styles.quickHubTitle, { color: theme.colors.text }]}>Book MOT</Text>
                <View style={[styles.miniPill, { backgroundColor: '#1677FF18' }]}>
                  <Text style={[styles.miniPillText, { color: '#1677FF' }]}>30-Day</Text>
                </View>
              </View>
              <Text style={[styles.quickHubDesc, { color: theme.colors.placeholder }]}>
                Schedule certified test slot
              </Text>
            </View>
          </TouchableOpacity>

          {/* Card 2: My Vehicles */}
          <TouchableOpacity
            style={[styles.quickHubCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
            activeOpacity={0.8}
            onPress={() => {
              if (token) {
                navigation.navigate('My Portal', { initialTab: 'home' });
              } else {
                Alert.alert('Sign In Required', 'Please sign in to access your garage portal.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Sign In', onPress: () => navigation.navigate('Login') }
                ]);
              }
            }}
          >
            <View style={[styles.quickHubIconCircle, { backgroundColor: '#8B5CF618' }]}>
              <MaterialCommunityIcons name="car-multiple" size={22} color="#8B5CF6" />
            </View>
            <View style={styles.quickHubTextContainer}>
              <View style={styles.badgeInlineRow}>
                <Text style={[styles.quickHubTitle, { color: theme.colors.text }]}>My Vehicles</Text>
                {userVehicles.length > 0 && (
                  <View style={[styles.miniPill, { backgroundColor: '#8B5CF618' }]}>
                    <Text style={[styles.miniPillText, { color: '#8B5CF6' }]}>{userVehicles.length}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.quickHubDesc, { color: theme.colors.placeholder }]}>
                Track live MOT expiries
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.quickGrid}>
          {/* Card 3: Find Garages */}
          <TouchableOpacity
            style={[styles.quickHubCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Garages')}
          >
            <View style={[styles.quickHubIconCircle, { backgroundColor: '#10B98118' }]}>
              <MaterialCommunityIcons name="store-search" size={22} color="#10B981" />
            </View>
            <View style={styles.quickHubTextContainer}>
              <View style={styles.badgeInlineRow}>
                <Text style={[styles.quickHubTitle, { color: theme.colors.text }]}>Garages</Text>
                <View style={[styles.miniPill, { backgroundColor: '#10B98118' }]}>
                  <Text style={[styles.miniPillText, { color: '#10B981' }]}>Verified</Text>
                </View>
              </View>
              <Text style={[styles.quickHubDesc, { color: theme.colors.placeholder }]}>
                Compare prices & ratings
              </Text>
            </View>
          </TouchableOpacity>

          {/* Card 4: My Bookings (Opens Customer Vehicle Booking History Tab) */}
          <TouchableOpacity
            style={[styles.quickHubCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
            activeOpacity={0.8}
            onPress={() => {
              if (token) {
                navigation.navigate('My Portal', { initialTab: 'history' });
              } else {
                Alert.alert('Sign In Required', 'Please sign in to view and manage your booked MOT slots.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Sign In', onPress: () => navigation.navigate('Login') }
                ]);
              }
            }}
          >
            <View style={[styles.quickHubIconCircle, { backgroundColor: '#F59E0B18' }]}>
              <MaterialCommunityIcons name="calendar-check" size={22} color="#F59E0B" />
            </View>
            <View style={styles.quickHubTextContainer}>
              <View style={styles.badgeInlineRow}>
                <Text style={[styles.quickHubTitle, { color: theme.colors.text }]}>My Bookings</Text>
                <View style={[styles.miniPill, { backgroundColor: '#F59E0B18' }]}>
                  <Text style={[styles.miniPillText, { color: '#F59E0B' }]}>History</Text>
                </View>
              </View>
              <Text style={[styles.quickHubDesc, { color: theme.colors.placeholder }]}>
                Vehicle bookings history
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* 8. Recent Search History */}
        {token && (
          <View style={styles.recentSectionWrap}>
            <View style={styles.recentHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="history" size={18} color={theme.colors.secondary} style={{ marginRight: 6 }} />
                <Text style={[styles.recentSectionTitle, { color: theme.colors.text }]}>
                  Recent Checks
                </Text>
              </View>
              {searchHistory.length > 0 && (
                <TouchableOpacity onPress={() => navigation.navigate('Bookings')}>
                  <Text style={[styles.viewAllText, { color: theme.colors.secondary }]}>View All ({searchHistory.length})</Text>
                </TouchableOpacity>
              )}
            </View>

            {searchHistory.length === 0 ? (
              <View style={[styles.emptyHistoryCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <MaterialCommunityIcons name="car-search-outline" size={32} color={theme.colors.placeholder} style={{ marginBottom: 6 }} />
                <Text style={{ color: theme.colors.placeholder, fontSize: 13 }}>No recent vehicle checks recorded.</Text>
                <Text style={{ color: theme.colors.placeholder, fontSize: 11, marginTop: 2 }}>Searched registrations will appear here for quick access.</Text>
              </View>
            ) : (
              searchHistory.slice(0, 5).map((item) => {
                const isPass = item.status === 'PASS';
                const daysDiff = (() => {
                  if (!item.expiryDate || item.expiryDate === 'N/A') return null;
                  const d = new Date(item.expiryDate);
                  if (isNaN(d.getTime())) return null;
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                })();

                return (
                  <TouchableOpacity
                    key={item.registration}
                    onPress={() => handleRecentCheckPress(item)}
                    activeOpacity={0.8}
                    style={[
                      styles.recentCard,
                      { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                    ]}
                  >
                    <View style={styles.recentCardLayout}>
                      {/* Left: Mini UK Plate */}
                      <View style={styles.recentPlateWrapper}>
                        <View style={styles.recentPlateGbStrip}>
                          <Text style={styles.recentPlateGbText}>UK</Text>
                        </View>
                        <Text style={styles.recentPlateRegText}>{item.registration}</Text>
                      </View>

                      {/* Middle: Vehicle details */}
                      <View style={styles.recentVehicleDetails}>
                        <Text style={[styles.recentVehicleTitle, { color: theme.colors.text }]} numberOfLines={1}>
                          {item.make} {item.model}
                        </Text>
                        
                        {item.expiryDate && (
                          <View style={styles.recentExpiryRow}>
                            <MaterialCommunityIcons name="calendar-clock" size={13} color={theme.colors.placeholder} style={{ marginRight: 4 }} />
                            <Text style={[styles.recentExpiryText, { color: theme.colors.placeholder }]} numberOfLines={1}>
                              MOT: {item.expiryDate}{' '}
                              {daysDiff !== null && (
                                <Text style={{ color: daysDiff <= 30 ? (daysDiff <= 7 ? '#EF4444' : '#F59E0B') : '#10B981', fontWeight: 'bold' }}>
                                  ({daysDiff >= 0 ? `${daysDiff} days left` : `${Math.abs(daysDiff)} days ago`})
                                </Text>
                              )}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Right: Status badge & arrow */}
                      <View style={styles.recentStatusWrapper}>
                        <View
                          style={[
                            styles.statusBadge,
                            { 
                              backgroundColor: isPass ? '#10B98118' : '#EF444418',
                              borderColor: isPass ? '#10B98140' : '#EF444440',
                            },
                          ]}
                        >
                          <MaterialCommunityIcons 
                            name={isPass ? 'check-circle' : 'alert-circle'} 
                            size={12} 
                            color={isPass ? '#10B981' : '#EF4444'} 
                            style={{ marginRight: 3 }} 
                          />
                          <Text
                            style={[
                              styles.statusText,
                              { color: isPass ? '#10B981' : '#EF4444' },
                            ]}
                          >
                            {item.status}
                          </Text>
                        </View>
                        <MaterialCommunityIcons name="chevron-right" size={18} color={theme.colors.placeholder} style={{ marginTop: 4 }} />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  topDashboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dvsaNetworkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 4,
  },
  dvsaNetworkPillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  dashboardGreeting: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  topProfileBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  locationStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  locationStatusText: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 6,
  },
  locationBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    marginRight: 2,
  },
  motSummaryCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  motSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  motSummaryTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  fleetCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  fleetCountText: {
    fontSize: 11,
    fontWeight: '800',
  },
  motMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  metricCol: {
    alignItems: 'center',
    flex: 1,
  },
  metricNumber: {
    fontSize: 18,
    fontWeight: '900',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    height: 24,
  },
  quickGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  quickHubCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 13,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  quickHubIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  quickHubTextContainer: {
    flex: 1,
  },
  badgeInlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  quickHubTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  miniPill: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  miniPillText: {
    fontSize: 9,
    fontWeight: '800',
  },
  quickHubDesc: {
    fontSize: 11,
    lineHeight: 14,
  },
  heroSearchCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    marginTop: 6,
    marginBottom: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardHeaderIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  cardHeaderSub: {
    fontSize: 11,
    marginTop: 1,
  },
  plateWrapper: {
    marginBottom: 10,
  },
  plateShadowBase: {
    flexDirection: 'row',
    height: 52,
    backgroundColor: '#FFD200', // UK Reflective Yellow
    borderWidth: 2,
    borderColor: '#111827',
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  ukPlateStrip: {
    width: 36,
    height: '100%',
    backgroundColor: '#003399', // European / UK Blue
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 2,
  },
  ukFlagSymbol: {
    fontSize: 11,
    lineHeight: 13,
  },
  ukPlateStripText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 9,
    letterSpacing: 0.5,
  },
  plateInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
    textAlign: 'center',
    letterSpacing: 2.5,
    height: '100%',
    paddingHorizontal: 8,
  },
  plateClearBtn: {
    paddingHorizontal: 10,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickTagsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  quickTagsLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginRight: 2,
  },
  sampleChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  sampleChipText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  primarySearchBtn: {
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#1677FF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  btnContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  btnLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  primarySearchBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  garageSearchCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    marginBottom: 14,
  },
  garageSearchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  garageSearchInput: {
    flex: 1,
    fontSize: 13,
    height: '100%',
    paddingVertical: 0,
  },
  garageBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  garagePrimaryBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  garagePrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  garageNearMeBtn: {
    height: 42,
    paddingHorizontal: 16,
    backgroundColor: '#10B981',
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  garageNearMeBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  servicesSectionWrap: {
    marginBottom: 16,
  },
  servicesSectionHeader: {
    marginBottom: 12,
  },
  servicesHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  servicesSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  tapHintBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  tapHintText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  servicesSectionSub: {
    fontSize: 12,
    marginTop: 2,
  },
  servicesHorizontalScroll: {
    paddingRight: 8,
    gap: 14,
    paddingVertical: 4,
  },
  horizontalServiceItem: {
    width: 88,
    alignItems: 'center',
  },
  enlargedIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1.5,
    position: 'relative',
  },
  iconActionBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  horizontalServiceTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 2,
  },
  horizontalServiceSubtitle: {
    fontSize: 10,
    textAlign: 'center',
  },
  selectPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 5,
  },
  selectPillText: {
    fontSize: 9.5,
    fontWeight: '800',
    marginRight: 1,
  },
  recentSectionWrap: {
    marginBottom: 10,
  },
  recentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recentSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyHistoryCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
  },
  recentCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
  },
  recentCardLayout: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recentPlateWrapper: {
    flexDirection: 'row',
    backgroundColor: '#FFD200',
    borderWidth: 1.2,
    borderColor: '#111827',
    borderRadius: 5,
    overflow: 'hidden',
    height: 30,
    alignItems: 'center',
    marginRight: 10,
  },
  recentPlateGbStrip: {
    width: 14,
    height: '100%',
    backgroundColor: '#003399',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recentPlateGbText: {
    color: '#FFFFFF',
    fontSize: 6,
    fontWeight: '900',
  },
  recentPlateRegText: {
    color: '#111827',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    paddingHorizontal: 6,
  },
  recentVehicleDetails: {
    flex: 1,
    marginRight: 6,
  },
  recentVehicleTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  recentExpiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  recentExpiryText: {
    fontSize: 11,
  },
  recentStatusWrapper: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
});
