import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues, BASE_URL } from '../context/DataContext';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  calculateDistanceInMiles,
  requestUserLiveLocation,
  isWithinUKBoundary,
  Coordinates,
  UK_PRESET_LOCATIONS,
  formatPreciseLocation,
} from '../utils/mapUtils';
import CustomerHeader from '../components/CustomerHeader';
import SelectAreaBottomSheet from '../components/SelectAreaBottomSheet';
import FilterServiceBottomSheet, { isServiceMatch } from '../components/FilterServiceBottomSheet';
import LoginRequiredModal from '../components/LoginRequiredModal';
import { fonts } from '../theme/theme';

const getUserInitials = (name?: string, email?: string) => {
  if (name && name.trim()) {
    const parts = name.trim().split(' ');
    if (parts.length > 1) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email && email.trim()) {
    return email.trim().slice(0, 2).toUpperCase();
  }
  return 'G';
};

const GarageLogo = ({ uri, name, theme }: any) => {
  const [error, setError] = useState(false);

  return (
    <View style={[styles.imageContainer, { backgroundColor: theme.colors.secondary + '12' }]}>
      {uri && !error ? (
        <Image 
          source={{ uri }} 
          style={styles.cardImage} 
          resizeMode="cover"
          onError={() => setError(true)} 
        />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Text style={[styles.avatarText, { color: theme.colors.secondary }]}>
            {getUserInitials(name)}
          </Text>
        </View>
      )}
    </View>
  );
};

