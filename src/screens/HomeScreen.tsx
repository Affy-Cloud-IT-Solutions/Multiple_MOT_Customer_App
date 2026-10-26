import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Image,
  FlatList,
  Animated,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues, BASE_URL } from '../context/DataContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  requestUserLiveLocation,
  isWithinUKBoundary,
  Coordinates,
  calculateDistanceInMiles,
  UK_PRESET_LOCATIONS,
  formatPreciseLocation,
} from '../utils/mapUtils';
import CustomerHeader from '../components/CustomerHeader';
import SelectAreaBottomSheet from '../components/SelectAreaBottomSheet';

const getUserInitials = (name?: string, email?: string) => {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email && email.trim()) {
    return email.trim().slice(0, 2).toUpperCase();
  }
  return 'G';
};

const mapBackendVehicleToFrontend = (v: any) => {
  const isPass = v.motStatus === 'Valid' || v.status === 'PASS' || v.status === 'Active';
  
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    const clean = String(dateStr).trim();
    if (!clean || clean === 'N/A') return 'N/A';

    let normalized = clean.replace(/\./g, '-');
    if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(normalized)) {
      normalized = normalized.replace(/\s+/, 'T');
    }

    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const date = new Date(normalized);
    if (!isNaN(date.getTime())) {
      return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
    }

    const isoMatch = clean.match(/^(\d{4})[.-](\d{1,2})[.-](\d{1,2})/);
    if (isoMatch) {
      const yr = isoMatch[1];
      const mIdx = parseInt(isoMatch[2], 10) - 1;
      const day = parseInt(isoMatch[3], 10);
      if (mIdx >= 0 && mIdx < 12) {
        return `${day} ${months[mIdx]} ${yr}`;
      }
    }
    return clean;
  };

  const formatMileage = (val: any) => {
    if (!val || val === 'N/A' || val === '0') return 'Unrecorded';
    const str = String(val).trim();
    const num = parseInt(str.replace(/[^0-9]/g, ''), 10);
    if (isNaN(num)) return str;
    const isKm = str.toLowerCase().includes('km');
    return `${num.toLocaleString()} ${isKm ? 'km' : 'miles'}`;
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
    registrationNumber: regUpper,
    make: v.make || '',
    model: v.model || '',
    year: v.year ? String(v.year) : '',
    color: v.color || 'Grey',
    fuelType: v.fuelType || 'Petrol',
    engineSize: v.engineSize || '1500cc',
    status: isPass ? 'PASS' : 'FAIL',
    motStatus: v.motStatus || (isPass ? 'Valid' : 'Expired'),
    motExpiryDate: v.motExpiryDate || v.expiryDate || '',
    expiryDate: formatDate(v.motExpiryDate || v.expiryDate),
    lastServiceDate: v.lastServiceDate || v.testDate || '',
    testDate: formatDate(v.lastServiceDate || v.testDate || new Date().toISOString().split('T')[0]),
    testNumber: v.testNumber || '8910 2345 6789',
    mileage: formatMileage(v.mileage || (v.motTests && v.motTests[0]?.odometerValue ? `${v.motTests[0].odometerValue} ${v.motTests[0].odometerUnit || 'mi'}` : '45,000 miles')),
    advisories,
    failures,
    motTests: v.motTests || null
  };
};

interface BookableServiceItem {
  id: string;
  title: string;
  name: string;
  category: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  searchQuery: string;
  price: number;
  duration: number;
  description?: string;
  garageCount?: number;
}

