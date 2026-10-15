import React, { useState, useMemo } from 'react';
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
import {
  Coordinates,
  UK_PRESET_LOCATIONS,
  NON_UK_TEST_LOCATIONS,
  requestUserLiveLocation,
  isWithinUKBoundary,
  getCoordinatesFromLocationQuery,
  formatPreciseLocation,
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

  // Filter preset locations based on search query (name, label, city, address, postcode)
  const filteredPresets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const cleanQ = q.replace(/\s+/g, '');
    const allPresets = Object.entries(UK_PRESET_LOCATIONS);
    if (!q) return allPresets;

    return allPresets.filter(([name, coords]) => {
      const matchName = name.toLowerCase().includes(q);
      const matchLabel = (coords.label || '').toLowerCase().includes(q);
      const matchCity = (coords.cityName || '').toLowerCase().includes(q);
      const matchAddress = (coords.address || '').toLowerCase().includes(q);
      const matchPostcode = (coords.postcode || '').toLowerCase().replace(/\s+/g, '').includes(cleanQ);
      return matchName || matchLabel || matchCity || matchAddress || matchPostcode;
    });
  }, [searchQuery]);

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

  const isCurrentSelection = (coords: Coordinates) => {
    if (!currentLocation) return false;
    // Compare city or coordinates proximity
    if (currentLocation.cityName && coords.cityName) {
      if (currentLocation.cityName.toLowerCase() === coords.cityName.toLowerCase()) {
        return true;
      }
    }
    const latDiff = Math.abs(currentLocation.latitude - coords.latitude);
    const lonDiff = Math.abs(currentLocation.longitude - coords.longitude);
    return latDiff < 0.05 && lonDiff < 0.05;
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
                        Choose your area to find nearby MOT garages
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
                    onChangeText={(txt) => {
                      setSearchQuery(txt);
                      setCustomSearchResult(null);
                    }}
                    onSubmitEditing={handleSearchSubmit}
                    placeholder="Search Address"
                    placeholderTextColor={theme.colors.placeholder}
                    style={[styles.searchInput, { color: theme.colors.text }]}
                    returnKeyType="search"
                    autoCorrect={false}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
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

                  {/* Popular UK Service Areas */}
                  <View style={styles.sectionWrap}>
                    <Text style={[styles.sectionHeading, { color: theme.colors.placeholder }]}>
                      Popular UK Service Areas
                    </Text>

                    {filteredPresets.map(([name, coords]) => {
                      const isSelected = isCurrentSelection(coords);
                      return (
                        <TouchableOpacity
                          key={name}
                          style={[
                            styles.locationItem,
                            {
                              backgroundColor: isSelected ? theme.colors.secondary + '10' : theme.colors.background,
                              borderColor: isSelected ? theme.colors.secondary : theme.colors.border,
                            },
                          ]}
                          onPress={() => handleSelect(coords)}
                          activeOpacity={0.7}
                        >
                          <View style={[
                            styles.cityIconWrap,
                            { backgroundColor: isSelected ? theme.colors.secondary + '20' : theme.colors.card }
                          ]}>
                            <MaterialCommunityIcons
                              name="map-marker"
                              size={18}
                              color={isSelected ? theme.colors.secondary : theme.colors.placeholder}
                            />
                          </View>

                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Text style={[styles.cityName, { color: theme.colors.text }]}>
                                {coords.address || coords.cityName || name}
                              </Text>
                              <View style={styles.ukMiniBadge}>
                                <Text style={styles.ukMiniBadgeText}>🇬🇧 UK</Text>
                              </View>
                            </View>
                            <Text style={[styles.cityDesc, { color: theme.colors.placeholder }]} numberOfLines={1}>
                              {coords.label || `${coords.cityName}, United Kingdom`}
                            </Text>
                          </View>

                          {isSelected ? (
                            <View style={[styles.selectedCircle, { backgroundColor: theme.colors.secondary }]}>
                              <MaterialCommunityIcons name="check" size={14} color="#FFFFFF" />
                            </View>
                          ) : (
                            <MaterialCommunityIcons name="chevron-right" size={18} color={theme.colors.placeholder} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Test Outside UK Section */}
                  <View style={styles.sectionWrap}>
                    <View style={styles.testSectionHeader}>
                      <MaterialCommunityIcons name="flask-outline" size={14} color="#EF4444" style={{ marginRight: 4 }} />
                      <Text style={[styles.sectionHeading, { color: '#EF4444', marginBottom: 0 }]}>
                        Test Non-UK Region (Outside UK Boundary)
                      </Text>
                    </View>
                    <Text style={[styles.testSectionNotice, { color: theme.colors.placeholder }]}>
                      Select Bhopal to test the "Service not available in selected area!" condition:
                    </Text>

                    {Object.entries(NON_UK_TEST_LOCATIONS).map(([testName, coords]) => {
                      const isSelected = isCurrentSelection(coords);
                      return (
                        <TouchableOpacity
                          key={testName}
                          style={[
                            styles.nonUkItem,
                            {
                              backgroundColor: isSelected ? '#EF444415' : theme.colors.background,
                              borderColor: isSelected ? '#EF4444' : '#EF444440',
                            },
                          ]}
                          onPress={() => handleSelect(coords)}
                          activeOpacity={0.7}
                        >
                          <View style={[styles.cityIconWrap, { backgroundColor: '#EF444418' }]}>
                            <MaterialCommunityIcons name="map-marker-off" size={18} color="#EF4444" />
                          </View>

                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Text style={[styles.cityName, { color: theme.colors.text }]}>
                                {coords.address || coords.cityName}
                              </Text>
                              <View style={[styles.nonUkPill, { backgroundColor: '#EF444420' }]}>
                                <Text style={styles.nonUkPillText}>{coords.countryName || 'Outside UK'}</Text>
                              </View>
                            </View>
                            <Text style={[styles.cityDesc, { color: theme.colors.placeholder }]} numberOfLines={1}>
                              {coords.label}
                            </Text>
                          </View>

                          {isSelected ? (
                            <View style={[styles.selectedCircle, { backgroundColor: '#EF4444' }]}>
                              <MaterialCommunityIcons name="check" size={14} color="#FFFFFF" />
                            </View>
                          ) : (
                            <MaterialCommunityIcons name="chevron-right" size={18} color={theme.colors.placeholder} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>

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
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
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
    fontSize: 14,
    fontWeight: '700',
  },
  liveBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    marginLeft: 6,
  },
  liveBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  liveCardDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  sectionWrap: {
    marginBottom: 18,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  testSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  testSectionNotice: {
    fontSize: 11,
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
  nonUkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.2,
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
    fontSize: 14,
    fontWeight: '700',
  },
  cityDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  ukMiniBadge: {
    backgroundColor: '#10B98115',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 6,
  },
  ukMiniBadgeText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '700',
  },
  nonUkPill: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 6,
  },
  nonUkPillText: {
    color: '#DC2626',
    fontSize: 10,
    fontWeight: '700',
  },
  regionTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  regionTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  selectedCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
