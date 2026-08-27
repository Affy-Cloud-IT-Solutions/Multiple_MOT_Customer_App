import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues, BASE_URL } from '../context/DataContext';
import { SafeAreaView } from 'react-native-safe-area-context';

const GarageLogo = ({ uri, name, style, theme }: any) => {
  const [error, setError] = useState(false);

  if (error || !uri) {
    return (
      <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.secondary + '20' }]}>
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

const GarageCarouselImage = ({ uri, style, width }: any) => {
  const [error, setError] = useState(false);

  if (error || !uri) {
    return (
      <View style={[style, { width, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6' }]}>
        <MaterialCommunityIcons name="image-off-outline" size={32} color="#9CA3AF" />
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

export default function GarageDetailScreen({ route, navigation }: any) {
  const { theme } = useAppTheme();
  const { token } = useAppValues();
  const { garageId } = route.params;
  const { width: screenWidth } = Dimensions.get('window');

  const [garage, setGarage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGarageDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${BASE_URL}/garages/${garageId}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        throw new Error('Failed to load garage details.');
      }
      const data = await response.json();
      setGarage(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Could not connect to server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGarageDetails();
  }, [garageId, token]);

  const getServiceIcon = (name: string) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('mot')) {
      return 'file-document-check';
    } else if (lowerName.includes('service')) {
      return 'wrench-clock';
    } else if (lowerName.includes('repair') || lowerName.includes('brake') || lowerName.includes('engine')) {
      return 'car-cog';
    }
    return 'cog-outline';
  };

  const handleSelectService = (service: any) => {
    // Navigate to Booking screen and pass the garage and service context details
    navigation.navigate('Booking', {
      garageId: garage.id,
      garageName: garage.name,
      serviceName: service.name,
      price: service.price,
      duration: service.duration,
      vehicle: route.params?.vehicle,
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={{ marginTop: 12, color: theme.colors.text }}>Loading garage details...</Text>
      </View>
    );
  }

  if (error || !garage) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color={theme.colors.error} />
        <Text style={{ marginTop: 12, fontSize: 16, color: theme.colors.text, textAlign: 'center' }}>
          {error || 'Garage details not found.'}
        </Text>
        <TouchableOpacity style={[styles.retryButton, { backgroundColor: theme.colors.primary }]} onPress={fetchGarageDetails}>
          <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Horizontal Garage Images Showcase */}
        {garage.images && garage.images.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            pagingEnabled
            style={styles.imagesCarousel}
          >
            {garage.images.map((imgUrl: string, idx: number) => (
              <GarageCarouselImage 
                key={`${imgUrl}-${idx}`} 
                uri={imgUrl} 
                style={[styles.carouselImage, { width: screenWidth }]} 
                width={screenWidth}
              />
            ))}
          </ScrollView>
        ) : (
          <GarageCarouselImage
            uri='https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=600&h=300&fit=crop'
            style={[styles.heroImage, { width: screenWidth }]}
            width={screenWidth}
          />
        )}

        {/* Banner Logo Section */}
        <View style={[styles.headerCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={styles.headerRow}>
            <GarageLogo 
              uri={garage.logoUrl} 
              name={garage.name} 
              style={styles.logo} 
              theme={theme} 
            />
            <View style={styles.headerInfo}>
              <Text style={[styles.garageName, { color: theme.colors.text }]}>{garage.name}</Text>
              <View style={styles.ratingRow}>
                <MaterialCommunityIcons name="star" size={16} color="#F59E0B" />
                <Text style={[styles.ratingText, { color: theme.colors.text }]}>
                  {garage.rating ? garage.rating.toFixed(1) : '4.5'}
                </Text>
                <Text style={{ color: theme.colors.placeholder, marginLeft: 8 }}>•</Text>
                <Text style={[styles.distanceText, { color: theme.colors.placeholder, marginLeft: 8 }]}>
                  {garage.distance ? `${garage.distance.toFixed(1)} miles` : '1.5 miles'}
                </Text>
              </View>
            </View>
          </View>

          <Text style={[styles.description, { color: theme.colors.text }]}>
            {garage.description || 'Welcome to our garage checkups. We offer reliable, fast, and approved MOT testing and vehicle diagnostics.'}
          </Text>
        </View>

        {/* Location & Details */}
        <View style={[styles.sectionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Garage Information</Text>
          
          <View style={styles.infoItem}>
            <MaterialCommunityIcons name="map-marker" size={18} color={theme.colors.secondary} style={styles.infoIcon} />
            <Text style={[styles.infoText, { color: theme.colors.text }]}>{garage.address}</Text>
          </View>

          <View style={styles.infoItem}>
            <MaterialCommunityIcons name="clock-outline" size={18} color={theme.colors.secondary} style={styles.infoIcon} />
            <Text style={[styles.infoText, { color: theme.colors.text }]}>
              {garage.openingTime || '08:00'} - {garage.closingTime || '18:00'}
            </Text>
          </View>

          <View style={styles.infoItem}>
            <MaterialCommunityIcons name="calendar-range" size={18} color={theme.colors.secondary} style={styles.infoIcon} />
            <Text style={[styles.infoText, { color: theme.colors.text }]}>
              Open Days: {garage.workingDays ? garage.workingDays.join(', ') : 'Mon - Fri'}
            </Text>
          </View>
        </View>

        {/* Available Services List */}
        <View style={styles.servicesSection}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text, marginHorizontal: 20 }]}>Available Services</Text>

          {(!garage.services || garage.services.length === 0) ? (
            <View style={[styles.emptyServices, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <MaterialCommunityIcons name="wrench-outline" size={32} color={theme.colors.placeholder} />
              <Text style={{ color: theme.colors.placeholder, marginTop: 8, fontSize: 13, fontStyle: 'italic' }}>
                No services defined by this garage yet.
              </Text>
            </View>
          ) : (
            garage.services.map((service: any) => (
              <View 
                key={service._id || service.name} 
                style={[styles.serviceCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
              >
                <View style={[styles.serviceIconCircle, { backgroundColor: theme.colors.secondary + '15' }]}>
                  <MaterialCommunityIcons name={getServiceIcon(service.name)} size={22} color={theme.colors.secondary} />
                </View>
                <View style={styles.serviceInfo}>
                  <Text style={[styles.serviceName, { color: theme.colors.text }]}>{service.name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    <MaterialCommunityIcons name="timer-outline" size={13} color={theme.colors.placeholder} style={{ marginRight: 4 }} />
                    <Text style={[styles.serviceMeta, { color: theme.colors.placeholder }]}>
                      {service.duration || 45} mins
                    </Text>
                  </View>
                </View>
                <View style={styles.serviceRight}>
                  <Text style={[styles.servicePrice, { color: theme.colors.text }]}>£{service.price ? service.price.toFixed(2) : '45.00'}</Text>
                  <TouchableOpacity
                    style={[styles.bookBtn, { backgroundColor: theme.colors.primary }]}
                    onPress={() => handleSelectService(service)}
                  >
                    <Text style={styles.bookBtnText}>Book</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  headerCard: {
    borderBottomWidth: 1,
    padding: 12,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  headerInfo: {
    marginLeft: 12,
    flex: 1,
  },
  garageName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  distanceText: {
    fontSize: 12,
  },
  description: {
    fontSize: 12,
    lineHeight: 16,
  },
  sectionCard: {
    marginHorizontal: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoIcon: {
    marginRight: 8,
  },
  infoText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  servicesSection: {
    marginTop: 4,
  },
  emptyServices: {
    marginHorizontal: 12,
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceCard: {
    marginHorizontal: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serviceIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  serviceInfo: {
    flex: 1,
    paddingRight: 10,
  },
  serviceName: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 3,
  },
  serviceMeta: {
    fontSize: 11,
  },
  serviceRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  servicePrice: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  bookBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  retryButton: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 6,
  },
  imagesCarousel: {
    height: 160,
    width: '100%',
  },
  carouselImage: {
    height: 160,
    resizeMode: 'cover',
  },
  heroImage: {
    height: 160,
    resizeMode: 'cover',
  },
});