export default function GarageListScreen({ route, navigation }: any) {
  const { theme } = useAppTheme();
  const { user, token, userLocation, setUserLocation, isOutsideUK, authFetch } = useAppValues();

  const [garages, setGarages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState(route?.params?.searchQuery || route?.params?.search || '');
  const [activeServiceFilters, setActiveServiceFilters] = useState<string[]>(() => {
    if (route?.params?.serviceFilters && Array.isArray(route?.params?.serviceFilters)) {
      return route.params.serviceFilters;
    }
    if (route?.params?.serviceFilter) {
      return [route.params.serviceFilter];
    }
    return [];
  });
  const [activeServiceTitles, setActiveServiceTitles] = useState<string[]>(() => {
    if (route?.params?.serviceTitles && Array.isArray(route?.params?.serviceTitles)) {
      return route.params.serviceTitles;
    }
    if (route?.params?.serviceTitle) {
      return [route.params.serviceTitle];
    }
    return [];
  });
  const [activeServiceFilter, setActiveServiceFilter] = useState<string>(route?.params?.serviceFilter || '');
  const [activeServiceTitle, setActiveServiceTitle] = useState<string>(route?.params?.serviceTitle || '');
  const [error, setError] = useState<string | null>(null);

  // Live Location & Sorting State
  const [userCoordinates, setUserCoordinates] = useState<Coordinates | null>(null);
  const [isNearMeActive, setIsNearMeActive] = useState<boolean>(route?.params?.nearMe === true);
  const [fetchingLocation, setFetchingLocation] = useState<boolean>(false);
  const [areaModalVisible, setAreaModalVisible] = useState(false);
  const [serviceModalVisible, setServiceModalVisible] = useState(false);
  const [loginModalVisible, setLoginModalVisible] = useState(false);

  const activeCoordinates = userLocation || userCoordinates;

  // Background fetch user's live coordinates on screen mount
  useEffect(() => {
    requestUserLiveLocation().then((coords) => {
      if (coords) {
        setUserCoordinates(coords);
      }
    });
  }, []);

  // Sync searchQuery, serviceFilter & nearMe when navigating with parameters, and refresh garage list
  useFocusEffect(
    useCallback(() => {
      fetchGaragesList();

      const pSearch = route?.params?.searchQuery !== undefined ? route.params.searchQuery : route?.params?.search;
      const pFilters = route?.params?.serviceFilters;
      const pTitles = route?.params?.serviceTitles;
      const pFilter = route?.params?.serviceFilter;
      const pTitle = route?.params?.serviceTitle;

      if (pFilters !== undefined && Array.isArray(pFilters)) {
        setActiveServiceFilters(pFilters);
        setActiveServiceFilter(pFilters.join(','));
      } else if (pFilter !== undefined) {
        const arr = pFilter ? [pFilter] : [];
        setActiveServiceFilters(arr);
        setActiveServiceFilter(pFilter);
      }

      if (pTitles !== undefined && Array.isArray(pTitles)) {
        setActiveServiceTitles(pTitles);
        setActiveServiceTitle(pTitles.join(', '));
      } else if (pTitle !== undefined) {
        const arr = pTitle ? [pTitle] : [];
        setActiveServiceTitles(arr);
        setActiveServiceTitle(pTitle);
      }

      // If a serviceFilter is provided, do NOT treat the service name as a garage name text search!
      if (pFilter && pSearch && (
        pSearch.trim().toLowerCase() === pFilter.trim().toLowerCase() ||
        (pTitle && pSearch.trim().toLowerCase() === pTitle.trim().toLowerCase())
      )) {
        setSearchQuery('');
      } else if (pSearch !== undefined) {
        setSearchQuery(pSearch);
      }

      if (route?.params?.nearMe === true) {
        handleTriggerNearMe();
      }
    }, [route?.params?.searchQuery, route?.params?.search, route?.params?.serviceFilter, route?.params?.serviceFilters, route?.params?.serviceTitle, route?.params?.serviceTitles, route?.params?.nearMe])
  );

  const fetchGaragesList = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch(`${BASE_URL}/garages`, {
        headers: {},
      });
      if (!response.ok) {
        throw new Error('Failed to load registered garages.');
      }
      const data = await response.json();
      const approvedOnly = Array.isArray(data) ? data.filter((g: any) => g.status === 'Approved') : [];
      setGarages(approvedOnly);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Could not connect to server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGaragesList();
  }, [token]);

  // Handler: Hardware Live GPS for "Near Me"
  const handleTriggerNearMe = async () => {
    setFetchingLocation(true);
    try {
      const coords = await requestUserLiveLocation();
      if (coords) {
        setUserCoordinates(coords);
        setIsNearMeActive(true);
      }
    } catch (e) {
      console.error('GPS error:', e);
    } finally {
      setFetchingLocation(false);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    navigation.setParams({ searchQuery: '', search: '' });
  };

  const handleClearServiceFilter = () => {
    setActiveServiceFilters([]);
    setActiveServiceTitles([]);
    setActiveServiceFilter('');
    setActiveServiceTitle('');
    if (
      searchQuery.trim().toLowerCase() === activeServiceFilter.trim().toLowerCase() ||
      searchQuery.trim().toLowerCase() === activeServiceTitle.trim().toLowerCase()
    ) {
      setSearchQuery('');
      navigation.setParams({ searchQuery: '', search: '' });
    }
    navigation.setParams({
      serviceFilter: '',
      serviceTitle: '',
      serviceFilters: [],
      serviceTitles: [],
    });
  };

  const handleApplyServiceFilters = (serviceKeys: string[], serviceTitles: string[]) => {
    setActiveServiceFilters(serviceKeys);
    setActiveServiceTitles(serviceTitles);
    setActiveServiceFilter(serviceKeys.join(','));
    setActiveServiceTitle(serviceTitles.join(', '));
    navigation.setParams({
      serviceFilters: serviceKeys,
      serviceTitles: serviceTitles,
      serviceFilter: serviceKeys.join(','),
      serviceTitle: serviceTitles.join(', '),
    });
  };

  const handleSelectServiceFilter = (serviceKey: string, serviceTitle: string) => {
    const keys = serviceKey ? serviceKey.split(',').filter(Boolean) : [];
    const titles = serviceTitle ? serviceTitle.split(',').filter(Boolean) : [];
    handleApplyServiceFilters(keys, titles);
  };

  const handleResetNearMe = () => {
    setIsNearMeActive(false);
    navigation.setParams({ nearMe: false });
  };

  // Pull to reload: reset all filters, every search, near me, and refresh data & GPS location
  const handleRefreshAndReset = async () => {
    setRefreshing(true);
    // 1. Reset all filter and search states
    setSearchQuery('');
    setActiveServiceFilters([]);
    setActiveServiceTitles([]);
    setActiveServiceFilter('');
    setActiveServiceTitle('');
    setIsNearMeActive(false);
    setError(null);

    // 2. Clear route params in react-navigation
    navigation.setParams({
      searchQuery: '',
      search: '',
      serviceFilter: '',
      serviceTitle: '',
      serviceFilters: [],
      serviceTitles: [],
      nearMe: false,
    });

    try {
      // 3. Fetch fresh registered garages list from server
      const response = await authFetch(`${BASE_URL}/garages`, {
        headers: {},
      });
      if (!response.ok) {
        throw new Error('Failed to load registered garages.');
      }
      const data = await response.json();
      setGarages(data);

      // 4. Update live GPS coordinates
      const coords = await requestUserLiveLocation();
      if (coords) {
        setUserCoordinates(coords);
      }
    } catch (err: any) {
      console.error('Refresh error:', err);
      setError(err.message || 'Could not connect to server.');
    } finally {
      setRefreshing(false);
    }
  };

  // Boundary check
  const isWithinUK = useMemo(() => {
    if (!activeCoordinates) return true;
    return isWithinUKBoundary(activeCoordinates);
  }, [activeCoordinates]);

  // Out of service area check: if detected outside UK boundary, dont show any garage!
  const isOutsideUKServiceArea = useMemo(() => {
    if (!activeCoordinates) return false;
    return !isWithinUKBoundary(activeCoordinates);
  }, [activeCoordinates]);

  // Filter and sort registered garages cleanly
  const processedGarages = useMemo(() => {
    // If outside UK, do not show any garage!
    if (isOutsideUKServiceArea) return [];

    const q = (searchQuery || '').toLowerCase().trim();
    const cleanQ = q.replace(/\s+/g, '');
    const filterKey = (activeServiceFilter || '').toLowerCase().trim();
    const effectiveFilters = activeServiceFilters.length > 0
      ? activeServiceFilters
      : filterKey ? [filterKey] : [];

    // Map each registered garage with dynamic calculated distance in miles
    const mapped = garages.map((g) => {
      let calculatedDistance = g.distance || 0;
      const gLat = g.latitude !== undefined && g.latitude !== null ? g.latitude : (g.location && g.location.coordinates ? g.location.coordinates[1] : null);
      const gLng = g.longitude !== undefined && g.longitude !== null ? g.longitude : (g.location && g.location.coordinates ? g.location.coordinates[0] : null);

      if (activeCoordinates && gLat && gLng) {
        calculatedDistance = calculateDistanceInMiles(
          activeCoordinates.latitude,
          activeCoordinates.longitude,
          gLat,
          gLng
        );
      }
      return {
        ...g,
        calculatedDistance,
      };
    });

    // Check if any garage matches all selected filters
    const hasAnyMatchingAll = effectiveFilters.length > 0 && mapped.some((g) =>
      effectiveFilters.every((fk) => Array.isArray(g.services) && g.services.some((s: any) => isServiceMatch(s, fk)))
    );

    // Filter by search query (name, address, city, postcode) AND service filters
    const filtered = mapped.filter((g) => {
      // 1. Service filter matching (if activeServiceFilters are set)
      if (effectiveFilters.length > 0) {
        if (hasAnyMatchingAll) {
          const matchesAll = effectiveFilters.every((fk) =>
            Array.isArray(g.services) && g.services.some((s: any) => isServiceMatch(s, fk))
          );
          if (!matchesAll) return false;
        } else {
          const matchesAny = effectiveFilters.some((fk) =>
            Array.isArray(g.services) && g.services.some((s: any) => isServiceMatch(s, fk))
          );
          if (!matchesAny) return false;
        }
      }

      // 2. Text query matching (if search query is entered)
      if (!q) return true;

      // If text query is identical to any active service filter, it is already matched in step 1
      if (effectiveFilters.some(fk => q === fk.toLowerCase().trim() || activeServiceTitles.some(st => q === st.toLowerCase().trim()))) {
        return true;
      }

      const nameMatch = (g.name || '').toLowerCase().includes(q);
      const addressMatch = (g.address || '').toLowerCase().includes(q);
      const cityMatch = (g.city || '').toLowerCase().includes(q);
      const postcodeMatch = cleanQ
        ? (g.postcode || '').toLowerCase().replace(/\s+/g, '').includes(cleanQ)
        : false;

      const queryServicesMatch =
        Array.isArray(g.services) &&
        g.services.some((s: any) => isServiceMatch(s, q));

      return nameMatch || addressMatch || cityMatch || postcodeMatch || Boolean(queryServicesMatch);
    });

    // Sorting: If "Near Me" is active, sort by nearest to device first. Otherwise sort by highest rating
    if (isNearMeActive) {
      return filtered.sort((a, b) => a.calculatedDistance - b.calculatedDistance);
    }
    return filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  }, [garages, searchQuery, activeServiceFilter, activeServiceFilters, activeServiceTitles, isNearMeActive, activeCoordinates]);

  const renderGarageItem = ({ item }: { item: any }) => {
    const locationParts = [item.address, item.city, item.postcode].filter(Boolean);
    const locationText = item.address || (locationParts.length > 0 ? locationParts.join(', ') : (item.city || 'United Kingdom'));
    const rawDist = item.calculatedDistance ?? item.distance;
    const distanceText = (rawDist !== undefined && rawDist !== null && !isNaN(Number(rawDist)) && Number(rawDist) >= 0)
      ? `${Number(rawDist).toFixed(1)} miles`
      : null;

    const filterTarget = activeServiceFilter || activeServiceTitle;
    const hasServiceFilter = activeServiceFilters.length > 0 || Boolean(filterTarget && filterTarget.trim());
    const effectiveFilters = activeServiceFilters.length > 0
      ? activeServiceFilters
      : filterTarget ? [filterTarget] : [];

    const matchingServices = hasServiceFilter && Array.isArray(item.services)
      ? effectiveFilters.map((fk) => item.services.find((s: any) => isServiceMatch(s, fk))).filter(Boolean)
      : [];

    const totalPriceNum = matchingServices.reduce((sum: number, s: any) => sum + (Number(s.price) || 0), 0);
    const displayPrice = totalPriceNum > 0
      ? totalPriceNum.toFixed(0)
      : (matchingServices[0]?.price ? Number(matchingServices[0].price).toFixed(0) : '45');

    const serviceDisplayName = matchingServices.length === 1
      ? matchingServices[0].name
      : matchingServices.length > 1
        ? `${matchingServices.length} Services`
        : activeServiceTitle || filterTarget || 'Service';

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('GarageDetail', { 
          garageId: item.id || item._id, 
          serviceName: hasServiceFilter ? serviceDisplayName : searchQuery, 
          serviceFilter: activeServiceFilter,
          serviceFilters: activeServiceFilters,
          serviceTitle: activeServiceTitle,
          serviceTitles: activeServiceTitles,
          searchQuery, 
          vehicle: route?.params?.vehicle || route?.params?.selectedVehicle,
          selectedVehicle: route?.params?.selectedVehicle || route?.params?.vehicle,
        })}
      >
        <GarageLogo 
          uri={item.coverImage || item.logoUrl || (item.images && item.images.length > 0 ? item.images[0] : null)} 
          name={item.name} 
          theme={theme} 
        />

        <View style={styles.cardContent}>
          <View style={styles.infoContainer}>
            <View style={styles.garageNameRow}>
              <Text style={[styles.garageName, { color: theme.colors.text }]} numberOfLines={1}>
                {item.name}
              </Text>
            </View>

            <View style={styles.addressRow}>
              <MaterialCommunityIcons name="map-marker-outline" size={13} color={theme.colors.placeholder} style={{ marginRight: 3 }} />
              <Text style={[styles.garageAddress, { color: theme.colors.placeholder }]} numberOfLines={1}>
                {locationText}
              </Text>
            </View>

            {distanceText ? (
              <View style={styles.distanceRow}>
                <MaterialCommunityIcons name="navigation-variant-outline" size={12} color={theme.colors.secondary} style={{ marginRight: 3 }} />
                <Text style={[styles.garageMiles, { color: theme.colors.secondary }]}>
                  {distanceText}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Show big price & Book button only when a service filter is applied; otherwise show chevron navigation indicator */}
          {hasServiceFilter ? (
            <View style={styles.priceActionCol}>
              <View style={styles.priceRowBig}>
                <Text style={[styles.priceCurrencyBig, { color: theme.colors.primary }]}>£</Text>
                <Text style={[styles.priceAmountBig, { color: theme.colors.primary }]}>{displayPrice}</Text>
              </View>
              {matchingServices.length > 1 ? (
                <View style={{ alignItems: 'flex-end', marginTop: 2, marginBottom: 4 }}>
                  {matchingServices.map((ms: any, sIdx: number) => {
                    const p = Number(ms.price || 0);
                    return (
                      <Text
                        key={ms.name || sIdx}
                        style={{ fontFamily: fonts.semiBold, fontSize: 10, color: theme.colors.placeholder, textAlign: 'right' }}
                        numberOfLines={1}
                      >
                        {ms.name}: £{p > 0 ? p.toFixed(0) : '45'}
                      </Text>
                    );
                  })}
                </View>
              ) : (
                <Text style={[styles.priceServiceLabel, { color: theme.colors.placeholder }]} numberOfLines={1}>
                  {serviceDisplayName}
                </Text>
              )}

              <TouchableOpacity
                style={[styles.cardBookBtn, { backgroundColor: theme.colors.primary }]}
                onPress={() => {
                  if (!token || !String(token).trim() || !user) {
                    setLoginModalVisible(true);
                    return;
                  }

                  navigation.navigate('GarageDetail', {
                    garageId: item.id || item._id,
                    serviceName: serviceDisplayName,
                    serviceFilter: activeServiceFilter,
                    serviceFilters: activeServiceFilters,
                    serviceTitle: activeServiceTitle,
                    serviceTitles: activeServiceTitles,
                    autoOpenBooking: true,
                    vehicle: route?.params?.vehicle || route?.params?.selectedVehicle,
                    selectedVehicle: route?.params?.selectedVehicle || route?.params?.vehicle,
                  });
                }}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="calendar-plus" size={13} color="#FFFFFF" style={{ marginRight: 3 }} />
                <Text style={styles.cardBookBtnText}>Book</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <MaterialCommunityIcons name="chevron-right" size={22} color={theme.colors.placeholder} style={{ marginLeft: 6 }} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Customer Header with Your Location on Left (No initials on garage list) */}
      <CustomerHeader
        title=""
        customLeft={
          <TouchableOpacity
            onPress={() => setAreaModalVisible(true)}
            style={[
              styles.headerLocationCol,
              {
                backgroundColor: isOutsideUKServiceArea ? '#EF444415' : theme.colors.secondary + '12',
                borderColor: isOutsideUKServiceArea ? '#EF444440' : theme.colors.secondary + '30',
              },
            ]}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.headerLocationLabel, { color: isOutsideUKServiceArea ? '#DC2626' : theme.colors.placeholder }]}>
              Your location
            </Text>
            <View style={styles.headerLocationRow}>
              <MaterialCommunityIcons
                name={isOutsideUKServiceArea ? 'map-marker-remove' : 'map-marker'}
                size={14}
                color={isOutsideUKServiceArea ? '#DC2626' : theme.colors.secondary}
                style={{ marginRight: 4, marginTop: 1 }}
              />
              <Text
                style={[
                  styles.headerLocationCity,
                  { color: isOutsideUKServiceArea ? '#DC2626' : theme.colors.text },
                ]}
              >
                {formatPreciseLocation(activeCoordinates)}
              </Text>
              <MaterialCommunityIcons
                name="chevron-down"
                size={13}
                color={isOutsideUKServiceArea ? '#DC2626' : theme.colors.placeholder}
                style={{ marginLeft: 3 }}
              />
            </View>
          </TouchableOpacity>
        }
      />

      {/* Search Bar */}
      <View style={styles.searchRow}>
        <View style={[styles.searchContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <MaterialCommunityIcons name="magnify" size={20} color={theme.colors.placeholder} style={styles.searchIcon} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search UK postcode (e.g. M1, SE1) or town..."
            placeholderTextColor={theme.colors.placeholder}
            style={[styles.searchInput, { color: theme.colors.text }]}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={handleClearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialCommunityIcons name="close-circle" size={18} color={theme.colors.placeholder} />
            </TouchableOpacity>
          )}

          {/* Divider between search and filter */}
          <View style={[styles.searchDivider, { backgroundColor: theme.colors.border }]} />

          {/* Filter Button inside searchbar */}
          <TouchableOpacity
            style={[
              styles.filterInsideButton,
              (activeServiceFilter || activeServiceFilters.length > 0) ? { backgroundColor: theme.colors.primary + '18' } : null,
            ]}
            onPress={() => setServiceModalVisible(true)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons
              name={(activeServiceFilter || activeServiceFilters.length > 0) ? 'filter' : 'filter-variant'}
              size={19}
              color={(activeServiceFilter || activeServiceFilters.length > 0) ? theme.colors.primary : theme.colors.placeholder}
            />
            {Boolean(activeServiceFilter || activeServiceFilters.length > 0) && (
              <View style={[styles.activeFilterDot, { backgroundColor: theme.colors.primary }]} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Near Me Active Badge (when inside UK) */}
      {isNearMeActive && userCoordinates && isWithinUK && (
        <View style={[styles.nearMeActivePill, { backgroundColor: '#10B98115', borderColor: '#10B98140' }]}>
          <MaterialCommunityIcons name="crosshairs-gps" size={14} color="#10B981" style={{ marginRight: 6 }} />
          <Text style={[styles.nearMeActiveText, { color: '#10B981', flex: 1 }]}>
            Sorted by nearest to {formatPreciseLocation(userCoordinates)}
          </Text>
          <TouchableOpacity onPress={handleResetNearMe} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.clearFilterLink, { color: theme.colors.primary }]}>Reset</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Active Service Filter Banner - Compact with multi-service support */}
      {(activeServiceFilters.length > 0 || activeServiceTitle.length > 0 || activeServiceFilter.length > 0) && !loading && !error && (
        <View
          style={[
            styles.serviceFilterPillBanner,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.primary + '40',
            },
          ]}
        >
          <MaterialCommunityIcons
            name="tools"
            size={13}
            color={theme.colors.primary}
            style={{ marginRight: 6 }}
          />
          <TouchableOpacity
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
            onPress={() => setServiceModalVisible(true)}
            activeOpacity={0.7}
          >
            <Text
              style={[styles.serviceFilterCompactText, { color: theme.colors.text }]}
              numberOfLines={1}
            >
              <Text style={{ fontFamily: fonts.medium, color: theme.colors.placeholder }}>
                {activeServiceFilters.length > 1 ? `${activeServiceFilters.length} Services: ` : 'Service: '}
              </Text>
              <Text style={{ fontFamily: fonts.bold, color: theme.colors.text }}>
                {activeServiceTitles.join(', ') || activeServiceTitle || activeServiceFilter}
              </Text>
            </Text>
          </TouchableOpacity>

          <View
            style={[
              styles.serviceCountBadge,
              { backgroundColor: theme.colors.primary + '15' },
            ]}
          >
            <Text style={[styles.serviceCountText, { color: theme.colors.primary }]}>
              {processedGarages.length} {processedGarages.length === 1 ? 'garage' : 'garages'}
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleClearServiceFilter}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ marginLeft: 6 }}
          >
            <MaterialCommunityIcons
              name="close-circle"
              size={16}
              color={theme.colors.placeholder}
            />
          </TouchableOpacity>
        </View>
      )}

      {/* Active Filter Pill */}
      {!activeServiceFilter && searchQuery.trim().length > 0 && !loading && !error && (
        <View style={[styles.searchFilterBadge, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <MaterialCommunityIcons name="filter-variant" size={14} color={theme.colors.secondary} style={{ marginRight: 6 }} />
          <Text style={[styles.searchFilterText, { color: theme.colors.text, flex: 1 }]} numberOfLines={1}>
            Found {processedGarages.length} registered {processedGarages.length === 1 ? 'garage' : 'garages'} for "{searchQuery.trim()}"
          </Text>
          <TouchableOpacity onPress={handleClearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.clearFilterLink, { color: theme.colors.primary }]}>Show All</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* State 1: Loading */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.text }]}>Loading registered garages...</Text>
        </View>
      ) : error ? (
        /* State 2: Error */
        <ScrollView
          contentContainerStyle={styles.centerScrollContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefreshAndReset}
              colors={[theme.colors.secondary, theme.colors.primary]}
              tintColor={theme.colors.secondary}
            />
          }
          alwaysBounceVertical={true}
        >
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={theme.colors.error} />
          <Text style={[styles.errorText, { color: theme.colors.text }]}>{error}</Text>
          <Text style={[styles.reloadHintText, { color: theme.colors.placeholder }]}>
            Pull down to reload
          </Text>
          <TouchableOpacity style={[styles.retryButton, { backgroundColor: theme.colors.primary }]} onPress={handleRefreshAndReset}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : isOutsideUKServiceArea ? (
        /* State 3: Service Not Available In Your Area (Outside UK) */
        <ScrollView
          contentContainerStyle={styles.unavailableContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefreshAndReset}
              colors={[theme.colors.secondary, theme.colors.primary]}
              tintColor={theme.colors.secondary}
            />
          }
          alwaysBounceVertical={true}
        >
          <View style={[styles.unavailableCard, { backgroundColor: theme.colors.card, borderColor: '#EF444450' }]}>
            <View style={[styles.unavailableIconCircle, { backgroundColor: '#EF444415' }]}>
              <MaterialCommunityIcons name="map-marker-off-outline" size={46} color="#DC2626" />
            </View>

            <View style={[styles.detectedPill, { backgroundColor: '#EF444415', borderColor: '#EF444430', borderWidth: 1 }]}>
              <MaterialCommunityIcons name="crosshairs-gps" size={13} color="#DC2626" style={{ marginRight: 5 }} />
              <Text style={[styles.detectedPillText, { color: '#DC2626' }]} numberOfLines={1}>
                {activeCoordinates?.address || activeCoordinates?.label || 'Outside UK Service Area'}
              </Text>
            </View>

            <Text style={[styles.unavailableTitle, { color: '#DC2626' }]}>
              Service not available in selected area!
            </Text>

            <Text style={[styles.unavailableDesc, { color: theme.colors.placeholder }]}>
              Our service network operates exclusively across the United Kingdom (England, Scotland, Wales & Northern Ireland). No registered garages or service centres are available in your selected area.
            </Text>

            {/* Action: Select UK Area */}
            <TouchableOpacity 
              style={[styles.primaryActionBtn, { backgroundColor: theme.colors.primary }]}
              onPress={() => setAreaModalVisible(true)}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="map-marker-radius" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.primaryActionBtnText}>Select a UK Area</Text>
            </TouchableOpacity>

            {/* Quick UK City Presets */}
            <Text style={[styles.presetHeading, { color: theme.colors.placeholder }]}>Or explore garages by UK city:</Text>
            <View style={styles.presetRow}>
              {['London', 'Manchester', 'Birmingham', 'Leeds'].map((cityName) => (
                <TouchableOpacity
                  key={cityName}
                  style={[styles.presetChip, { backgroundColor: theme.colors.secondary + '15', borderColor: theme.colors.secondary + '30' }]}
                  onPress={() => {
                    const preset = UK_PRESET_LOCATIONS[cityName] || Object.entries(UK_PRESET_LOCATIONS).find(([k]) => k.toLowerCase().includes(cityName.toLowerCase()))?.[1];
                    if (preset) {
                      setUserLocation(preset);
                    }
                  }}
                >
                  <Text style={[styles.presetChipText, { color: theme.colors.secondary }]}>{cityName}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>
      ) : processedGarages.length === 0 ? (
        /* State 4: Empty search / filter results */
        <ScrollView
          contentContainerStyle={styles.centerScrollContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefreshAndReset}
              colors={[theme.colors.secondary, theme.colors.primary]}
              tintColor={theme.colors.secondary}
            />
          }
          alwaysBounceVertical={true}
        >
          <MaterialCommunityIcons name="store-search-outline" size={48} color={theme.colors.placeholder} />
          <Text style={[styles.errorText, { color: theme.colors.placeholder, textAlign: 'center' }]}>
            {searchQuery.trim() 
              ? `No registered garages match "${searchQuery.trim()}".` 
              : (activeServiceFilters.length > 0 || activeServiceFilter.trim())
              ? `No registered garages found offering "${activeServiceTitles.join(', ') || activeServiceTitle || activeServiceFilter}".`
              : 'No registered garages found in this area.'}
          </Text>
          <Text style={[styles.reloadHintText, { color: theme.colors.placeholder }]}>
            Pull down to reload and reset all filters
          </Text>
          <TouchableOpacity 
            style={[styles.retryButton, { backgroundColor: theme.colors.secondary, marginTop: 14 }]} 
            onPress={handleRefreshAndReset}
          >
            <Text style={styles.retryButtonText}>Show All Registered Garages</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        /* State 5: Garage List */
        <FlatList
          data={processedGarages}
          keyExtractor={(item) => item.id || item._id}
          renderItem={renderGarageItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefreshAndReset}
              colors={[theme.colors.secondary, theme.colors.primary]}
              tintColor={theme.colors.secondary}
            />
          }
        />
      )}

      <SelectAreaBottomSheet
        visible={areaModalVisible}
        onClose={() => setAreaModalVisible(false)}
        currentLocation={activeCoordinates}
        onSelectLocation={(coords) => setUserLocation(coords)}
      />

      <FilterServiceBottomSheet
        visible={serviceModalVisible}
        onClose={() => setServiceModalVisible(false)}
        selectedService={activeServiceFilter}
        selectedServiceTitle={activeServiceTitle}
        selectedServices={activeServiceFilters}
        selectedServiceTitles={activeServiceTitles}
        onSelectService={handleSelectServiceFilter}
        onApplyServices={handleApplyServiceFilters}
        garages={garages}
      />
      {/* Floating Bottom Bar showing which services are selected in GarageListScreen */}
      {activeServiceFilters.length > 0 && (
        <View style={[styles.bottomSelectedServicesBar, { backgroundColor: theme.colors.card, borderTopColor: theme.colors.border }]}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
              <MaterialCommunityIcons name="check-circle" size={13} color={theme.colors.primary} style={{ marginRight: 4 }} />
              <Text style={[styles.bottomSelectedServicesTitle, { color: theme.colors.primary }]}>
                {activeServiceFilters.length} {activeServiceFilters.length === 1 ? 'SERVICE SELECTED' : 'SERVICES SELECTED'}
              </Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
              {activeServiceFilters.map((fk: string, idx: number) => {
                const title = activeServiceTitles[idx] || fk;
                return (
                  <View key={fk} style={[styles.bottomServiceFilterPill, { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary + '30' }]}>
                    <Text style={[styles.bottomServiceFilterPillText, { color: theme.colors.primary }]}>
                      {title}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>
          <TouchableOpacity
            style={[styles.bottomEditFilterBtn, { backgroundColor: theme.colors.primary }]}
            onPress={() => setServiceModalVisible(true)}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="filter-variant" size={14} color="#FFFFFF" style={{ marginRight: 3 }} />
            <Text style={styles.bottomEditFilterBtnText}>Change</Text>
          </TouchableOpacity>
        </View>
      )}

      <LoginRequiredModal
        visible={loginModalVisible}
        onClose={() => setLoginModalVisible(false)}
        onLogin={() => navigation.navigate('Login')}
        title="Please Login First"
        message="You need to be logged in to book an appointment with a garage. Please sign in to your customer account to continue."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  registeredShieldBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B98115',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  registeredShieldText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: '#10B981',
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
    fontFamily: fonts.bold,
    fontSize: 9.5,
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
    fontFamily: fonts.bold,
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
    flexShrink: 1,
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
  topProfileInitialsText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    letterSpacing: 0.5,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    fontFamily: fonts.medium,
    flex: 1,
    height: '100%',
    fontSize: 13,
    paddingVertical: 0,
  },
  searchDivider: {
    width: 1,
    height: 20,
    marginHorizontal: 8,
  },
  filterInsideButton: {
    padding: 5,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  activeFilterDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  nearMeActivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  nearMeActiveText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 85,
    flexGrow: 1,
  },
  bottomSelectedServicesBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
  },
  bottomSelectedServicesTitle: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    letterSpacing: 0.3,
  },
  bottomServiceFilterPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  bottomServiceFilterPillText: {
    fontFamily: fonts.bold,
    fontSize: 11,
  },
  bottomEditFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  bottomEditFilterBtnText: {
    fontFamily: fonts.bold,
    color: '#FFFFFF',
    fontSize: 12,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
    position: 'relative',
    elevation: 0,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  imageContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 90,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontFamily: fonts.bold,
    fontSize: 22,
    letterSpacing: 0.8,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingRight: 12,
    paddingLeft: 102,
    minHeight: 92,
  },
  infoContainer: {
    flex: 1,
    marginRight: 8,
    justifyContent: 'center',
  },
  garageNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  garageName: {
    fontFamily: fonts.bold,
    fontSize: 14,
    flex: 1,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  garageAddress: {
    fontFamily: fonts.regular,
    fontSize: 11,
    flex: 1,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  garageMiles: {
    fontFamily: fonts.bold,
    fontSize: 11,
  },
  priceActionCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: 6,
    minWidth: 72,
  },
  priceRowBig: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  priceCurrencyBig: {
    fontFamily: fonts.bold,
    fontSize: 15,
    marginTop: 2,
    marginRight: 1,
  },
  priceAmountBig: {
    fontFamily: fonts.extraBold,
    fontSize: 24,
    letterSpacing: -0.5,
    lineHeight: 28,
  },
  priceServiceLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 9.5,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: 1,
    marginBottom: 6,
    maxWidth: 95,
    textAlign: 'right',
  },
  cardBookBtn: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBookBtnText: {
    fontFamily: fonts.bold,
    color: '#FFFFFF',
    fontSize: 11,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  centerScrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  reloadHintText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
  },
  loadingText: {
    fontFamily: fonts.medium,
    marginTop: 12,
    fontSize: 14,
  },
  errorText: {
    fontFamily: fonts.regular,
    marginTop: 10,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 8,
  },
  retryButtonText: {
    fontFamily: fonts.bold,
    color: '#FFFFFF',
    fontSize: 12,
  },
  searchFilterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  searchFilterText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  clearFilterLink: {
    fontFamily: fonts.bold,
    fontSize: 12,
    marginLeft: 8,
  },
  // Unavailable / Blinkit-style View Styles
  unavailableContainer: {
    padding: 16,
    flexGrow: 1,
    justifyContent: 'center',
  },
  unavailableCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  unavailableIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F59E0B18',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  detectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B15',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    marginBottom: 12,
  },
  detectedPillText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: '#D97706',
  },
  unavailableTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 8,
  },
  unavailableDesc: {
    fontFamily: fonts.regular,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  primaryActionBtnText: {
    fontFamily: fonts.bold,
    color: '#FFFFFF',
    fontSize: 13,
  },
  presetHeading: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    marginBottom: 10,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  presetChipText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  serviceFilterPillBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  serviceFilterCompactText: {
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  serviceCountBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  serviceCountText: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
  },
});
