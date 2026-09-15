import { Linking, Platform, Alert, PermissionsAndroid } from 'react-native';

// Safe lazy loading for native Geolocation to prevent crash if native app is not rebuilt yet
let SafeGeolocation: any = null;
try {
  const geoModule = require('@react-native-community/geolocation');
  SafeGeolocation = geoModule?.default || geoModule;
} catch (e) {
  // Native bridge not linked yet in APK
}

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
  cityName?: string;
  countryName?: string;
  isWithinUK?: boolean;
}

// Default Fallback UK Location (London Central)
export const DEFAULT_UK_LOCATION: Coordinates = {
  latitude: 51.5074,
  longitude: -0.1278,
  label: 'London Central (UK)',
  cityName: 'London',
  countryName: 'United Kingdom',
  isWithinUK: true,
};

// Preset UK Locations for Quick Selection & Testing
export const UK_PRESET_LOCATIONS: Record<string, Coordinates> = {
  'London Central': { latitude: 51.5074, longitude: -0.1278, label: 'Central London (SW1A)', cityName: 'London', countryName: 'United Kingdom', isWithinUK: true },
  'London North': { latitude: 51.5414, longitude: -0.1444, label: 'Camden / North London (NW1)', cityName: 'London', countryName: 'United Kingdom', isWithinUK: true },
  'London South': { latitude: 51.4816, longitude: -0.0910, label: 'Southwark / London (SE1)', cityName: 'London', countryName: 'United Kingdom', isWithinUK: true },
  'Manchester': { latitude: 53.4808, longitude: -2.2426, label: 'Manchester City Centre (M1)', cityName: 'Manchester', countryName: 'United Kingdom', isWithinUK: true },
  'Birmingham': { latitude: 52.4862, longitude: -1.8904, label: 'Birmingham Centre (B3)', cityName: 'Birmingham', countryName: 'United Kingdom', isWithinUK: true },
  'Leeds': { latitude: 53.7968, longitude: -1.5489, label: 'Leeds City Centre (LS1)', cityName: 'Leeds', countryName: 'United Kingdom', isWithinUK: true },
  'Bristol': { latitude: 51.4545, longitude: -2.5979, label: 'Bristol Centre (BS1)', cityName: 'Bristol', countryName: 'United Kingdom', isWithinUK: true },
};

/**
 * Checks if coordinate falls within the geographic boundary of the United Kingdom
 * UK Bounding Box: Latitude ~49.5° to ~61.5° N, Longitude ~-9.0° to ~2.5° E
 */
export const isWithinUKBoundary = (coords: Coordinates | null | undefined): boolean => {
  if (!coords) return false;
  const lat = Number(coords.latitude);
  const lon = Number(coords.longitude);

  if (isNaN(lat) || isNaN(lon)) return false;

  // Exact geographical boundary for England, Scotland, Wales, Northern Ireland, Isle of Man & Channel Islands
  const latInBounds = lat >= 49.5 && lat <= 61.5;
  const lonInBounds = lon >= -9.0 && lon <= 2.5;

  return latInBounds && lonInBounds;
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
 * Reverse geocodes coordinates to a human-readable city/region name
 */
export const reverseGeocodeCoords = async (latitude: number, longitude: number): Promise<{ cityName?: string; countryName?: string; label: string }> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`,
      {
        headers: { 'User-Agent': 'MultipleMOTUK-App/1.0' },
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const city = data.address?.city || data.address?.town || data.address?.state_district || data.address?.state || data.address?.county || 'Current Area';
      const country = data.address?.country || '';
      const label = country ? `${city}, ${country}` : city;
      return { cityName: city, countryName: country, label };
    }
  } catch (e) {
    // Non-blocking fallback
  }

  return { label: `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°` };
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
        cityName: data.result.admin_district || data.result.parish || 'UK Region',
        countryName: 'United Kingdom',
        isWithinUK: true,
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
 * Live GPS / Hardware Location Requester with native permission & boundary checking
 */
export const requestUserLiveLocation = async (): Promise<Coordinates> => {
  try {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'Multiple MOT needs your location to check service availability and find registered garages near you.',
            buttonNeutral: 'Ask Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'Allow',
          }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          return {
            ...DEFAULT_UK_LOCATION,
            label: 'Location Denied (London Demo)',
          };
        }
      } catch (pErr) {
        // Permission prompt failed
      }
    }

    // Use native @react-native-community/geolocation if available and linked
    let nativeCoords: { latitude: number; longitude: number } | null = null;
    if (SafeGeolocation && typeof SafeGeolocation.getCurrentPosition === 'function') {
      nativeCoords = await new Promise<{ latitude: number; longitude: number } | null>((resolve) => {
        try {
          SafeGeolocation.getCurrentPosition(
            (pos: any) => {
              if (pos && pos.coords) {
                resolve({
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude,
                });
              } else {
                resolve(null);
              }
            },
            (err: any) => {
              console.log('Native GPS error, falling back:', err?.message);
              resolve(null);
            },
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 30000 }
          );
        } catch (geoErr) {
          resolve(null);
        }
      });
    }

    if (nativeCoords) {
      const isUk = isWithinUKBoundary(nativeCoords);
      const geoInfo = await reverseGeocodeCoords(nativeCoords.latitude, nativeCoords.longitude);

      return {
        latitude: nativeCoords.latitude,
        longitude: nativeCoords.longitude,
        cityName: geoInfo.cityName,
        countryName: geoInfo.countryName,
        label: geoInfo.label,
        isWithinUK: isUk,
      };
    }

    // Primary IP-based Geolocation fallback if GPS hardware is not connected or in emulator
    try {
      const ipRes = await fetch('https://ipwho.is/');
      if (ipRes.ok) {
        const ipData = await ipRes.json();
        if (ipData.success !== false && ipData.latitude && ipData.longitude) {
          const lat = Number(ipData.latitude);
          const lon = Number(ipData.longitude);
          const city = ipData.city || 'Local Area';
          const country = ipData.country || '';
          const label = country ? `${city}, ${country}` : city;
          const coords = {
            latitude: lat,
            longitude: lon,
            cityName: city,
            countryName: country,
            label,
          };
          return {
            ...coords,
            isWithinUK: isWithinUKBoundary(coords),
          };
        }
      }
    } catch (ipErr) {
      console.log('ipwho.is lookup failed:', ipErr);
    }

    // Secondary IP fallback
    try {
      const secRes = await fetch('https://freeipapi.com/api/json');
      if (secRes.ok) {
        const secData = await secRes.json();
        if (secData.latitude && secData.longitude) {
          const lat = Number(secData.latitude);
          const lon = Number(secData.longitude);
          const city = secData.cityName || 'Local Area';
          const country = secData.countryName || '';
          const label = country ? `${city}, ${country}` : city;
          const coords = {
            latitude: lat,
            longitude: lon,
            cityName: city,
            countryName: country,
            label,
          };
          return {
            ...coords,
            isWithinUK: isWithinUKBoundary(coords),
          };
        }
      }
    } catch (secErr) {
      console.log('Secondary IP lookup failed:', secErr);
    }

    // Default UK London fallback if all networks are offline
    return DEFAULT_UK_LOCATION;
  } catch (e) {
    return DEFAULT_UK_LOCATION;
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
