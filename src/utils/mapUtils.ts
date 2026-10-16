import { Linking, Platform, Alert, PermissionsAndroid } from 'react-native';

// Safe lazy loading for native Geolocation to prevent crash if native app is not rebuilt yet
let SafeGeolocation: any = null;
try {
  const geoModule = require('@react-native-community/geolocation');
  SafeGeolocation = geoModule?.default || geoModule;
} catch (e) {
  // Native bridge not linked yet in APK
}

export const GOOGLE_MAPS_API_KEY = 'AIzaSyCCiW08B0GTFjP1uj4LZ3QnqKzUVSuYcH0';

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
  address?: string;
  suburb?: string;
  road?: string;
  postcode?: string;
}

/**
 * Returns a concise, user-friendly, precise location display string
 */
export const formatPreciseLocation = (coords: Coordinates | null | undefined): string => {
  if (!coords) return 'Select Location';
  if (coords.label && coords.label.trim()) {
    return coords.label.replace(/, United Kingdom$/i, '').trim();
  }
  if (coords.address && coords.address.trim()) {
    return coords.address.trim();
  }
  return coords.cityName || 'United Kingdom';
};

export const formatFullLocation = formatPreciseLocation;

// Preset UK Locations with Precise Addresses, Streets & Postcodes
export const UK_PRESET_LOCATIONS: Record<string, Coordinates> = {
  'London Central': {
    latitude: 51.5074,
    longitude: -0.1278,
    label: 'Trafalgar Square, Westminster, London, WC2N 5DU',
    address: 'Trafalgar Sq, Westminster (WC2N)',
    cityName: 'Westminster, London (WC2N)',
    countryName: 'United Kingdom',
    postcode: 'WC2N 5DU',
    isWithinUK: true,
  },
  'London North': {
    latitude: 51.5414,
    longitude: -0.1444,
    label: 'Camden High Street, Camden Town, London, NW1 7JE',
    address: 'Camden High St, Camden Town (NW1)',
    cityName: 'Camden Town, London (NW1)',
    countryName: 'United Kingdom',
    postcode: 'NW1 7JE',
    isWithinUK: true,
  },
  'London South': {
    latitude: 51.4816,
    longitude: -0.091,
    label: 'New Kent Road, Elephant & Castle, Southwark, SE1 6TJ',
    address: 'New Kent Rd, Southwark (SE1)',
    cityName: 'Southwark, London (SE1)',
    countryName: 'United Kingdom',
    postcode: 'SE1 6TJ',
    isWithinUK: true,
  },
  'Manchester': {
    latitude: 53.4808,
    longitude: -2.2426,
    label: 'Piccadilly Gardens, City Centre, Manchester, M1 1RN',
    address: 'Piccadilly Gardens, Manchester (M1)',
    cityName: 'Piccadilly, Manchester (M1)',
    countryName: 'United Kingdom',
    postcode: 'M1 1RN',
    isWithinUK: true,
  },
  'Birmingham': {
    latitude: 52.4862,
    longitude: -1.8904,
    label: 'Colmore Row, Birmingham City Centre, B3 2QD',
    address: 'Colmore Row, Birmingham (B3)',
    cityName: 'Colmore Row, Birmingham (B3)',
    countryName: 'United Kingdom',
    postcode: 'B3 2QD',
    isWithinUK: true,
  },
  'Leeds': {
    latitude: 53.7968,
    longitude: -1.5489,
    label: 'Briggate, Leeds City Centre, LS1 6HD',
    address: 'Briggate, Leeds Centre (LS1)',
    cityName: 'Briggate, Leeds (LS1)',
    countryName: 'United Kingdom',
    postcode: 'LS1 6HD',
    isWithinUK: true,
  },
  'Bristol': {
    latitude: 51.4545,
    longitude: -2.5979,
    label: 'Broadmead, Bristol City Centre, BS1 3EA',
    address: 'Broadmead, Bristol Centre (BS1)',
    cityName: 'Broadmead, Bristol (BS1)',
    countryName: 'United Kingdom',
    postcode: 'BS1 3EA',
    isWithinUK: true,
  },
  'Glasgow': {
    latitude: 55.8642,
    longitude: -4.2518,
    label: 'George Square, Glasgow City Centre, G1 1QX',
    address: 'George Sq, Glasgow Centre (G1)',
    cityName: 'George Square, Glasgow (G1)',
    countryName: 'United Kingdom',
    postcode: 'G1 1QX',
    isWithinUK: true,
  },
  'Liverpool': {
    latitude: 53.4084,
    longitude: -2.9916,
    label: 'Lord Street, Liverpool ONE, Liverpool, L1 8BU',
    address: 'Lord St, Liverpool Centre (L1)',
    cityName: 'Lord St, Liverpool (L1)',
    countryName: 'United Kingdom',
    postcode: 'L1 8BU',
    isWithinUK: true,
  },
  'Edinburgh': {
    latitude: 55.9533,
    longitude: -3.1883,
    label: 'Royal Mile, Old Town, Edinburgh, EH1 2PB',
    address: 'Royal Mile, Old Town (EH1)',
    cityName: 'Royal Mile, Edinburgh (EH1)',
    countryName: 'United Kingdom',
    postcode: 'EH1 2PB',
    isWithinUK: true,
  },
  'Cardiff': {
    latitude: 51.4816,
    longitude: -3.1791,
    label: 'Queen Street, Cardiff City Centre, CF10 2HQ',
    address: 'Queen St, Cardiff Centre (CF10)',
    cityName: 'Queen St, Cardiff (CF10)',
    countryName: 'United Kingdom',
    postcode: 'CF10 2HQ',
    isWithinUK: true,
  },
  'Belfast': {
    latitude: 54.5973,
    longitude: -5.9301,
    label: 'Donegall Square, Belfast City Centre, BT1 5GS',
    address: 'Donegall Sq, Belfast (BT1)',
    cityName: 'Donegall Sq, Belfast (BT1)',
    countryName: 'United Kingdom',
    postcode: 'BT1 5GS',
    isWithinUK: true,
  },
  'Newcastle': {
    latitude: 54.9783,
    longitude: -1.6178,
    label: 'Grey Street, Grainger Town, Newcastle, NE1 6EE',
    address: 'Grey St, Newcastle (NE1)',
    cityName: 'Grey St, Newcastle (NE1)',
    countryName: 'United Kingdom',
    postcode: 'NE1 6EE',
    isWithinUK: true,
  },
  'Sheffield': {
    latitude: 53.3811,
    longitude: -1.4701,
    label: 'Fargate, Sheffield City Centre, S1 2HE',
    address: 'Fargate, Sheffield Centre (S1)',
    cityName: 'Fargate, Sheffield (S1)',
    countryName: 'United Kingdom',
    postcode: 'S1 2HE',
    isWithinUK: true,
  },
};

