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
  const { token } = useAppValues();

  const [garages, setGarages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

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

  const filteredGarages = garages.filter((g) =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderGarageItem = ({ item }: { item: any }) => {
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
        onPress={() => navigation.navigate('GarageDetail', { garageId: item.id, vehicle: route.params?.vehicle })}
      >
        <View style={styles.cardLayout}>
          <GarageLogo 
            uri={item.logoUrl} 
            name={item.name} 
            style={styles.logo} 
            theme={theme} 
          />

          <View style={styles.infoContainer}>
            <Text style={[styles.garageName, { color: theme.colors.text }]}>{item.name}</Text>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <MaterialCommunityIcons name="map-marker-outline" size={13} color={theme.colors.placeholder} style={{ marginRight: 4 }} />
              <Text style={[styles.garageAddress, { color: theme.colors.placeholder, marginBottom: 0 }]} numberOfLines={1}>
                {item.address}
              </Text>
            </View>

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <MaterialCommunityIcons name="star" size={14} color="#F59E0B" />
                <Text style={[styles.metaText, { color: theme.colors.text }]}>
                  {item.rating ? item.rating.toFixed(1) : '4.5'}
                </Text>
              </View>
              <View style={styles.metaItem}>
                <MaterialCommunityIcons name="map-marker" size={14} color={theme.colors.placeholder} />
                <Text style={[styles.metaText, { color: theme.colors.placeholder }]}>
                  {item.distance ? `${item.distance.toFixed(1)} miles` : '1.5 miles'}
                </Text>
              </View>
            </View>

            <View style={styles.badgeRow}>
              <View style={[styles.statusBadge, { backgroundColor: theme.colors.success + '15' }]}>
                <Text style={[styles.statusBadgeText, { color: theme.colors.success }]}>Approved</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <MaterialCommunityIcons name="clock-outline" size={12} color={theme.colors.placeholder} />
                <Text style={[styles.hoursText, { color: theme.colors.placeholder }]}>
                  {item.openingTime || '08:00'} - {item.closingTime || '18:00'}
                </Text>
              </View>
            </View>
          </View>

          <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.placeholder} style={styles.chevron} />
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
          placeholder="Search by name or city..."
          placeholderTextColor={theme.colors.placeholder}
          style={[styles.searchInput, { color: theme.colors.text }]}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <MaterialCommunityIcons name="close-circle" size={18} color={theme.colors.placeholder} />
          </TouchableOpacity>
        )}
      </View>

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
          <Text style={[styles.errorText, { color: theme.colors.placeholder }]}>No garages match your criteria.</Text>
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
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    overflow: 'hidden',
  },
  cardLayout: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  logo: {
    width: 52,
    height: 52,
    borderRadius: 8,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  infoContainer: {
    flex: 1,
    marginLeft: 10,
  },
  garageName: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 1,
  },
  garageAddress: {
    fontSize: 11,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  metaText: {
    fontSize: 11,
    fontWeight: '600',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  hoursText: {
    fontSize: 10,
  },
  chevron: {
    marginLeft: 6,
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
});
