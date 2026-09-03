import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues, BASE_URL } from '../context/DataContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

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

const GarageCoverBanner = ({ uri, imagesCount, rating, distance, theme }: any) => {
  const [error, setError] = useState(false);

  return (
    <View style={styles.bannerContainer}>
      {error || !uri ? (
        <View style={[styles.bannerPlaceholder, { backgroundColor: theme.colors.card }]}>
          <MaterialCommunityIcons name="garage-open-variant" size={40} color={theme.colors.placeholder} />
        </View>
      ) : (
        <Image
          source={{ uri }}
          style={styles.bannerImage}
          onError={() => setError(true)}
        />
      )}
      
      {/* Top Left: Approved MOT Tag */}
      <View style={styles.bannerTagTopLeft}>
        <MaterialCommunityIcons name="shield-check" size={12} color="#10B981" style={{ marginRight: 3 }} />
        <Text style={styles.bannerTagText}>DVSA Approved</Text>
      </View>

      {/* Top Right: Photos Count */}
      {imagesCount > 0 && (
        <View style={styles.bannerTagTopRight}>
          <MaterialCommunityIcons name="camera" size={11} color="#FFFFFF" style={{ marginRight: 3 }} />
          <Text style={styles.bannerTagPhotoCount}>{imagesCount} {imagesCount === 1 ? 'Photo' : 'Photos'}</Text>
        </View>
      )}

      {/* Bottom Floating Chips: Rating & Distance */}
      <View style={styles.bannerBottomChips}>
        <View style={styles.bannerChip}>
          <MaterialCommunityIcons name="star" size={12} color="#F59E0B" />
          <Text style={styles.bannerChipText}>{rating ? Number(rating).toFixed(1) : '4.8'}</Text>
        </View>
        <View style={styles.bannerChip}>
          <MaterialCommunityIcons name="map-marker" size={12} color="#FFFFFF" />
          <Text style={styles.bannerChipText}>{distance ? `${Number(distance).toFixed(1)} mi` : '1.5 mi'}</Text>
        </View>
      </View>
    </View>
  );
};