// Preset Non-UK Test Locations
export const NON_UK_TEST_LOCATIONS: Record<string, Coordinates> = {
  'Bhopal (India)': {
    latitude: 23.2599,
    longitude: 77.4126,
    label: 'Ibrahimpura, Old Bhopal, Madhya Pradesh, 462001, India',
    address: 'Ibrahimpura, Bhopal (462001)',
    cityName: 'Ibrahimpura, Bhopal',
    countryName: 'India',
    postcode: '462001',
    isWithinUK: false,
  },
  'Dubai (UAE)': {
    latitude: 25.2048,
    longitude: 55.2708,
    label: 'Sheikh Mohammed bin Rashid Blvd, Downtown Dubai, UAE',
    address: 'Downtown Dubai, Burj Khalifa Area',
    cityName: 'Downtown, Dubai',
    countryName: 'United Arab Emirates',
    isWithinUK: false,
  },
  'New York (USA)': {
    latitude: 40.7128,
    longitude: -74.006,
    label: 'Broadway, Lower Manhattan, New York, NY 10007, USA',
    address: 'Broadway, Manhattan, NY (10007)',
    cityName: 'Manhattan, New York',
    countryName: 'United States',
    postcode: '10007',
    isWithinUK: false,
  },
};

export const DEFAULT_NON_UK_LOCATION: Coordinates = NON_UK_TEST_LOCATIONS['Bhopal (India)'];

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
 * Reverse geocodes coordinates to a precise human-readable street/suburb address
 */
