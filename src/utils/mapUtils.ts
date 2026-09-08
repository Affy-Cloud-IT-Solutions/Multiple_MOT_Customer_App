import { Linking, Platform, Alert } from 'react-native';

export interface GarageLocationTarget {
  name?: string;
  address?: string;
  city?: string;
  postcode?: string;
  latitude?: number | string;
  longitude?: number | string;
}

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