export default function GarageListScreen({ route, navigation }: any) {
  const { theme } = useAppTheme();
  const { token } = useAppValues();

  const [garages, setGarages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(route?.params?.searchQuery || route?.params?.search || '');
  const [error, setError] = useState<string | null>(null);

  // Sync searchQuery when navigating with parameters
  useFocusEffect(
    React.useCallback(() => {
      if (route?.params?.searchQuery !== undefined) {
        setSearchQuery(route.params.searchQuery);
      } else if (route?.params?.search !== undefined) {
        setSearchQuery(route.params.search);
      }
    }, [route?.params?.searchQuery, route?.params?.search])
  );

  const handleClearSearch = () => {
    setSearchQuery('');
    navigation.setParams({ searchQuery: '', search: '' });
  };

  const fetchGaragesList = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${BASE_URL}/garages`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        throw new Error('Failed to load garages.');
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

  const filteredGarages = garages.filter((g) => {
    const q = (searchQuery || '').toLowerCase().trim();
    if (!q) return true;
    return (
      (g.name && g.name.toLowerCase().includes(q)) ||
      (g.address && g.address.toLowerCase().includes(q)) ||
      (g.description && g.description.toLowerCase().includes(q))
    );
  });

  const renderGarageItem = ({ item }: { item: any }) => {
    const coverUri = (item.images && item.images.length > 0) ? item.images[0] : (item.logoUrl || '');
    const imagesCount = item.images ? item.images.length : (item.logoUrl ? 1 : 0);

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
        activeOpacity={0.88}
        onPress={() => navigation.navigate('GarageDetail', { garageId: item.id, vehicle: route.params?.vehicle })}
      >
        {/* Garage Photo Banner */}
        <GarageCoverBanner
          uri={coverUri}
          imagesCount={imagesCount}
          rating={item.rating}
          distance={item.distance}
          theme={theme}
        />

        <View style={styles.cardContent}>
          <View style={styles.cardMainRow}>
            <GarageLogo 
              uri={item.logoUrl} 
              name={item.name} 
              style={styles.logoSmall} 
              theme={theme} 
            />

            <View style={styles.infoContainer}>
              <Text style={[styles.garageName, { color: theme.colors.text }]} numberOfLines={1}>{item.name}</Text>
              
              <View style={styles.addressRow}>
                <MaterialCommunityIcons name="map-marker-outline" size={13} color={theme.colors.placeholder} style={{ marginRight: 3 }} />
                <Text style={[styles.garageAddress, { color: theme.colors.placeholder }]} numberOfLines={1}>
                  {item.address}
                </Text>
              </View>
            </View>

            <View style={[styles.bookPill, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.bookPillText}>Book MOT</Text>
            </View>
          </View>

          <View style={[styles.cardFooter, { borderTopColor: theme.colors.border + '50' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="clock-outline" size={12} color={theme.colors.placeholder} style={{ marginRight: 4 }} />
              <Text style={[styles.hoursText, { color: theme.colors.placeholder }]}>
                {item.openingTime || '08:00'} - {item.closingTime || '18:00'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="calendar-check-outline" size={12} color={theme.colors.secondary} style={{ marginRight: 4 }} />
              <Text style={[styles.daysText, { color: theme.colors.secondary }]}>
                {item.workingDays && item.workingDays.length > 0 ? `${item.workingDays[0].substring(0, 3)} - ${item.workingDays[item.workingDays.length - 1].substring(0, 3)}` : 'Mon - Fri'}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Available Garages</Text>
        <Text style={[styles.subtitle, { color: theme.colors.placeholder }]}>
          Compare services, check ratings, and book your MOT appointments.
        </Text>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <MaterialCommunityIcons name="magnify" size={20} color={theme.colors.placeholder} style={styles.searchIcon} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by name, city, or postcode..."
          placeholderTextColor={theme.colors.placeholder}
          style={[styles.searchInput, { color: theme.colors.text }]}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={handleClearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialCommunityIcons name="close-circle" size={18} color={theme.colors.placeholder} />
          </TouchableOpacity>
        )}
      </View>

      {/* Active Filter Pill */}
      {searchQuery.trim().length > 0 && !loading && !error && (
        <View style={[styles.searchFilterBadge, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <MaterialCommunityIcons name="filter-variant" size={14} color={theme.colors.secondary} style={{ marginRight: 6 }} />
          <Text style={[styles.searchFilterText, { color: theme.colors.text, flex: 1 }]} numberOfLines={1}>
            Found {filteredGarages.length} {filteredGarages.length === 1 ? 'garage' : 'garages'} for "{searchQuery.trim()}"
          </Text>
          <TouchableOpacity onPress={handleClearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.clearFilterLink, { color: theme.colors.primary }]}>Show All</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.text }]}>Finding nearest garages...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={theme.colors.error} />
          <Text style={[styles.errorText, { color: theme.colors.text }]}>{error}</Text>
          <TouchableOpacity style={[styles.retryButton, { backgroundColor: theme.colors.primary }]} onPress={fetchGaragesList}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filteredGarages.length === 0 ? (
        <View style={styles.centerContainer}>
          <MaterialCommunityIcons name="store-search-outline" size={48} color={theme.colors.placeholder} />
          <Text style={[styles.errorText, { color: theme.colors.placeholder }]}>
            {searchQuery.trim() ? `No garages found matching "${searchQuery.trim()}".` : 'No garages match your criteria.'}
          </Text>
          {searchQuery.trim().length > 0 && (
            <TouchableOpacity 
              style={[styles.retryButton, { backgroundColor: theme.colors.secondary, marginTop: 14 }]} 
              onPress={handleClearSearch}
            >
              <Text style={styles.retryButtonText}>Show All Garages</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredGarages}
          keyExtractor={(item) => item.id}
          renderItem={renderGarageItem}
          contentContainerStyle={styles.listContent}
          refreshing={loading}
          onRefresh={fetchGaragesList}
        />
      )}
    </View>
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
    lineHeight: 14,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 21,
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
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    overflow: 'hidden',
  },
  bannerContainer: {
    width: '100%',
    height: 125,
    position: 'relative',
    backgroundColor: '#F3F4F6',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  bannerPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerTagTopLeft: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  bannerTagText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  bannerTagTopRight: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  bannerTagPhotoCount: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  bannerBottomChips: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    gap: 6,
  },
  bannerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    gap: 3,
  },
  bannerChipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  cardContent: {
    padding: 12,
  },
  cardMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    marginLeft: 10,
    marginRight: 8,
  },
  garageName: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  garageAddress: {
    fontSize: 11,
    flex: 1,
  },
  bookPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  bookPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  hoursText: {
    fontSize: 11,
  },
  daysText: {
    fontSize: 11,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
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
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
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
});
