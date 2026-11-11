import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';
import { fonts } from '../theme/theme';
import {
  Coordinates,
  requestUserLiveLocation,
  isWithinUKBoundary,
  getCoordinatesFromLocationQuery,
  formatPreciseLocation,
  fetchGooglePlacePredictions,
  fetchGooglePlaceDetails,
  GooglePlacePrediction,
} from '../utils/mapUtils';

export interface SelectAreaBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  currentLocation: Coordinates | null;
  onSelectLocation: (coords: Coordinates) => void;
}

export default function SelectAreaBottomSheet({
  visible,
  onClose,
  currentLocation,
  onSelectLocation,
}: SelectAreaBottomSheetProps) {
  const { theme } = useAppTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [locatingLive, setLocatingLive] = useState(false);
  const [searching, setSearching] = useState(false);
  const [customSearchResult, setCustomSearchResult] = useState<Coordinates | null>(null);

  // Google Places Street Recommendations
  const [predictions, setPredictions] = useState<GooglePlacePrediction[]>([]);
  const [loadingPredictions, setLoadingPredictions] = useState(false);
  const [selectingPlaceId, setSelectingPlaceId] = useState<string | null>(null);
  const debounceTimerRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!visible) {
      setSearchQuery('');
      setPredictions([]);
      setLoadingPredictions(false);
      setCustomSearchResult(null);
      setSelectingPlaceId(null);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    }
  }, [visible]);

  // Handle typing in the input field with debounced Google Places Autocomplete
  const handleQueryChange = (text: string) => {
    setSearchQuery(text);
    setCustomSearchResult(null);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const trimmed = text.trim();
    if (trimmed.length < 2) {
      setPredictions([]);
      setLoadingPredictions(false);
      return;
    }

    setLoadingPredictions(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const results = await fetchGooglePlacePredictions(trimmed);
        setPredictions(results);
      } catch (e) {
        setPredictions([]);
      } finally {
        setLoadingPredictions(false);
      }
    }, 280);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setPredictions([]);
    setLoadingPredictions(false);
    setCustomSearchResult(null);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  };

  const handleSelectGooglePrediction = async (item: GooglePlacePrediction) => {
    setSelectingPlaceId(item.placeId);
    try {
      const coords = await fetchGooglePlaceDetails(item.placeId);
      if (coords) {
        onSelectLocation(coords);
        onClose();
      } else {
        const fallbackCoords = await getCoordinatesFromLocationQuery(item.description);
        if (fallbackCoords) {
          onSelectLocation(fallbackCoords);
          onClose();
        }
      }
    } catch (err) {
      console.error('Error selecting prediction:', err);
    } finally {
      setSelectingPlaceId(null);
    }
  };

  const handleUseLiveLocation = async () => {
    setLocatingLive(true);
    try {
      const live = await requestUserLiveLocation();
      if (live) {
        onSelectLocation(live);
        onClose();
      }
    } catch (e) {
      console.error('Failed to get live location:', e);
    } finally {
      setLocatingLive(false);
    }
  };

  const handleSearchSubmit = async () => {
    const q = searchQuery.trim();
    if (!q) return;

    setSearching(true);
    setCustomSearchResult(null);
    try {
      const result = await getCoordinatesFromLocationQuery(q);
      if (result) {
        setCustomSearchResult(result);
      }
    } catch (e) {
      console.error('Failed to search area:', e);
    } finally {
      setSearching(false);
    }
  };

  const handleSelect = (coords: Coordinates) => {
    onSelectLocation(coords);
    onClose();
  };

  const currentIsUk = currentLocation ? isWithinUKBoundary(currentLocation) : false;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={styles.sheetWrapper}
            >
              <View style={[styles.sheetContent, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                {/* Drag Handle */}
                <View style={styles.handleBar} />

                {/* Header */}
                <View style={styles.headerRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={[styles.headerIconCircle, { backgroundColor: theme.colors.secondary + '18' }]}>
                      <MaterialCommunityIcons name="map-marker-radius" size={20} color={theme.colors.secondary} />
                    </View>
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Select Area</Text>
                      <Text style={[styles.headerSubtitle, { color: theme.colors.placeholder }]}>
                        Choose your area to find nearby garages & service centres
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={onClose}
                    style={[styles.closeBtn, { backgroundColor: theme.colors.border + '40' }]}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <MaterialCommunityIcons name="close" size={18} color={theme.colors.text} />
                  </TouchableOpacity>
                </View>

                {/* Search Bar */}
                <View style={[styles.searchBox, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                  <MaterialCommunityIcons name="magnify" size={20} color={theme.colors.placeholder} style={{ marginRight: 8 }} />
                  <TextInput
                    value={searchQuery}
                    onChangeText={handleQueryChange}
                    onSubmitEditing={handleSearchSubmit}
                    placeholder="Search street, town or postcode..."
                    placeholderTextColor={theme.colors.placeholder}
                    style={[styles.searchInput, { color: theme.colors.text }]}
                    returnKeyType="search"
                    autoCorrect={false}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={handleClearSearch} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                      <MaterialCommunityIcons name="close-circle" size={16} color={theme.colors.placeholder} />
                    </TouchableOpacity>
                  )}
                  {searching && (
                    <ActivityIndicator size="small" color={theme.colors.secondary} style={{ marginLeft: 6 }} />
                  )}
                </View>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.scrollList}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* Street & Location Recommendations Dropdown (Triggered when user writes in input field) */}
                  {(predictions.length > 0 || loadingPredictions) && searchQuery.trim().length >= 2 && (
                    <View style={[styles.recommendationCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.secondary + '40' }]}>
                      <View style={[styles.recommendationHeader, { backgroundColor: theme.colors.secondary + '10' }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                          <MaterialCommunityIcons name="google-maps" size={16} color={theme.colors.secondary} style={{ marginRight: 6 }} />
                          <Text style={[styles.recommendationHeaderTitle, { color: theme.colors.secondary }]}>
                            Street Recommendations
                          </Text>
                        </View>
                        {loadingPredictions && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <ActivityIndicator size="small" color={theme.colors.secondary} />
                            <Text style={{ fontSize: 11, color: theme.colors.placeholder, fontFamily: fonts.medium }}>Searching...</Text>
                          </View>
                        )}
                      </View>

                      {predictions.map((item, index) => {
                        const isSelecting = selectingPlaceId === item.placeId;
                        const isLast = index === predictions.length - 1;
                        const isStreetOrRoute = item.types.includes('route') || item.types.includes('street_address') || item.types.includes('premise') || item.types.includes('subpremise');

                        return (
                          <TouchableOpacity
                            key={item.placeId || index}
                            style={[
                              styles.recommendationItem,
                              !isLast && { borderBottomColor: theme.colors.border + '30', borderBottomWidth: 1 }
                            ]}
                            onPress={() => handleSelectGooglePrediction(item)}
                            disabled={Boolean(selectingPlaceId)}
                            activeOpacity={0.7}
                          >
                            <View style={[styles.recIconWrap, { backgroundColor: theme.colors.secondary + '15' }]}>
                              {isSelecting ? (
                                <ActivityIndicator size="small" color={theme.colors.secondary} />
                              ) : (
                                <MaterialCommunityIcons
                                  name={isStreetOrRoute ? 'road-variant' : 'map-marker-outline'}
                                  size={18}
                                  color={theme.colors.secondary}
                                />
                              )}
                            </View>

                            <View style={{ flex: 1, marginLeft: 10 }}>
                              <Text style={[styles.recMainText, { color: theme.colors.text }]} numberOfLines={1}>
                                {item.mainText}
                              </Text>
                              {item.secondaryText ? (
                                <Text style={[styles.recSecondaryText, { color: theme.colors.placeholder }]} numberOfLines={1}>
                                  {item.secondaryText}
                                </Text>
                              ) : null}
                            </View>

                            <View style={styles.recArrowWrap}>
                              <MaterialCommunityIcons name="arrow-top-right" size={16} color={theme.colors.secondary} />
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}

                  {/* Option 1: Live Hardware / IP Location */}
                  <TouchableOpacity
                    style={[
                      styles.liveLocationCard,
                      {
                        backgroundColor: theme.colors.background,
                        borderColor: theme.colors.secondary + '40',
                      },
                    ]}
                    onPress={handleUseLiveLocation}
                    activeOpacity={0.8}
                    disabled={locatingLive}
                  >
                    <View style={[styles.liveIconCircle, { backgroundColor: theme.colors.secondary + '20' }]}>
                      {locatingLive ? (
                        <ActivityIndicator size="small" color={theme.colors.secondary} />
                      ) : (
                        <MaterialCommunityIcons name="crosshairs-gps" size={20} color={theme.colors.secondary} />
                      )}
                    </View>

                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.liveCardTitle, { color: theme.colors.text }]}>
                          Use Live GPS Location
                        </Text>
                        <View style={[styles.liveBadge, { backgroundColor: theme.colors.secondary + '15' }]}>
                          <Text style={[styles.liveBadgeText, { color: theme.colors.secondary }]}>Current</Text>
                        </View>
                      </View>
                      <Text style={[styles.liveCardDesc, { color: theme.colors.placeholder }]} numberOfLines={1}>
                        {currentLocation ? (
                          currentIsUk
                            ? `📍 ${formatPreciseLocation(currentLocation)} (UK)`
                            : `📍 ${formatPreciseLocation(currentLocation)} (${currentLocation.countryName || 'Non-UK'})`
                        ) : (
                          'Detects live location automatically'
                        )}
                      </Text>
                    </View>

                    <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.placeholder} />
                  </TouchableOpacity>

                  {/* Custom Search Result (if user searched an exact query) */}
                  {customSearchResult && (
                    <View style={styles.sectionWrap}>
                      <Text style={[styles.sectionHeading, { color: theme.colors.placeholder }]}>Search Result</Text>
                      <TouchableOpacity
                        style={[
                          styles.locationItem,
                          {
                            backgroundColor: theme.colors.background,
                            borderColor: customSearchResult.isWithinUK ? '#10B98160' : '#EF444460',
                          },
                        ]}
                        onPress={() => handleSelect(customSearchResult)}
                      >
                        <View style={[
                          styles.cityIconWrap,
                          { backgroundColor: customSearchResult.isWithinUK ? '#10B98115' : '#EF444415' }
                        ]}>
                          <MaterialCommunityIcons
                            name={customSearchResult.isWithinUK ? 'map-marker-check' : 'map-marker-remove'}
                            size={18}
                            color={customSearchResult.isWithinUK ? '#10B981' : '#EF4444'}
                          />
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={[styles.cityName, { color: theme.colors.text }]}>
                            {formatPreciseLocation(customSearchResult)}
                          </Text>
                          <Text style={[styles.cityDesc, { color: theme.colors.placeholder }]} numberOfLines={1}>
                            {customSearchResult.address && customSearchResult.label && customSearchResult.address !== customSearchResult.label
                              ? `${customSearchResult.address} • ${customSearchResult.label}`
                              : (customSearchResult.label || customSearchResult.countryName)}
                          </Text>
                        </View>
                        <View style={[
                          styles.regionTag,
                          { backgroundColor: customSearchResult.isWithinUK ? '#10B98115' : '#EF444415' }
                        ]}>
                          <Text style={[
                            styles.regionTagText,
                            { color: customSearchResult.isWithinUK ? '#10B981' : '#EF4444' }
                          ]}>
                            {customSearchResult.isWithinUK ? 'UK Area' : 'Outside UK'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  )}

                  <View style={{ height: 24 }} />
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheetWrapper: {
    width: '100%',
    maxHeight: '85%',
  },
  sheetContent: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    paddingTop: 10,
    paddingHorizontal: 16,
    maxHeight: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 20,
  },
  handleBar: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#94A3B8',
    alignSelf: 'center',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 14,
  },
  searchInput: {
    fontFamily: fonts.regular,
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  scrollList: {
    paddingBottom: 24,
  },
  liveLocationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
    marginBottom: 16,
  },
  liveIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  liveCardTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  liveBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    marginLeft: 6,
  },
  liveBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
  },
  liveCardDesc: {
    fontFamily: fonts.medium,
    fontSize: 12,
    marginTop: 2,
  },
  sectionWrap: {
    marginBottom: 18,
  },
  sectionHeading: {
    fontFamily: fonts.bold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  cityIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cityName: {
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  cityDesc: {
    fontFamily: fonts.medium,
    fontSize: 11,
    marginTop: 2,
  },
  regionTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  regionTagText: {
    fontFamily: fonts.bold,
    fontSize: 11,
  },
  recommendationCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    overflow: 'hidden',
    marginBottom: 16,
  },
  recommendationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  recommendationHeaderTitle: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    letterSpacing: -0.2,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  recIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recMainText: {
    fontFamily: fonts.bold,
    fontSize: 13.5,
  },
  recSecondaryText: {
    fontFamily: fonts.medium,
    fontSize: 11.5,
    marginTop: 2,
  },
  recArrowWrap: {
    paddingLeft: 8,
  },
});