export const reverseGeocodeCoords = async (
  latitude: number,
  longitude: number
): Promise<{
  cityName?: string;
  countryName?: string;
  address?: string;
  postcode?: string;
  suburb?: string;
  road?: string;
  label: string;
}> => {
  // 1. Google Maps Geocoding API (Fast, precise UK street address)
  if (GOOGLE_MAPS_API_KEY) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const gRes = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);
      if (gRes.ok) {
        const gData = await gRes.json();
        if (gData.status === 'OK' && Array.isArray(gData.results) && gData.results.length > 0) {
          const result = gData.results[0];
          let road = '';
          let suburb = '';
          let city = '';
          let postcode = '';
          let country = '';

          for (const comp of result.address_components || []) {
            const types = comp.types || [];
            if (types.includes('route')) road = comp.long_name || comp.short_name;
            else if (types.includes('sublocality') || types.includes('neighborhood')) suburb = comp.long_name || comp.short_name;
            else if (types.includes('postal_town') || types.includes('locality')) city = comp.long_name || comp.short_name;
            else if (types.includes('postal_code')) postcode = comp.long_name || comp.short_name;
            else if (types.includes('country')) country = comp.long_name || comp.short_name;
          }

          const parts: string[] = [];
          if (road) parts.push(road);
          if (suburb && !parts.some((p) => p.toLowerCase() === suburb.toLowerCase())) parts.push(suburb);
          if (city && !parts.some((p) => p.toLowerCase() === city.toLowerCase())) parts.push(city);
          if (postcode) parts.push(`(${postcode})`);

          const preciseAddress = parts.length > 0 ? parts.join(', ') : result.formatted_address;
          const shortCityDisplay =
            suburb && city && suburb.toLowerCase() !== city.toLowerCase()
              ? `${suburb}, ${city}`
              : road && city
              ? `${road}, ${city}`
              : city || suburb || preciseAddress;

          return {
            cityName: shortCityDisplay,
            countryName: country,
            address: preciseAddress,
            postcode,
            suburb,
            road,
            label: result.formatted_address || preciseAddress,
          };
        }
      }
    } catch (e) {
      // Fallback to nominatim
    }
  }

  // 2. Fallback Nominatim Reverse Geocoding
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    // Call Nominatim with full address details (without zoom limit to get street level)
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
      {
        headers: { 'User-Agent': 'MultipleMOTUK-App/1.0' },
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};

      const road = addr.road || addr.pedestrian || addr.footway || addr.street || '';
      const suburb =
        addr.suburb ||
        addr.neighbourhood ||
        addr.residential ||
        addr.quarter ||
        addr.city_district ||
        '';
      const city =
        addr.city ||
        addr.town ||
        addr.village ||
        addr.municipality ||
        addr.county ||
        addr.state_district ||
        '';
      const postcode = addr.postcode || '';
      const country = addr.country || '';

      // Build clean, concise street and locality address
      const parts: string[] = [];
      if (road) parts.push(road);
      if (suburb && !parts.some((p) => p.toLowerCase() === suburb.toLowerCase())) parts.push(suburb);
      if (city && !parts.some((p) => p.toLowerCase() === city.toLowerCase())) parts.push(city);
      if (postcode) parts.push(`(${postcode})`);

      const preciseAddress =
        parts.length > 0
          ? parts.join(', ')
          : data.display_name?.split(',').slice(0, 3).join(', ') || city || 'Current Location';

      const shortCityDisplay =
        suburb && city && suburb.toLowerCase() !== city.toLowerCase()
          ? `${suburb}, ${city}`
          : road && city
          ? `${road}, ${city}`
          : city || suburb || preciseAddress;

      const label = data.display_name || (country ? `${preciseAddress}, ${country}` : preciseAddress);

      return {
        cityName: shortCityDisplay,
        countryName: country,
        address: preciseAddress,
        postcode,
        suburb,
        road,
        label,
      };
    }
  } catch (e) {
    // Non-blocking fallback
  }

  return {
    label: `${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`,
    address: `${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`,
  };
};