const DEFAULT_BOOKABLE_SERVICES: BookableServiceItem[] = [
  {
    id: 'cat_mot',
    title: 'MOT',
    name: 'MOT',
    category: 'MOT',
    icon: 'shield-check',
    iconBg: '#10B98115',
    iconColor: '#10B981',
    searchQuery: 'MOT',
    price: 45,
    duration: 45,
    description: 'Annual DVSA Class 4 vehicle safety & roadworthiness inspection',
  },
  {
    id: 'cat_servicing',
    title: 'Servicing',
    name: 'Servicing',
    category: 'Servicing',
    icon: 'car-cog',
    iconBg: '#1677FF15',
    iconColor: '#1677FF',
    searchQuery: 'Servicing',
    price: 79,
    duration: 60,
    description: 'Full, interim and major scheduled vehicle servicing',
  },
  {
    id: 'cat_tyres',
    title: 'Tyres',
    name: 'Tyres',
    category: 'Tyres',
    icon: 'tire',
    iconBg: '#F59E0B15',
    iconColor: '#F59E0B',
    searchQuery: 'Tyres',
    price: 65,
    duration: 45,
    description: 'Tyre fitting, puncture repairs, balancing and wheel alignment',
  },
  {
    id: 'cat_repairs',
    title: 'Repairs',
    name: 'Repairs',
    category: 'Repairs',
    icon: 'hammer-wrench',
    iconBg: '#EC489915',
    iconColor: '#EC4899',
    searchQuery: 'Repairs',
    price: 65,
    duration: 60,
    description: 'Mechanical diagnostics, brakes, suspension and general repairs',
  },
];

const resolveServiceIcon = (name: string = '', category: string = '') => {
  const s = `${name} ${category}`.toLowerCase();
  if (/\bmot\b/i.test(s)) return { icon: 'shield-check', iconColor: '#10B981', iconBg: '#10B98115' };
  if (s.includes('full')) return { icon: 'car-cog', iconColor: '#1677FF', iconBg: '#1677FF15' };
  if (s.includes('interim') || s.includes('oil')) return { icon: 'oil', iconColor: '#8B5CF6', iconBg: '#8B5CF615' };
  if (s.includes('major')) return { icon: 'car-wrench', iconColor: '#D97706', iconBg: '#F59E0B15' };
  if (s.includes('brake') || s.includes('pad') || s.includes('disc')) return { icon: 'car-brake-alert', iconColor: '#EF4444', iconBg: '#EF444415' };
  if (s.includes('tyre') || s.includes('tire') || s.includes('track') || s.includes('wheel') || s.includes('align')) return { icon: 'tire', iconColor: '#F59E0B', iconBg: '#F59E0B15' };
  if (s.includes('diag') || s.includes('scan') || s.includes('fault') || s.includes('ecu')) return { icon: 'engine', iconColor: '#06B6D4', iconBg: '#06B6D415' };
  if (s.includes('air') || s.includes('ac') || s.includes('regas') || s.includes('condit')) return { icon: 'snowflake', iconColor: '#3B82F6', iconBg: '#3B82F615' };
  if (s.includes('exhaust') || s.includes('dpf') || s.includes('emission') || s.includes('pipe')) return { icon: 'pipe', iconColor: '#6366F1', iconBg: '#6366F115' };
  if (s.includes('battery') || s.includes('electric') || s.includes('alternator')) return { icon: 'car-battery', iconColor: '#EAB308', iconBg: '#EAB30815' };
  if (s.includes('clutch') || s.includes('gear') || s.includes('flywheel') || s.includes('transmiss')) return { icon: 'cog-sync', iconColor: '#9333EA', iconBg: '#9333EA15' };
  if (s.includes('suspension') || s.includes('spring') || s.includes('shock') || s.includes('strut')) return { icon: 'car-traction-control', iconColor: '#4F46E5', iconBg: '#4F46E515' };
  return { icon: 'wrench', iconColor: '#EC4899', iconBg: '#EC489915' };
};

const ServicesSkeletonCarousel = ({ isDarkMode }: { isDarkMode: boolean }) => {
  const pulseAnim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.85,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.35,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  const skeletonBg = isDarkMode ? '#1E354A' : '#E2E8F0';
  const skeletonSubBg = isDarkMode ? '#284666' : '#CBD5E1';
  const titleWidths = [66, 76, 56, 72, 62, 68];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.servicesHorizontalScroll}
    >
      {[0, 1, 2, 3, 4, 5].map((idx) => (
        <Animated.View key={idx} style={[styles.horizontalServiceItem, { opacity: pulseAnim }]}>
          <View style={[styles.enlargedIconCircle, { backgroundColor: skeletonBg, borderColor: skeletonSubBg }]}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: skeletonSubBg }} />
            <View
              style={[
                styles.iconActionBadge,
                { backgroundColor: skeletonSubBg, borderColor: isDarkMode ? '#0B1F33' : '#F7F9FC' },
              ]}
            />
          </View>

          <View
            style={[
              styles.skeletonTextBar,
              { width: titleWidths[idx % titleWidths.length], backgroundColor: skeletonBg },
            ]}
          />

          <View style={[styles.skeletonSelectPill, { backgroundColor: skeletonBg, borderColor: skeletonSubBg }]}>
            <View style={{ width: 24, height: 8, borderRadius: 4, backgroundColor: skeletonSubBg }} />
          </View>
        </Animated.View>
      ))}
    </ScrollView>
  );
};

