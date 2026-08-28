import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  LayoutAnimation,
  Platform,
  UIManager
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues } from '../context/DataContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function MotHistoryScreen({ route, navigation }: any) {
  const { theme } = useAppTheme();
  const { lookupVehicle } = useAppValues();

  const [loading, setLoading] = useState(false);
  const [vehicle, setVehicle] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedTestIdx, setExpandedTestIdx] = useState<number | null>(0); // First one expanded by default

  const registration = route?.params?.registration || route?.params?.vehicleData?.registration;
  const initialVehicleData = route?.params?.vehicleData;

  useEffect(() => {
    if (initialVehicleData && initialVehicleData.motTests) {
      setVehicle(initialVehicleData);
    } else if (registration) {
      fetchHistory(registration);
    } else {
      setError('No vehicle registration provided.');
    }
  }, [registration, initialVehicleData]);

  const fetchHistory = async (reg: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await lookupVehicle(reg);
      if (res && res.found && res.vehicle) {
        setVehicle(res.vehicle);
      } else {
        setError('Vehicle details not found in registry.');
      }
    } catch (err: any) {
      console.error('[MotHistoryScreen] error fetching:', err);
      setError(err.message || 'Failed to fetch MOT history.');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedTestIdx(expandedTestIdx === index ? null : index);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.placeholder }]}>
          Retrieving live MOT history...
        </Text>
      </View>
    );
  }

  if (error || !vehicle) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
        <MaterialCommunityIcons name="alert-circle-outline" size={64} color={theme.colors.error} style={{ marginBottom: 16 }} />
        <Text style={[styles.errorTitle, { color: theme.colors.text }]}>Lookup Failed</Text>
        <Text style={[styles.errorSubtitle, { color: theme.colors.placeholder }]}>
          {error || 'Could not load MOT history.'}
        </Text>
        <TouchableOpacity
          onPress={() => registration && fetchHistory(registration)}
          style={[styles.retryBtn, { backgroundColor: theme.colors.primary }]}
        >
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Parse details
  const regNumber = (vehicle.registrationNumber || vehicle.registration || registration || '').toUpperCase().trim();
  const motTests = vehicle.motTests || [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Vehicle Header info */}
        <View style={styles.vehicleHeader}>
          <View style={styles.plateContainer}>
            <View style={styles.ukStrip}>
              <Text style={styles.ukText}>UK</Text>
            </View>
            <Text style={styles.plateText}>{regNumber}</Text>
          </View>
          <Text style={[styles.vehicleTitle, { color: theme.colors.text }]}>
            {vehicle.make} {vehicle.model}
          </Text>
          <Text style={[styles.vehicleSpec, { color: theme.colors.placeholder }]}>
            {vehicle.year ? `${vehicle.year} • ` : ''}{vehicle.color || 'Grey'} • {vehicle.fuelType || 'Petrol'}{vehicle.engineSize ? ` (${vehicle.engineSize})` : ''}
          </Text>
        </View>

        {/* MOT Tests Timeline */}
        <View style={styles.timelineSection}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            MOT History ({motTests.length} Records)
          </Text>

          {motTests.length === 0 ? (
            <View style={[styles.noTestsCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <MaterialCommunityIcons name="file-alert-outline" size={48} color={theme.colors.placeholder} style={{ marginBottom: 8 }} />
              <Text style={[styles.noTestsText, { color: theme.colors.text }]}>No MOT history found for this vehicle.</Text>
              <Text style={[styles.noTestsSubtext, { color: theme.colors.placeholder }]}>New vehicles do not require an MOT until they are 3 years old.</Text>
            </View>
          ) : (
            motTests.map((test: any, idx: number) => {
              const isPassed = test.testResult === 'PASSED';
              const isExpanded = expandedTestIdx === idx;
              
              // Count defects
              const defects = test.defects || [];
              const failures = defects.filter((d: any) => 
                ['FAIL', 'MAJOR', 'DANGEROUS'].includes((d.type || '').toUpperCase())
              );
              const advisories = defects.filter((d: any) => 
                ['ADVISORY', 'MINOR'].includes((d.type || '').toUpperCase())
              );

              return (
                <View 
                  key={test.motTestNumber || idx} 
                  style={[
                    styles.testCard, 
                    { 
                      backgroundColor: theme.colors.card, 
                      borderColor: isExpanded 
                        ? (isPassed ? theme.colors.success + '80' : theme.colors.error + '80')
                        : theme.colors.border 
                    }
                  ]}
                >
                  {/* Header bar of the test card */}
                  <TouchableOpacity 
                    onPress={() => toggleExpand(idx)}
                    activeOpacity={0.8}
                    style={styles.cardHeader}
                  >
                    <View style={styles.headerLeft}>
                      <View style={[
                        styles.statusIndicator, 
                        { backgroundColor: isPassed ? theme.colors.success : theme.colors.error }
                      ]}>
                        <Text style={styles.statusIndicatorText}>
                          {isPassed ? 'PASS' : 'FAIL'}
                        </Text>
                      </View>
                      <View style={{ marginLeft: 12 }}>
                        <Text style={[styles.testDate, { color: theme.colors.text }]}>
                          {formatDate(test.completedDate)}
                        </Text>
                        <Text style={[styles.testOdo, { color: theme.colors.placeholder }]}>
                          Odometer: {test.odometerValue ? `${parseInt(test.odometerValue).toLocaleString()} ${test.odometerUnit === 'MI' ? 'miles' : 'km'}` : 'N/A'}
                        </Text>
                      </View>
                    </View>

                    <MaterialCommunityIcons 
                      name={isExpanded ? 'chevron-up' : 'chevron-down'} 
                      size={24} 
                      color={theme.colors.placeholder} 
                    />
                  </TouchableOpacity>

                  {/* Expanded content */}
                  {isExpanded && (
                    <View style={[styles.cardContent, { borderTopColor: theme.colors.border }]}>
                      {/* Test Summary Stats */}
                      <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                          <Text style={[styles.statLabel, { color: theme.colors.placeholder }]}>MOT Test Number</Text>
                          <Text style={[styles.statValue, { color: theme.colors.text }]}>{test.motTestNumber || 'N/A'}</Text>
                        </View>
                        {isPassed && test.expiryDate && (
                          <View style={styles.statItem}>
                            <Text style={[styles.statLabel, { color: theme.colors.placeholder }]}>Expiry Date</Text>
                            <Text style={[styles.statValue, { color: theme.colors.text, fontWeight: 'bold' }]}>
                              {formatDate(test.expiryDate)}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Defects List */}
                      {defects.length === 0 ? (
                        <View style={styles.noDefectsRow}>
                          <MaterialCommunityIcons name="checkbox-marked-circle-outline" size={18} color={theme.colors.success} style={{ marginRight: 6 }} />
                          <Text style={[styles.noDefectsText, { color: theme.colors.placeholder }]}>
                            No defects or advisories recorded.
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.defectsContainer}>
                          
                          {/* Failures */}
                          {failures.length > 0 && (
                            <View style={styles.defectSection}>
                              <View style={styles.defectHeader}>
                                <MaterialCommunityIcons name="close-circle" size={16} color={theme.colors.error} style={{ marginRight: 6 }} />
                                <Text style={[styles.defectGroupTitle, { color: theme.colors.error }]}>Failures & Major Defects ({failures.length})</Text>
                              </View>
                              {failures.map((d: any, dIdx: number) => (
                                <View key={dIdx} style={[styles.defectItem, { backgroundColor: theme.colors.error + '05', borderColor: theme.colors.error + '15' }]}>
                                  <Text style={[styles.defectText, { color: theme.colors.text }]}>{d.text}</Text>
                                  {d.dangerous && (
                                    <View style={styles.dangerBadge}>
                                      <Text style={styles.dangerBadgeText}>DANGEROUS</Text>
                                    </View>
                                  )}
                                </View>
                              ))}
                            </View>
                          )}

                          {/* Advisories */}
                          {advisories.length > 0 && (
                            <View style={[styles.defectSection, { marginTop: failures.length > 0 ? 12 : 0 }]}>
                              <View style={styles.defectHeader}>
                                <MaterialCommunityIcons name="alert-circle" size={16} color={theme.colors.warning} style={{ marginRight: 6 }} />
                                <Text style={[styles.defectGroupTitle, { color: theme.colors.warning }]}>Advisory Notices & Minors ({advisories.length})</Text>
                              </View>
                              {advisories.map((d: any, dIdx: number) => (
                                <View key={dIdx} style={[styles.defectItem, { backgroundColor: theme.colors.warning + '05', borderColor: theme.colors.warning + '15' }]}>
                                  <Text style={[styles.defectText, { color: theme.colors.text }]}>{d.text}</Text>
                                  {d.type && (
                                    <Text style={[styles.defectSubtype, { color: theme.colors.placeholder }]}>
                                      Severity: {d.type}
                                    </Text>
                                  )}
                                </View>
                              ))}
                            </View>
                          )}

                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryBtn: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  vehicleHeader: {
    alignItems: 'center',
    marginVertical: 24,
    paddingHorizontal: 16,
  },
  plateContainer: {
    flexDirection: 'row',
    height: 46,
    backgroundColor: '#FFD300',
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 6,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    marginBottom: 16,
  },
  ukStrip: {
    width: 32,
    backgroundColor: '#003399',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ukText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  plateText: {
    paddingHorizontal: 16,
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000000',
    letterSpacing: 2,
    alignSelf: 'center',
    textAlign: 'center',
  },
  vehicleTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  vehicleSpec: {
    fontSize: 13,
    textAlign: 'center',
  },
  timelineSection: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  noTestsCard: {
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  noTestsText: {
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 8,
    textAlign: 'center',
  },
  noTestsSubtext: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  testCard: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusIndicator: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    width: 60,
    alignItems: 'center',
  },
  statusIndicatorText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  testDate: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  testOdo: {
    fontSize: 12,
    marginTop: 1,
  },
  cardContent: {
    borderTopWidth: 1,
    padding: 14,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  statItem: {
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 13,
  },
  noDefectsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  noDefectsText: {
    fontSize: 13,
  },
  defectsContainer: {
    marginTop: 4,
  },
  defectSection: {
    width: '100%',
  },
  defectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  defectGroupTitle: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  defectItem: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 6,
  },
  defectText: {
    fontSize: 13,
    lineHeight: 18,
  },
  defectSubtype: {
    fontSize: 10,
    marginTop: 4,
  },
  dangerBadge: {
    backgroundColor: '#FF0000',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  dangerBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: 'bold',
  }
});