/**
 * Resolves UK Postcode to exact GPS Coordinates & street/ward address via api.postcodes.io
 */
export const getCoordinatesFromUKPostcode = async (postcode: string): Promise<Coordinates | null> => {
  try {
    const clean = postcode.trim().replace(/\s+/g, '').toUpperCase();
    if (!clean) return null;

    const res = await fetch(`https://api.postcodes.io/postcodes/${clean}`);
    if (!res.ok) return null;

    const data = await res.json();
    if (data.status === 200 && data.result) {
      const r = data.result;
      const locality = r.admin_ward || r.parish || r.admin_district || 'UK';
      const district = r.admin_district || '';
      const pcFormatted = `${r.outcode} ${r.incode}`;
      const preciseAddress =
        locality && district && locality.toLowerCase() !== district.toLowerCase()
          ? `${locality}, ${district} (${pcFormatted})`
          : `${district || locality} (${pcFormatted})`;

      return {
        latitude: r.latitude,
        longitude: r.longitude,
        address: preciseAddress,
        label: `${locality}, ${district}, ${pcFormatted}, United Kingdom`,
        cityName: `${locality}, ${r.outcode}`,
        countryName: 'United Kingdom',
        postcode: pcFormatted,
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

  const lower = q.toLowerCase();

  // 1. Check preset UK cities first
  for (const [cityName, coords] of Object.entries(UK_PRESET_LOCATIONS)) {
    if (lower.includes(cityName.toLowerCase()) || cityName.toLowerCase().includes(lower)) {
      return coords;
    }
  }

  // 2. Check preset Non-UK test locations (e.g. Bhopal, Dubai, New York)
  for (const [cityName, coords] of Object.entries(NON_UK_TEST_LOCATIONS)) {
    if (lower.includes(cityName.toLowerCase()) || cityName.toLowerCase().includes(lower)) {
      return coords;
    }
  }

  // 3. Try UK Postcode resolver
  const pcCoords = await getCoordinatesFromUKPostcode(q);
  if (pcCoords) return pcCoords;

  // 4. Try Google Maps Geocoding API (Fast, accurate worldwide and UK queries)
  if (GOOGLE_MAPS_API_KEY) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const gRes = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&key=${GOOGLE_MAPS_API_KEY}`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);
      if (gRes.ok) {
        const gData = await gRes.json();
        if (gData.status === 'OK' && Array.isArray(gData.results) && gData.results.length > 0) {
          const result = gData.results[0];
          const lat = result.geometry?.location?.lat;
          const lon = result.geometry?.location?.lng;
          if (typeof lat === 'number' && typeof lon === 'number') {
            let road = '';
            let suburb = '';
            let city = '';
            let postcode = '';
            let country = '';

            for (const comp of result.address_components || []) {
              const types = comp.types || [];
              if (types.includes('route')) road = comp.long_name || comp.short_name;
              else if (types.includes('sublocality') || types.includes('neighborhood')) suburb = comp.long_name || comp.short_name;
              else if (types.includes('postal_town') || types.includes('locality')) city = comp.long_name || comp.short_name;
              else if (types.includes('postal_code')) postcode = comp.long_name || comp.short_name;
              else if (types.includes('country')) country = comp.long_name || comp.short_name;
            }

            const parts = [road, suburb, city].filter(Boolean);
            if (postcode) parts.push(`(${postcode})`);
            const preciseAddress = parts.length > 0 ? parts.join(', ') : result.formatted_address;

            const coords: Coordinates = {
              latitude: lat,
              longitude: lon,
              address: preciseAddress,
              label: result.formatted_address || preciseAddress,
              cityName: suburb && city ? `${suburb}, ${city}` : city || suburb || q,
              countryName: country,
              postcode,
            };
            coords.isWithinUK = isWithinUKBoundary(coords);
            return coords;
          }
        }
      }
    } catch (e) {
      // Fallback
    }
  }

  // 5. Fallback to OpenStreetMap geocoding with detailed address
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&addressdetails=1`,
      {
        headers: { 'User-Agent': 'MultipleMOTUK-App/1.0' },
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);
    if (res.ok) {
      const results = await res.json();
      if (Array.isArray(results) && results.length > 0) {
        const item = results[0];
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);
        if (!isNaN(lat) && !isNaN(lon)) {
          const addr = item.address || {};
          const road = addr.road || addr.street || '';
          const suburb = addr.suburb || addr.neighbourhood || addr.quarter || '';
          const city = addr.city || addr.town || addr.village || item.name || q;
          const postcode = addr.postcode || '';

          const parts = [road, suburb, city].filter(Boolean);
          if (postcode) parts.push(`(${postcode})`);

          const preciseAddress = parts.length > 0 ? parts.join(', ') : item.display_name?.split(',').slice(0, 3).join(', ') || q;

          const coords: Coordinates = {
            latitude: lat,
            longitude: lon,
            address: preciseAddress,
            label: item.display_name || preciseAddress,
            cityName: suburb && city ? `${suburb}, ${city}` : city,
            countryName: addr.country || '',
            postcode,
          };
          coords.isWithinUK = isWithinUKBoundary(coords);
          return coords;
        }
      }
    }
  } catch (e) {
    // Non-blocking
  }

  return null;
};

/**
 * Fast IP-based Live Geolocation (determines real city and coordinates)
 */
export const fetchLiveIpLocation = async (): Promise<Coordinates | null> => {
  // 1. Try ipwho.is
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const res = await fetch('https://ipwho.is/', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      if (data.success !== false && data.latitude && data.longitude) {
        const lat = Number(data.latitude);
        const lon = Number(data.longitude);
        const city = data.city || data.region || 'Current Area';
        const country = data.country || '';
        const region = data.region ? `${data.region}` : '';
        const postal = data.postal || '';

        const preciseParts = [city];
        if (region && region.toLowerCase() !== city.toLowerCase()) preciseParts.push(region);
        if (postal) preciseParts.push(`(${postal})`);
        const preciseAddress = preciseParts.join(', ');

        const coords: Coordinates = {
          latitude: lat,
          longitude: lon,
          cityName: `${city}, ${region || country}`,
          countryName: country,
          address: preciseAddress,
          postcode: postal,
          label: `${preciseAddress}, ${country}`,
        };
        coords.isWithinUK = isWithinUKBoundary(coords);
        return coords;
      }
    }
  } catch (e) {
    console.log('ipwho.is error:', e);
  }

  // 2. Try freeipapi.com
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const res = await fetch('https://freeipapi.com/api/json', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      if (data.latitude && data.longitude) {
        const lat = Number(data.latitude);
        const lon = Number(data.longitude);
        const city = data.cityName || 'Current Area';
        const country = data.countryName || '';
        const region = data.regionName ? `${data.regionName}` : '';
        const postal = data.zipCode || '';

        const preciseParts = [city];
        if (region && region.toLowerCase() !== city.toLowerCase()) preciseParts.push(region);
        if (postal) preciseParts.push(`(${postal})`);
        const preciseAddress = preciseParts.join(', ');

        const coords: Coordinates = {
          latitude: lat,
          longitude: lon,
          cityName: `${city}, ${region || country}`,
          countryName: country,
          address: preciseAddress,
          postcode: postal,
          label: `${preciseAddress}, ${country}`,
        };
        coords.isWithinUK = isWithinUKBoundary(coords);
        return coords;
      }
    }
  } catch (e) {
    console.log('freeipapi error:', e);
  }

  // 3. Try ipapi.co
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      if (data.latitude && data.longitude) {
        const lat = Number(data.latitude);
        const lon = Number(data.longitude);
        const city = data.city || 'Current Area';
        const country = data.country_name || '';
        const region = data.region || '';
        const postal = data.postal || '';

        const preciseParts: string[] = [];
        if (city && city !== 'Current Area') preciseParts.push(city);
        if (region && region.toLowerCase() !== city.toLowerCase()) preciseParts.push(region);
        if (postal) preciseParts.push(`(${postal})`);
        const preciseAddress = preciseParts.length > 0 ? preciseParts.join(', ') : (country ? `${city}, ${country}` : city);

        const coords: Coordinates = {
          latitude: lat,
          longitude: lon,
          cityName: region ? `${city}, ${region}` : (country ? `${city}, ${country}` : city),
          countryName: country,
          address: preciseAddress,
          postcode: postal,
          label: country ? `${preciseAddress}, ${country}` : preciseAddress,
        };
        coords.isWithinUK = isWithinUKBoundary(coords);
        return coords;
      }
    }
  } catch (e) {
    console.log('ipapi.co error:', e);
  }

  return null;
};