export default function HomeScreen({ navigation }: any) {
  const { theme, isDarkMode } = useAppTheme();
  const {
    token,
    vehicles,
    refreshData,
    lookupVehicle,
    user,
    userLocation,
    setUserLocation,
    isOutsideUK,
    refreshLocation,
    services,
    fetchServices,
    serviceCategories,
    fetchServiceCategories,
  } = useAppValues();
  const [regNumber, setRegNumber] = useState('');
  const [garageSearchText, setGarageSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchHistory, setSearchHistory] = useState<any[]>([]);
  const [nearbyGarages, setNearbyGarages] = useState<any[]>([]);
  const [loadingGarages, setLoadingGarages] = useState(false);
  const [loadingServices, setLoadingServices] = useState(services.length === 0 && serviceCategories.length === 0);
  const [areaModalVisible, setAreaModalVisible] = useState(false);

  const fetchDynamicServices = async (showMinLoader = false) => {
    const startTime = Date.now();
    try {
      if ((services.length === 0 && serviceCategories.length === 0) || showMinLoader) {
        setLoadingServices(true);
      }
      await Promise.all([
        fetchServices(),
        fetchServiceCategories(),
      ]);
      if (showMinLoader) {
        const elapsed = Date.now() - startTime;
        if (elapsed < 400) {
          await new Promise((resolve) => setTimeout(() => resolve(true), 400 - elapsed));
        }
      }
    } catch (e) {
      console.error('Failed to fetch services in Home:', e);
    } finally {
      setLoadingServices(false);
    }
  };

  const fetchNearbyGarages = async () => {
    try {
      setLoadingGarages(true);
      const response = await fetch(`${BASE_URL}/garages`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (response.ok) {
        const data = await response.json();
        const approvedOnly = Array.isArray(data) ? data.filter((g: any) => g.status === 'Approved') : [];
        setNearbyGarages(approvedOnly);
      }
    } catch (e) {
      console.error('Failed to fetch nearby garages:', e);
    } finally {
      setLoadingGarages(false);
    }
  };

  // Dynamic Service Categories from Super Admin (MOT, Servicing, Tyres, Repairs...)
  const dynamicBookableServices = useMemo<BookableServiceItem[]>(() => {
    if (Array.isArray(serviceCategories) && serviceCategories.length > 0) {
      return serviceCategories.map((cat, idx) => ({
        id: cat._id || cat.id || `cat_${idx}`,
        title: cat.name,
        name: cat.name,
        category: cat.name,
        icon: cat.icon || 'wrench',
        iconBg: cat.iconBg || '#1677FF15',
        iconColor: cat.iconColor || '#1677FF',
        searchQuery: cat.name,
        price: 45,
        duration: 45,
        description: cat.description || '',
      }));
    }

    return DEFAULT_BOOKABLE_SERVICES;
  }, [serviceCategories]);

  const getGarageServices = (garage: any) => {
    if (Array.isArray(garage?.services) && garage.services.length > 0) {
      const activeSvcs = garage.services.filter((s: any) => s.isActive !== false);
      if (activeSvcs.length > 0) {
        return activeSvcs.map((s: any) => {
          const sName = s.name || 'Service';
          const iconDetails = resolveServiceIcon(sName, s.category);
          return {
            id: s._id || s.id || sName,
            name: sName,
            price: s.price || 45,
            duration: s.duration,
            icon: iconDetails.icon,
            iconColor: iconDetails.iconColor,
          };
        });
      }
    }
    // Default fallback if garage has not explicitly configured custom services
    return [
      {
        id: 'mot_default',
        name: 'MOT Test',
        price: 45,
        duration: 45,
        icon: 'shield-check',
        iconColor: '#10B981',
      },
    ];
  };

  const handleRefreshAndReset = async () => {
    setRefreshing(true);
    // Reset all search inputs on pull to reload
    setRegNumber('');
    setGarageSearchText('');
    try {
      if (token) {
        await refreshData();
      }
      await Promise.all([
        loadSearchHistory(),
        fetchNearbyGarages(),
        refreshLocation(),
        fetchDynamicServices(true),
      ]);
    } catch (e) {
      console.error('Home refresh error:', e);
    } finally {
      setRefreshing(false);
      setLoadingServices(false);
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
    fetchNearbyGarages();
    fetchDynamicServices();
  }, [token]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (token) {
        refreshData();
      }
      loadSearchHistory();
      fetchNearbyGarages();
      fetchDynamicServices();
    });
    loadSearchHistory();
    fetchDynamicServices();
    return unsubscribe;
  }, [navigation, token, user]);

  const sortedGarages = useMemo(() => {
    if (!nearbyGarages || nearbyGarages.length === 0) return [];
    // Condition: If location is out of UK, don't show any garage!
    if (isOutsideUK) return [];

    const mapped = nearbyGarages.map((g: any) => {
      let calculatedDistance = g.distance || 0;
      const gLat = g.latitude !== undefined && g.latitude !== null ? g.latitude : (g.location && g.location.coordinates ? g.location.coordinates[1] : null);
      const gLng = g.longitude !== undefined && g.longitude !== null ? g.longitude : (g.location && g.location.coordinates ? g.location.coordinates[0] : null);

      if (userLocation && gLat && gLng) {
        calculatedDistance = calculateDistanceInMiles(
          userLocation.latitude,
          userLocation.longitude,
          gLat,
          gLng
        );
      }
      return {
        ...g,
        calculatedDistance,
      };
    });

    if (userLocation) {
      mapped.sort((a, b) => (a.calculatedDistance || 9999) - (b.calculatedDistance || 9999));
    }

    return mapped;
  }, [nearbyGarages, userLocation, isOutsideUK]);

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
        navigation.navigate('MotHistory', { vehicleData: mappedVehicle, registration: mappedVehicle.registration });
      } else {
        Alert.alert('Vehicle Not Found', `Vehicle details not found for "${targetReg}". Please check the registration plate and try again.`);
      }
    } catch (err: any) {
      setLoading(false);
      console.error('[HomeScreen] lookup error:', err);
      const isBusy = err.isBusy || (err.message && (
        err.message.toLowerCase().includes('busy') ||
        err.message.toLowerCase().includes('taking too long')
      ));
      if (isBusy) {
        Alert.alert('Government API Busy', 'Government DVSA API is busy, please check again.');
      } else {
        Alert.alert('Vehicle Not Found', err.message || 'Vehicle details not found. Please check the registration plate and try again.');
      }
    }
  };

  const handleRecentCheckPress = (item: any) => {
    navigation.navigate('MotHistory', { vehicleData: item, registration: item.registration || item.registrationNumber });
  };

  const handleSearchGarages = () => {
    Keyboard.dismiss();
    const query = garageSearchText.trim();
    navigation.navigate('Garages', { searchQuery: query });
  };

  const handleSelectService = (service: any) => {
    navigation.navigate('Garages', {
      serviceFilter: service.searchQuery || service.title || service.name,
      searchQuery: '',
      serviceTitle: service.title || service.name,
    });
  };

  const userVehicles = vehicles || [];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Customer Header with Location on Left and Initials on Right */}
      <CustomerHeader
        title=""
        customLeft={
          <TouchableOpacity
            onPress={() => setAreaModalVisible(true)}
            style={[
              styles.headerLocationCol,
              {
                backgroundColor: isOutsideUK ? '#EF444415' : theme.colors.secondary + '12',
                borderColor: isOutsideUK ? '#EF444440' : theme.colors.secondary + '30',
              },
            ]}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.headerLocationLabel, { color: isOutsideUK ? '#DC2626' : theme.colors.placeholder }]}>
              Your location
            </Text>
            <View style={styles.headerLocationRow}>
              <MaterialCommunityIcons
                name={isOutsideUK ? 'map-marker-remove' : 'map-marker'}
                size={14}
                color={isOutsideUK ? '#DC2626' : theme.colors.secondary}
                style={{ marginRight: 4, marginTop: 1 }}
              />
              <Text
                style={[
                  styles.headerLocationCity,
                  { color: isOutsideUK ? '#DC2626' : theme.colors.text },
                ]}
              >
                {formatPreciseLocation(userLocation)}
              </Text>
              <MaterialCommunityIcons
                name="chevron-down"
                size={13}
                color={isOutsideUK ? '#DC2626' : theme.colors.placeholder}
                style={{ marginLeft: 3 }}
              />
            </View>
          </TouchableOpacity>
        }
        rightAction={
          <TouchableOpacity
            onPress={() => navigation.navigate(token ? 'Profile' : 'Login')}
            style={[styles.headerInitialsWrap, { backgroundColor: theme.colors.secondary + '18', borderColor: theme.colors.secondary }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.topProfileInitialsText, { color: theme.colors.secondary }]}>
              {getUserInitials(user?.name, user?.email)}
            </Text>
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

        {/* 2. Check MOT History Card */}
        <View style={[styles.heroSearchCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.cardHeaderIconWrap, { backgroundColor: theme.colors.secondary + '15' }]}>
              <MaterialCommunityIcons name="card-search-outline" size={22} color={theme.colors.secondary} />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.cardHeaderTitle, { color: theme.colors.text }]}>
                Check MOT History
              </Text>
            </View>
          </View>

          {/* Unified UK Registration Plate Input with Attached Check Button */}
          <View style={styles.plateMergedContainer}>
            <View style={styles.ukPlateStrip}>
              <Text style={styles.ukFlagSymbol}>🇬🇧</Text>
              <Text style={styles.ukPlateStripText}>UK</Text>
            </View>
            <View style={styles.plateInputSection}>
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
                  <MaterialCommunityIcons name="close-circle" size={18} color="#374151" />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              onPress={() => handleCheckMOT()}
              disabled={loading}
              activeOpacity={0.85}
              style={[
                styles.attachedCheckBtn,
                { backgroundColor: theme.colors.secondary, opacity: loading ? 0.75 : 1 },
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialCommunityIcons name="magnify" size={17} color="#FFFFFF" style={{ marginRight: 3 }} />
                  <Text style={styles.attachedCheckBtnText}>Check</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* What details you can see section (2x2 Grid) */}
          <View style={[styles.detailsIncludedSection, { borderTopColor: theme.colors.border }]}>
            <View style={styles.detailsSectionHeader}>
              <MaterialCommunityIcons name="clipboard-check-outline" size={15} color={theme.colors.secondary} style={{ marginRight: 6 }} />
              <Text style={[styles.detailsSectionTitle, { color: theme.colors.text }]}>
                What details you can see:
              </Text>
            </View>

            <View style={styles.detailsNormalGrid}>
              <View style={styles.normalDetailItem}>
                <MaterialCommunityIcons name="calendar-clock" size={17} color="#10B981" style={{ marginRight: 7 }} />
                <Text style={[styles.normalDetailText, { color: theme.colors.text }]}>
                  MOT Expiry Date & Status
                </Text>
              </View>

              <View style={styles.normalDetailItem}>
                <MaterialCommunityIcons name="alert-circle-outline" size={17} color="#F59E0B" style={{ marginRight: 7 }} />
                <Text style={[styles.normalDetailText, { color: theme.colors.text }]}>
                  Defects & Advisories
                </Text>
              </View>

              <View style={styles.normalDetailItem}>
                <MaterialCommunityIcons name="speedometer" size={17} color="#8B5CF6" style={{ marginRight: 7 }} />
                <Text style={[styles.normalDetailText, { color: theme.colors.text }]}>
                  Mileage History
                </Text>
              </View>

              <View style={styles.normalDetailItem}>
                <MaterialCommunityIcons name="car-info" size={17} color="#3B82F6" style={{ marginRight: 7 }} />
                <Text style={[styles.normalDetailText, { color: theme.colors.text }]}>
                  Vehicle Specifications
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 3. Book a Service Catalog */}
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
          </View>

          {loadingServices ? (
            <ServicesSkeletonCarousel isDarkMode={isDarkMode} />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.servicesHorizontalScroll}
            >
              {dynamicBookableServices.map((item) => (
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

                  <View style={[styles.selectPill, { backgroundColor: item.iconBg, borderColor: item.iconColor + '30' }]}>
                    <Text style={[styles.selectPillText, { color: item.iconColor }]}>Select</Text>
                    <MaterialCommunityIcons name="chevron-right" size={11} color={item.iconColor} />
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* 4. Local Garages (Vertical Garages with Horizontal Services Below Each) */}
        <View style={styles.nearbyGaragesSectionWrap}>
          <View style={styles.nearbyGaragesHeader}>
            <View style={styles.nearbyGaragesTitleRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="storefront-outline" size={20} color={theme.colors.secondary} style={{ marginRight: 6 }} />
                <Text style={[styles.nearbyGaragesTitle, { color: theme.colors.text }]}>
                  Garages Near You
                </Text>
              </View>
              {!isOutsideUK && (
                <TouchableOpacity
                  onPress={() => navigation.navigate('Garages', { nearMe: true })}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.viewAllText, { color: theme.colors.secondary }]}>
                    View All ({sortedGarages.length})
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {isOutsideUK ? (
            /* Condition: if location is out of UK don't show any garage, but message 'Service not available in selected area!' */
            <View style={[styles.unavailableHomeCard, { backgroundColor: theme.colors.card, borderColor: '#EF444450' }]}>
              <View style={[styles.unavailableHomeIconCircle, { backgroundColor: '#EF444415' }]}>
                <MaterialCommunityIcons name="map-marker-off-outline" size={38} color="#DC2626" />
              </View>

              <View style={[styles.unavailableDetectedPill, { backgroundColor: '#EF444415', borderColor: '#EF444430' }]}>
                <MaterialCommunityIcons name="crosshairs-gps" size={13} color="#DC2626" style={{ marginRight: 4 }} />
                <Text style={[styles.unavailableDetectedText, { color: '#DC2626' }]} numberOfLines={1}>
                  {userLocation?.address || userLocation?.label || 'Outside UK Service Area'}
                </Text>
              </View>

              <Text style={[styles.unavailableHomeTitle, { color: '#DC2626' }]}>
                Service not available in selected area!
              </Text>

              <Text style={[styles.unavailableHomeDesc, { color: theme.colors.placeholder }]}>
                Multiple MOT registered garages and DVSA certified testing centres operate exclusively across the United Kingdom. Please select a UK city or area to find local garages.
              </Text>

              <TouchableOpacity
                style={[styles.unavailableChangeBtn, { backgroundColor: theme.colors.primary }]}
                onPress={() => setAreaModalVisible(true)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="map-marker-radius" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.unavailableChangeBtnText}>Select a UK Area</Text>
              </TouchableOpacity>

              <View style={styles.presetQuickRow}>
                <Text style={[styles.presetQuickLabel, { color: theme.colors.placeholder }]}>Quick Select UK:</Text>
                {['London', 'Manchester', 'Birmingham'].map((city) => (
                  <TouchableOpacity
                    key={city}
                    style={[styles.presetQuickChip, { backgroundColor: theme.colors.secondary + '15', borderColor: theme.colors.secondary + '30' }]}
                    onPress={() => {
                      const found = UK_PRESET_LOCATIONS[city] || Object.entries(UK_PRESET_LOCATIONS).find(([k]) => k.toLowerCase().includes(city.toLowerCase()))?.[1];
                      if (found) setUserLocation(found);
                    }}
                  >
                    <Text style={[styles.presetQuickChipText, { color: theme.colors.secondary }]}>
                      {city}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : loadingGarages ? (
            <View style={[styles.garagesLoadingWrap, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <ActivityIndicator color={theme.colors.secondary} size="small" style={{ marginRight: 8 }} />
              <Text style={{ color: theme.colors.placeholder, fontSize: 13 }}>Finding garages near your location...</Text>
            </View>
          ) : sortedGarages.length === 0 ? (
            <View style={[styles.emptyGaragesCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <MaterialCommunityIcons name="store-alert-outline" size={28} color={theme.colors.placeholder} style={{ marginBottom: 4 }} />
              <Text style={{ color: theme.colors.placeholder, fontSize: 13 }}>No local garages found nearby.</Text>
            </View>
          ) : (
            <View style={styles.garagesVerticalList}>
              {sortedGarages.slice(0, 6).map((garage: any) => {
                const coverUri = garage.coverImage || (garage.images && garage.images.length > 0 ? garage.images[0] : garage.logoUrl);
                const distanceText = garage.calculatedDistance ? `${garage.calculatedDistance.toFixed(1)} mi` : (garage.city || 'Nearby');
                const servicesList = getGarageServices(garage);

                return (
                  <View
                    key={garage._id || garage.id}
                    style={[
                      styles.garageVerticalCard,
                      { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                    ]}
                  >
                    {/* 1. Garage Top Info Row */}
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => navigation.navigate('GarageDetail', {
                        garageId: garage._id || garage.id,
                        garage,
                      })}
                      style={styles.garageVerticalTopRow}
                    >
                      <View style={styles.garageVerticalLogoWrap}>
                        {coverUri ? (
                          <Image source={{ uri: coverUri }} style={styles.garageVerticalLogo} />
                        ) : (
                          <View style={[styles.garageVerticalLogoPlaceholder, { backgroundColor: theme.colors.secondary + '15' }]}>
                            <MaterialCommunityIcons name="storefront" size={26} color={theme.colors.secondary} />
                          </View>
                        )}
                      </View>

                      <View style={styles.garageVerticalInfo}>
                        <View style={styles.garageNameAndRatingRow}>
                          <Text style={[styles.garageVerticalName, { color: theme.colors.text }]} numberOfLines={1}>
                            {garage.name}
                          </Text>
                          <View style={styles.garageRatingChip}>
                            <MaterialCommunityIcons name="star" size={11} color="#F59E0B" style={{ marginRight: 2 }} />
                            <Text style={styles.garageRatingText}>
                              {garage.rating ? Number(garage.rating).toFixed(1) : '4.8'}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.garageMetaRow}>
                          <MaterialCommunityIcons name="map-marker-outline" size={13} color={theme.colors.placeholder} style={{ marginRight: 3 }} />
                          <Text style={[styles.garageVerticalAddress, { color: theme.colors.placeholder }]} numberOfLines={1}>
                            {[garage.address, garage.city, garage.postcode].filter(Boolean).join(', ') || 'UK Certified Garage'}
                          </Text>
                        </View>

                        <View style={styles.garageBadgeRow}>
                          {garage.calculatedDistance !== undefined && garage.calculatedDistance !== null && (
                            <View style={[styles.distancePill, { backgroundColor: theme.colors.primary + '12' }]}>
                              <MaterialCommunityIcons name="map-marker-distance" size={11} color={theme.colors.primary} style={{ marginRight: 2 }} />
                              <Text style={[styles.distancePillText, { color: theme.colors.primary }]}>
                                {distanceText}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>

                      <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.placeholder} style={{ alignSelf: 'center', marginLeft: 4 }} />
                    </TouchableOpacity>

                    {/* 2. Below in horizontal flatlist show services */}
                    <View style={styles.garageServicesContainer}>
                      <FlatList
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        data={servicesList}
                        keyExtractor={(item: any, index: number) => `${garage._id || garage.id}-svc-${item.name}-${index}`}
                        contentContainerStyle={styles.garageServicesFlatList}
                        renderItem={({ item: svc }: { item: any }) => (
                          <TouchableOpacity
                            activeOpacity={0.75}
                            onPress={() => navigation.navigate('GarageDetail', {
                              garageId: garage._id || garage.id,
                              garage,
                              serviceName: svc.name,
                              autoOpenBooking: true,
                            })}
                            style={[
                              styles.garageServiceChipCard,
                              { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
                            ]}
                          >
                            <View style={[styles.serviceChipIconWrap, { backgroundColor: svc.iconColor + '15' }]}>
                              <MaterialCommunityIcons name={svc.icon} size={14} color={svc.iconColor} />
                            </View>
                            <View style={styles.serviceChipTextCol}>
                              <Text style={[styles.serviceChipTitle, { color: theme.colors.text }]} numberOfLines={1}>
                                {svc.name}
                              </Text>
                              <Text style={[styles.serviceChipPrice, { color: theme.colors.secondary }]}>
                                £{svc.price}
                              </Text>
                            </View>
                            <View style={[styles.serviceChipBookBtn, { backgroundColor: theme.colors.secondary }]}>
                              <Text style={styles.serviceChipBookBtnText}>Book</Text>
                            </View>
                          </TouchableOpacity>
                        )}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* 5. Core Navigation Hub Grid (4 Action Boxes) */}
        <View style={styles.quickGrid}>
          {/* Card 1: Book MOT Slot */}
          <TouchableOpacity
            style={[styles.quickHubCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
            activeOpacity={0.8}
            onPress={() => {
              navigation.navigate('Garages', {
                serviceFilter: 'MOT',
                serviceTitle: 'MOT Test',
                searchQuery: '',
              });
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
                navigation.navigate('My Portal');
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

          {/* Card 4: My Bookings */}
          <TouchableOpacity
            style={[styles.quickHubCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
            activeOpacity={0.8}
            onPress={() => {
              if (token) {
                navigation.navigate('Bookings');
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

    <SelectAreaBottomSheet
      visible={areaModalVisible}
      onClose={() => setAreaModalVisible(false)}
      currentLocation={userLocation}
      onSelectLocation={(coords) => setUserLocation(coords)}
    />
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
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  topProfileInitialsText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
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
  plateMergedContainer: {
    flexDirection: 'row',
    height: 50,
    backgroundColor: '#FFD200', // UK Reflective Yellow
    borderWidth: 2,
    borderColor: '#111827',
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    marginBottom: 4,
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
  plateInputSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
    paddingHorizontal: 4,
  },
  plateInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
    color: '#111827',
    textAlign: 'center',
    letterSpacing: 2,
    height: '100%',
    paddingVertical: 0,
  },
  plateClearBtn: {
    paddingHorizontal: 6,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachedCheckBtn: {
    height: '100%',
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: 1.5,
    borderLeftColor: '#111827',
  },
  attachedCheckBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  nearbyGaragesSectionWrap: {
    marginBottom: 16,
  },
  nearbyGaragesHeader: {
    marginBottom: 12,
  },
  nearbyGaragesTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nearbyGaragesTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  nearbyGaragesSub: {
    fontSize: 12,
    marginTop: 2,
  },
  garagesLoadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderRadius: 14,
    borderWidth: 1,
  },
  emptyGaragesCard: {
    padding: 24,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInitialsWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  headerLocationCol: {
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
  },
  headerLocationLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    marginBottom: 1,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  headerLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerLocationCity: {
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
    flex: 1,
    flexShrink: 1,
  },
  garagesVerticalList: {
    gap: 12,
  },
  garageVerticalCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  garageVerticalTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  garageVerticalLogoWrap: {
    width: 54,
    height: 54,
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#00000010',
  },
  garageVerticalLogo: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  garageVerticalLogoPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  garageVerticalInfo: {
    flex: 1,
  },
  garageNameAndRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  garageVerticalName: {
    fontSize: 14,
    fontWeight: '800',
    flex: 1,
    marginRight: 6,
  },
  garageRatingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B18',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  garageRatingText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D97706',
  },
  garageMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  garageVerticalAddress: {
    fontSize: 11,
    flex: 1,
  },
  garageBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dvsaApprovedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  dvsaApprovedPillText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  distancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  distancePillText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  garageServicesContainer: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#0000000D',
  },
  garageServicesFlatList: {
    paddingVertical: 2,
    paddingRight: 6,
  },
  garageServiceChipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 8,
  },
  serviceChipIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 7,
  },
  serviceChipTextCol: {
    marginRight: 8,
  },
  serviceChipTitle: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  serviceChipPrice: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  serviceChipBookBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  serviceChipBookBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
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
  skeletonTextBar: {
    height: 12,
    borderRadius: 6,
    marginBottom: 4,
  },
  skeletonSelectPill: {
    width: 52,
    height: 18,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
    justifyContent: 'center',
    alignItems: 'center',
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
  detailsIncludedSection: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  detailsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  detailsSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  detailsNormalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
    marginTop: 2,
  },
  normalDetailItem: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
  },
  normalDetailText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  unavailableHomeCard: {
    padding: 22,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    marginTop: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  unavailableHomeIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  unavailableDetectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  unavailableDetectedText: {
    fontSize: 12,
    fontWeight: '700',
  },
  unavailableHomeTitle: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  unavailableHomeDesc: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 14,
    paddingHorizontal: 8,
  },
  unavailableChangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 14,
  },
  unavailableChangeBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  presetQuickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  presetQuickLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginRight: 6,
  },
  presetQuickChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 3,
    marginVertical: 2,
  },
  presetQuickChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
