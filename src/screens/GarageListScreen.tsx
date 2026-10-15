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

const GarageLogo = ({ uri, name, style, theme }: any) => {
  const [error, setError] = useState(false);

  if (error || !uri) {
    return (
      <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.secondary + '15' }]}>
        <Text style={[styles.avatarText, { color: theme.colors.secondary }]}>
          {name ? name[0].toUpperCase() : 'G'}
        </Text>
      </View>
    );
  }

  return (
    <Image 
      source={{ uri }} 
      style={style} 
      onError={() => setError(true)} 
    />
  );
};

export default function GarageListScreen({ route, navigation }: any) {
  const { theme } = useAppTheme();
  const { user, token, userLocation, setUserLocation, isOutsideUK } = useAppValues();

  const [garages, setGarages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState(route?.params?.searchQuery || route?.params?.search || '');
  const [activeServiceFilter, setActiveServiceFilter] = useState<string>(route?.params?.serviceFilter || '');
  const [activeServiceTitle, setActiveServiceTitle] = useState<string>(route?.params?.serviceTitle || '');
  const [error, setError] = useState<string | null>(null);

  // Live Location & Sorting State
  const [userCoordinates, setUserCoordinates] = useState<Coordinates | null>(null);
  const [isNearMeActive, setIsNearMeActive] = useState<boolean>(route?.params?.nearMe === true);
  const [fetchingLocation, setFetchingLocation] = useState<boolean>(false);
  const [areaModalVisible, setAreaModalVisible] = useState(false);
  const [serviceModalVisible, setServiceModalVisible] = useState(false);

  const activeCoordinates = userLocation || userCoordinates;

  // Background fetch user's live coordinates on screen mount
  useEffect(() => {
    requestUserLiveLocation().then((coords) => {
      if (coords) {
        setUserCoordinates(coords);
      }
    });
  }, []);

  // Sync searchQuery, serviceFilter & nearMe when navigating with parameters
  useFocusEffect(
    useCallback(() => {
      if (route?.params?.searchQuery !== undefined) {
        setSearchQuery(route.params.searchQuery);
      } else if (route?.params?.search !== undefined) {
        setSearchQuery(route.params.search);
      }
      if (route?.params?.serviceFilter !== undefined) {
        setActiveServiceFilter(route.params.serviceFilter);
      }
      if (route?.params?.serviceTitle !== undefined) {
        setActiveServiceTitle(route.params.serviceTitle);
      }
      if (route?.params?.nearMe === true) {
        handleTriggerNearMe();
      }
    }, [route?.params?.searchQuery, route?.params?.search, route?.params?.serviceFilter, route?.params?.serviceTitle, route?.params?.nearMe])
  );

  const fetchGaragesList = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${BASE_URL}/garages`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        throw new Error('Failed to load registered garages.');
      }
      const data = await response.json();
      setGarages(data);
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
    setActiveServiceFilter('');
    setActiveServiceTitle('');
    if (
      searchQuery.trim().toLowerCase() === activeServiceFilter.trim().toLowerCase() ||
      searchQuery.trim().toLowerCase() === activeServiceTitle.trim().toLowerCase()
    ) {
      setSearchQuery('');
      navigation.setParams({ searchQuery: '', search: '' });
    }
    navigation.setParams({ serviceFilter: '', serviceTitle: '' });
  };

  const handleSelectServiceFilter = (serviceKey: string, serviceTitle: string) => {
    setActiveServiceFilter(serviceKey);
    setActiveServiceTitle(serviceTitle);
    navigation.setParams({
      serviceFilter: serviceKey,
      serviceTitle: serviceTitle,
    });
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
      nearMe: false,
    });

    try {
      // 3. Fetch fresh registered garages list from server
      const response = await fetch(`${BASE_URL}/garages`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
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

    // Filter by search query (name, address, city, postcode) AND service filter
    const filtered = mapped.filter((g) => {
      // 1. Service filter matching (if activeServiceFilter is set)
      if (filterKey) {
        const hasMatchingService =
          Array.isArray(g.services) &&
          g.services.some((s: any) => isServiceMatch(s, filterKey));

        if (!hasMatchingService) {
          return false;
        }
      }

      // 2. Text query matching (if search query is entered)
      if (!q) return true;

      const nameMatch = (g.name || '').toLowerCase().includes(q);
      const addressMatch = (g.address || '').toLowerCase().includes(q);
      const cityMatch = (g.city || '').toLowerCase().includes(q);
      const postcodeMatch = cleanQ
        ? (g.postcode || '').toLowerCase().replace(/\s+/g, '').includes(cleanQ)
        : false;

      const queryServicesMatch =
        !filterKey &&
        Array.isArray(g.services) &&
        g.services.some((s: any) => isServiceMatch(s, q));

      return nameMatch || addressMatch || cityMatch || postcodeMatch || Boolean(queryServicesMatch);
    });

    // Sorting: If "Near Me" is active, sort by nearest to device first. Otherwise sort by highest rating
    if (isNearMeActive) {
      return filtered.sort((a, b) => a.calculatedDistance - b.calculatedDistance);
    }
    return filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  }, [garages, searchQuery, activeServiceFilter, isNearMeActive, activeCoordinates]);

  const renderGarageItem = ({ item }: { item: any }) => {
    const locationParts = [item.address, item.city, item.postcode].filter(Boolean);
    const locationText = item.address || (locationParts.length > 0 ? locationParts.join(', ') : (item.city || 'United Kingdom'));
    const rawDist = item.calculatedDistance ?? item.distance;
    const distanceText = (rawDist !== undefined && rawDist !== null && !isNaN(Number(rawDist)) && Number(rawDist) >= 0)
      ? `${Number(rawDist).toFixed(1)} miles`
      : null;

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('GarageDetail', { 
          garageId: item.id || item._id, 
          serviceName: activeServiceFilter || activeServiceTitle || searchQuery, 
          serviceFilter: activeServiceFilter,
          serviceTitle: activeServiceTitle,
          searchQuery, 
          vehicle: route.params?.vehicle 
        })}
      >
        <GarageLogo 
          uri={item.logoUrl || (item.images && item.images.length > 0 ? item.images[0] : null)} 
          name={item.name} 
          style={styles.logoSmall} 
          theme={theme} 
        />

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
            <Text style={[styles.garageMiles, { color: theme.colors.secondary }]}>
              {distanceText}
            </Text>
          ) : null}
        </View>

        <MaterialCommunityIcons name="chevron-right" size={22} color={theme.colors.placeholder} />
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
                style={{ marginRight: 3 }}
              />
              <Text
                style={[
                  styles.headerLocationCity,
                  { color: isOutsideUKServiceArea ? '#DC2626' : theme.colors.text },
                ]}
                numberOfLines={1}
              >
                {formatPreciseLocation(activeCoordinates)}
              </Text>
              <MaterialCommunityIcons
                name="chevron-down"
                size={13}
                color={isOutsideUKServiceArea ? '#DC2626' : theme.colors.placeholder}
                style={{ marginLeft: 2 }}
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
              activeServiceFilter ? { backgroundColor: theme.colors.primary + '18' } : null,
            ]}
            onPress={() => setServiceModalVisible(true)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons
              name={activeServiceFilter ? 'filter' : 'filter-variant'}
              size={19}
              color={activeServiceFilter ? theme.colors.primary : theme.colors.placeholder}
            />
            {Boolean(activeServiceFilter) && (
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

      {/* Active Service Filter Banner - Compact */}
      {(activeServiceTitle.length > 0 || activeServiceFilter.length > 0) && !loading && !error && (
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
              <Text style={{ fontWeight: '500', color: theme.colors.placeholder }}>Service: </Text>
              <Text style={{ fontWeight: '700', color: theme.colors.text }}>
                {activeServiceTitle || activeServiceFilter}
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
              Multiple MOT operates exclusively across the United Kingdom (England, Scotland, Wales & Northern Ireland). No registered MOT testing stations are available in your selected area.
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
              : activeServiceFilter.trim()
              ? `No registered garages found offering "${activeServiceTitle || activeServiceFilter}".`
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
        onSelectService={handleSelectServiceFilter}
        garages={garages}
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
    fontSize: 16,
    fontWeight: 'bold',
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
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981',
  },
  headerLocationCol: {
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: 270,
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
  },
  headerLocationCity: {
    fontSize: 13,
    fontWeight: '800',
    maxWidth: 220,
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
    fontSize: 14,
    fontWeight: '800',
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
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexGrow: 1,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    elevation: 0,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  logoSmall: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  infoContainer: {
    flex: 1,
    marginHorizontal: 10,
    justifyContent: 'center',
  },
  garageNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  garageName: {
    fontSize: 14,
    fontWeight: 'bold',
    flex: 1,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  garageAddress: {
    fontSize: 11,
    flex: 1,
  },
  garageMiles: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
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
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorText: {
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
    color: '#FFFFFF',
    fontWeight: 'bold',
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
    fontSize: 12,
    fontWeight: '600',
  },
  clearFilterLink: {
    fontSize: 12,
    fontWeight: 'bold',
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
    fontSize: 12,
    fontWeight: '700',
    color: '#D97706',
  },
  unavailableTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  unavailableDesc: {
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
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  presetHeading: {
    fontSize: 12,
    fontWeight: '600',
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
    fontSize: 12,
    fontWeight: '600',
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
    fontSize: 12,
  },
  serviceCountBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  serviceCountText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
});