/**
 * Live Location Requester (Fast GPS with concurrent IP fallback)
 */
export const requestUserLiveLocation = async (): Promise<Coordinates | null> => {
  // Start IP resolution concurrently so user never waits more than 1-2s
  const ipPromise = fetchLiveIpLocation();

  let hasPermission = false;
  if (Platform.OS === 'android') {
    try {
      const fineGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      const coarseGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION);

      if (fineGranted || coarseGranted) {
        hasPermission = true;
      } else {
        const statuses = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        ]);
        hasPermission =
          statuses[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED ||
          statuses[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED;
      }
    } catch (pErr) {
      console.log('Location permission error:', pErr);
    }
  } else {
    hasPermission = true;
  }

  // 1. Try Native Device GPS if permission granted, with a strict 2.5s timeout
  if (hasPermission && SafeGeolocation && typeof SafeGeolocation.getCurrentPosition === 'function') {
    const gpsCoords = await new Promise<{ latitude: number; longitude: number } | null>((resolve) => {
      let settled = false;
      const done = (coords: any) => {
        if (!settled) {
          settled = true;
          resolve(coords);
        }
      };

      try {
        SafeGeolocation.getCurrentPosition(
          (pos: any) => {
            if (pos?.coords) {
              done({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
              });
            } else {
              done(null);
            }
          },
          () => done(null),
          { enableHighAccuracy: false, timeout: 2500, maximumAge: 30000 }
        );
      } catch {
        done(null);
      }

      setTimeout(() => done(null), 2500);
    });

    if (gpsCoords && !isNaN(gpsCoords.latitude) && !isNaN(gpsCoords.longitude)) {
      const geoInfo = await reverseGeocodeCoords(gpsCoords.latitude, gpsCoords.longitude);
      const isUk = isWithinUKBoundary(gpsCoords);
      return {
        latitude: gpsCoords.latitude,
        longitude: gpsCoords.longitude,
        cityName: geoInfo.cityName,
        countryName: geoInfo.countryName,
        label: geoInfo.label,
        isWithinUK: isUk,
      };
    }
  }

  // 2. If GPS did not return a fix within 2.5s (or disabled/emulator), use the resolved live IP location
  return await ipPromise;
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
