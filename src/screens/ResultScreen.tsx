import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Text,
  ActivityIndicator,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues } from '../context/DataContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ResultScreen({ route, navigation }: any) {
  const { theme } = useAppTheme();
  const { user } = useAppValues();

  const defaultVehicle = {
    registration: 'AB18 CDE',
    make: 'FORD',
    model: 'FOCUS TDCI',
    year: '2018',
    color: 'Metallic Grey',
    fuelType: 'Diesel',
    engineSize: '1499cc',
    status: 'PASS',
    expiryDate: '12 July 2027',
    testDate: '13 July 2026',
    testNumber: '8910 2345 6789',
    mileage: '48,250 miles',
    advisories: [
      'Front brake pads wearing thin (minor)',
      'Nearside rear tyre worn close to legal limit (advisory)',
      'Front suspension arm pin or bush worn but not resulting in excessive movement (advisory)',
    ],
    failures: [],
  };

  const vehicle = route?.params?.vehicleData || defaultVehicle;
  const isPass = vehicle.status === 'PASS';

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    const clean = String(dateStr).trim();
    if (!clean || clean === 'N/A') return 'N/A';

    let normalized = clean.replace(/\./g, '-');
    if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(normalized)) {
      normalized = normalized.replace(/\s+/, 'T');
    }

    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const date = new Date(normalized);
    if (!isNaN(date.getTime())) {
      return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
    }

    const isoMatch = clean.match(/^(\d{4})[.-](\d{1,2})[.-](\d{1,2})/);
    if (isoMatch) {
      const yr = isoMatch[1];
      const mIdx = parseInt(isoMatch[2], 10) - 1;
      const day = parseInt(isoMatch[3], 10);
      if (mIdx >= 0 && mIdx < 12) {
        return `${day} ${months[mIdx]} ${yr}`;
      }
    }
    return clean;
  };

  const getDaysRemaining = (expiryDateStr?: string) => {
    if (!expiryDateStr) return null;
    let normalized = String(expiryDateStr).trim().replace(/\./g, '-');
    if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(normalized)) {
      normalized = normalized.replace(/\s+/, 'T');
    }
    const d = new Date(normalized);
    if (isNaN(d.getTime())) {
      const match = normalized.match(/^(\d{4})[.-](\d{1,2})[.-](\d{1,2})/);
      if (match) {
        const parsed = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
        if (!isNaN(parsed.getTime())) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return Math.ceil((parsed.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        }
      }
      return null;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const formatMileage = (val?: string) => {
    if (!val || val === 'N/A' || val === '0') return 'Unrecorded';
    const clean = String(val).trim();
    const num = parseInt(clean.replace(/[^0-9]/g, ''), 10);
    if (isNaN(num)) return clean;
    const isKm = clean.toLowerCase().includes('km');
    return `${num.toLocaleString()} ${isKm ? 'km' : 'miles'}`;
  };



  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: theme.colors.card }}>
        <View style={[styles.topNavRow, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.navBackBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.navTitle, { color: theme.colors.text }]}>MOT Check Results</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header Plate */}
        <View style={styles.header}>
        <View style={styles.plateContainer}>
          <View style={styles.ukStrip}>
            <Text style={styles.ukText}>UK</Text>
          </View>
          <Text style={styles.plateText}>{vehicle.registration}</Text>
        </View>
        <Text style={[styles.vehicleTitle, { color: theme.colors.text }]}>
          {vehicle.make} {vehicle.model}
        </Text>
        <Text style={[styles.vehicleSpec, { color: theme.colors.placeholder }]}>
          {vehicle.year} • {vehicle.color} • {vehicle.fuelType} ({vehicle.engineSize})
        </Text>
      </View>

      {/* MOT Status Card */}
      <View style={[
        styles.card, 
        { 
          backgroundColor: isPass ? theme.colors.success + '08' : theme.colors.error + '08', 
          borderColor: isPass ? theme.colors.success + '30' : theme.colors.error + '30',
          borderWidth: 1.5,
        }
      ]}>
        <View style={styles.statusContent}>
          <View
            style={[
              styles.statusIconCircle,
              { backgroundColor: isPass ? theme.colors.success + '15' : theme.colors.error + '15' },
            ]}
          >
            <MaterialCommunityIcons
              name={isPass ? 'check-decagram' : 'alert-decagram'}
              size={54}
              color={isPass ? theme.colors.success : theme.colors.error}
            />
          </View>

          <Text
            style={[
              styles.statusText,
              { color: isPass ? theme.colors.success : theme.colors.error },
            ]}
          >
            MOT {vehicle.status}
          </Text>

          <Text style={[styles.expiryText, { color: theme.colors.text }]}>
            {isPass ? 'Expiry Date:' : 'Status Detail:'}{' '}
            <Text style={{ fontWeight: 'bold' }}>
              {formatDate(vehicle.expiryDate)}
              {isPass && vehicle.expiryDate ? (() => {
                const diff = getDaysRemaining(vehicle.expiryDate);
                if (diff !== null) {
                  return ` (${diff >= 0 ? `${diff} days left` : `${Math.abs(diff)} days ago`})`;
                }
                return '';
              })() : ''}
            </Text>
          </Text>
        </View>
      </View>

      {/* Vehicle Specification Details Card */}
      <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <MaterialCommunityIcons name="file-document" size={18} color={theme.colors.secondary} style={{ marginRight: 6 }} />
          <Text style={[styles.cardTitle, { color: theme.colors.text, marginBottom: 0 }]}>Test Details</Text>
        </View>
        
        <View style={styles.detailRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialCommunityIcons name="calendar" size={16} color={theme.colors.placeholder} style={{ marginRight: 6 }} />
            <Text style={{ color: theme.colors.placeholder }}>Test Date</Text>
          </View>
          <Text style={[styles.detailValue, { color: theme.colors.text, fontWeight: '700' }]}>{formatDate(vehicle.testDate)}</Text>
        </View>
        <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
        
        <View style={styles.detailRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialCommunityIcons name="barcode-scan" size={16} color={theme.colors.placeholder} style={{ marginRight: 6 }} />
            <Text style={{ color: theme.colors.placeholder }}>Test Number</Text>
          </View>
          <Text style={[styles.detailValue, { color: theme.colors.text }]}>{vehicle.testNumber}</Text>
        </View>
        <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
        
        <View style={styles.detailRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialCommunityIcons name="speedometer" size={16} color={theme.colors.placeholder} style={{ marginRight: 6 }} />
            <Text style={{ color: theme.colors.placeholder }}>Odometer Recording</Text>
          </View>
          <Text style={[styles.detailValue, { color: theme.colors.text, fontWeight: '700' }]}>{formatMileage(vehicle.mileage)}</Text>
        </View>
      </View>

      {/* Failures (if FAIL status) */}
      {!isPass && vehicle.failures && vehicle.failures.length > 0 && (
        <View style={[styles.card, styles.failuresCard, { backgroundColor: theme.colors.card }]}>
          <View style={styles.sectionHeaderRow}>
            <MaterialCommunityIcons name="alert-octagon" size={20} color={theme.colors.error} style={{ marginRight: 8 }} />
            <Text style={[styles.cardTitle, { color: theme.colors.error, marginBottom: 0 }]}>Failures & Major Defects</Text>
          </View>
          <View style={styles.listContainer}>
            {vehicle.failures.map((fail: string, idx: number) => (
              <View key={idx} style={styles.itemRow}>
                <MaterialCommunityIcons name="close-circle-outline" size={16} color={theme.colors.error} style={styles.bulletIcon} />
                <Text style={[styles.itemText, { color: theme.colors.text }]}>{fail}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Advisories */}
      {vehicle.advisories && vehicle.advisories.length > 0 && (
        <View style={[styles.card, styles.advisoriesCard, { backgroundColor: theme.colors.card }]}>
          <View style={styles.sectionHeaderRow}>
            <MaterialCommunityIcons name="alert-circle" size={20} color={theme.colors.warning} style={{ marginRight: 8 }} />
            <Text style={[styles.cardTitle, { color: theme.colors.warning, marginBottom: 0 }]}>Advisory Notices</Text>
          </View>
          <View style={styles.listContainer}>
            {vehicle.advisories.map((adv: string, idx: number) => (
              <View key={idx} style={styles.itemRow}>
                <MaterialCommunityIcons name="alert-circle-outline" size={16} color={theme.colors.warning} style={styles.bulletIcon} />
                <Text style={[styles.itemText, { color: theme.colors.text }]}>{adv}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* MOT History Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          onPress={() => navigation.navigate('MotHistory', { vehicleData: vehicle, registration: vehicle.registration })}
          style={[
            styles.saveButton,
            { backgroundColor: theme.colors.secondary },
          ]}
          activeOpacity={0.85}
        >
          <View style={styles.saveButtonContent}>
            <MaterialCommunityIcons 
              name="history" 
              size={20} 
              color="#FFFFFF" 
              style={{ marginRight: 8 }} 
            />
            <Text style={[styles.saveButtonText, { color: '#FFFFFF' }]}>
              View Full MOT History & Test Records
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
  </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    marginVertical: 24,
    paddingHorizontal: 16,
  },
  plateContainer: {
    flexDirection: 'row',
    height: 48,
    backgroundColor: '#FFD300',
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 12,
    alignItems: 'center',
    // elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  ukStrip: {
    width: 28,
    height: '100%',
    backgroundColor: '#0A4E9B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ukText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 8,
  },
  plateText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    paddingHorizontal: 16,
    letterSpacing: 1.5,
  },
  vehicleTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  vehicleSpec: {
    fontSize: 14,
    textAlign: 'center',
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    // elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  statusContent: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  statusIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  expiryText: {
    fontSize: 15,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  detailValue: {
    fontWeight: '500',
  },
  divider: {
    height: 1,
  },
  failuresCard: {
    borderColor: '#EF444450',
    borderWidth: 1.2,
  },
  advisoriesCard: {
    borderColor: '#F59E0B50',
    borderWidth: 1.2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  listContainer: {
    marginTop: 4,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 6,
    paddingRight: 8,
  },
  bulletIcon: {
    marginTop: 3,
    marginRight: 8,
  },
  itemText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  buttonContainer: {
    paddingHorizontal: 16,
    marginBottom: 32,
    marginTop: 8,
  },
  saveButton: {
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  topNavRow: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  navBackBtn: {
    padding: 6,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  scrollContent: {
    paddingBottom: 24,
  },
});
