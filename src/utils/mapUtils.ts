import { Linking, Platform, Alert, PermissionsAndroid } from 'react-native';

export interface GarageLocationTarget {
  name?: string;
  address?: string;
  city?: string;
  postcode?: string;
  latitude?: number | string;
  longitude?: number | string;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
  label?: string;
}

// Preset UK Locations for Simulator Testing & Quick Selection
export const UK_PRESET_LOCATIONS: Record<string, Coordinates> = {
  'London Central': { latitude: 51.5074, longitude: -0.1278, label: 'Central London (SW1A)' },
  'London North': { latitude: 51.5414, longitude: -0.1444, label: 'Camden / North London (NW1)' },
  'London South': { latitude: 51.4816, longitude: -0.0910, label: 'Southwark / London (SE1)' },
  'Manchester': { latitude: 53.4808, longitude: -2.2426, label: 'Manchester City Centre (M1)' },
  'Birmingham': { latitude: 52.4862, longitude: -1.8904, label: 'Birmingham Centre (B3)' },
  'Leeds': { latitude: 53.7968, longitude: -1.5489, label: 'Leeds City Centre (LS1)' },
  'Bristol': { latitude: 51.4545, longitude: -2.5979, label: 'Bristol Centre (BS1)' },
};

/**
 * Calculates geodesic distance in statute miles between two coordinate pairs using Haversine formula
 */
export const calculateDistanceInMiles = (
  lat1: number | string | null | undefined,
  lon1: number | string | null | undefined,
  lat2: number | string | null | undefined,
  lon2: number | string | null | undefined
): number => {
  const nLat1 = typeof lat1 === 'string' ? parseFloat(lat1) : lat1;
  const nLon1 = typeof lon1 === 'string' ? parseFloat(lon1) : lon1;
  const nLat2 = typeof lat2 === 'string' ? parseFloat(lat2) : lat2;
  const nLon2 = typeof lon2 === 'string' ? parseFloat(lon2) : lon2;

  if (
    nLat1 === null || nLat1 === undefined || isNaN(nLat1) ||
    nLon1 === null || nLon1 === undefined || isNaN(nLon1) ||
    nLat2 === null || nLat2 === undefined || isNaN(nLat2) ||
    nLon2 === null || nLon2 === undefined || isNaN(nLon2)
  ) {
    return 0;
  }

  const R = 3958.8; // Earth radius in statute miles
  const dLat = ((nLat2 - nLat1) * Math.PI) / 180;
  const dLon = ((nLon2 - nLon1) * Math.PI) / 180;
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((nLat1 * Math.PI) / 180) *
      Math.cos((nLat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
      
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 10) / 10; // 1 decimal precision e.g. 2.4 mi
};

/**
 * Resolves UK Postcode to exact GPS Coordinates via api.postcodes.io
 */
export const getCoordinatesFromUKPostcode = async (postcode: string): Promise<Coordinates | null> => {
  try {
    const clean = postcode.trim().replace(/\s+/g, '').toUpperCase();
    if (!clean) return null;

    const res = await fetch(`https://api.postcodes.io/postcodes/${clean}`);
    if (!res.ok) return null;

    const data = await res.json();
    if (data.status === 200 && data.result) {
      return {
        latitude: data.result.latitude,
        longitude: data.result.longitude,
        label: `${postcode.toUpperCase()} (${data.result.admin_district || data.result.parish || 'UK'})`,
      };
    }
  } catch (err) {
    // Non-blocking
  }
  return null;
};

/**
 * Resolves city name or query to coordinates (from known UK presets or postcode resolver)
 */
export const getCoordinatesFromLocationQuery = async (query: string): Promise<Coordinates | null> => {
  const q = query.trim();
  if (!q) return null;

  // Check preset UK cities first
  const lower = q.toLowerCase();
  for (const [cityName, coords] of Object.entries(UK_PRESET_LOCATIONS)) {
    if (lower.includes(cityName.toLowerCase()) || cityName.toLowerCase().includes(lower)) {
      return coords;
    }
  }

  // Try UK Postcode resolver
  const pcCoords = await getCoordinatesFromUKPostcode(q);
  if (pcCoords) return pcCoords;

  return null;
};

/**
 * Live GPS / Current Location Requester with native permission & UK fallback
 */
export const requestUserLiveLocation = async (): Promise<Coordinates | null> => {
  try {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'Multiple MOT needs access to your location to find registered garages nearest to you.',
            buttonNeutral: 'Ask Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          // If denied, fallback to default UK location
          return { latitude: 51.5074, longitude: -0.1278, label: 'London (Default Location)' };
        }
      } catch (pErr) {
        // Permission prompt failed
      }
    }

    // Try native / polyfilled geolocation
    const coords = await new Promise<Coordinates | null>((resolve) => {
      const globalNav = (globalThis as any).navigator;
      if (globalNav && globalNav.geolocation) {
        globalNav.geolocation.getCurrentPosition(
          (pos: any) => {
            if (pos && pos.coords) {
              resolve({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                label: 'Current Live GPS Location',
              });
            } else {
              resolve(null);
            }
          },
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 6000 }
        );
        return;
      }
      resolve(null);
    });

    if (coords) return coords;

    // Fallback to IP geolocation if GPS is unavailable in emulator
    try {
      const ipRes = await fetch('https://ipapi.co/json/');
      if (ipRes.ok) {
        const ipData = await ipRes.json();
        if (ipData.latitude && ipData.longitude) {
          return {
            latitude: Number(ipData.latitude),
            longitude: Number(ipData.longitude),
            label: `${ipData.city || 'Local Area'} (Network Location)`,
          };
        }
      }
    } catch (ipErr) {
      // IP lookup failed
    }

    // Default UK London fallback
    return { latitude: 51.5074, longitude: -0.1278, label: 'London, UK' };
  } catch (e) {
    return { latitude: 51.5074, longitude: -0.1278, label: 'London, UK' };
  }
};

/**
 * Opens native turn-by-turn navigation (Google Maps / Apple Maps) to the target garage
 */
export const openGarageDirections = (target: GarageLocationTarget) => {
  const { name = 'Garage', address = '', city = '', postcode = '', latitude, longitude } = target;

  const lat = latitude ? parseFloat(String(latitude)) : null;
  const lng = longitude ? parseFloat(String(longitude)) : null;

  const hasCoords = lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;

  if (hasCoords) {
    const label = encodeURIComponent(name);
    const destination = `${lat},${lng}`;

    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${destination}`,
      android: `google.navigation:q=${destination}&mode=d`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${destination}`
    });

    const webFallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;

    Linking.canOpenURL(url || '').then((supported) => {
      if (supported) {
        Linking.openURL(url || '');
      } else {
        Linking.openURL(webFallbackUrl);
      }
    }).catch(() => {
      Linking.openURL(webFallbackUrl);
    });
    return;
  }

  // Fallback to text address & postcode
  const fullAddress = [name, address, city, postcode].filter(Boolean).join(', ');
  if (fullAddress.trim()) {
    const encoded = encodeURIComponent(fullAddress.trim());
    const addressUrl = Platform.select({
      ios: `maps:0,0?q=${encoded}`,
      android: `geo:0,0?q=${encoded}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${encoded}`
    });
    const webFallback = `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;

    Linking.canOpenURL(addressUrl || '').then((supported) => {
      if (supported) {
        Linking.openURL(addressUrl || '');
      } else {
        Linking.openURL(webFallback);
      }
    }).catch(() => {
      Linking.openURL(webFallback);
    });
    return;
  }

  Alert.alert(
    'Location Unavailable',
    'The physical address or coordinates for this garage are not currently available.'
  );
};
