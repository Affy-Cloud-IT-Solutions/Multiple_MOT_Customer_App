import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues } from '../context/DataContext';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function BookingScreen({ route, navigation }: any) {
  const { theme } = useAppTheme();
  const { customers, addAlert, addAudit } = useAppValues();

  // Selected vehicle passed from CustomerPortalScreen
  const vehicle = route?.params?.vehicle || {
    registrationNumber: 'AB18 CDE',
    make: 'FORD',
    model: 'FOCUS TDCI',
    customerId: 'c1',
  };

  const isReschedule = route?.params?.isReschedule || false;

  const customer = customers.find((c) => c.id === vehicle.customerId) || customers[0];

  if (!customer) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={{ marginTop: 10, color: theme.colors.text }}>Loading booking details...</Text>
      </SafeAreaView>
    );
  }

  // Date and Time options for slot selection
  const getNextDays = () => {
    const days = [];
    const today = new Date('2026-07-22'); // Aligning with the app's current date reference
    for (let i = 1; i <= 6; i++) {
      const nextDay = new Date(today);
      nextDay.setDate(today.getDate() + i);
      
      // Skip Sundays
      if (nextDay.getDay() === 0) continue;

      const dayName = nextDay.toLocaleDateString('en-GB', { weekday: 'short' });
      const dayNum = nextDay.getDate();
      const monthName = nextDay.toLocaleDateString('en-GB', { month: 'short' });
      const fullDate = nextDay.toISOString().substring(0, 10);

      days.push({ dayName, dayNum, monthName, fullDate });
    }
    return days;
  };

  const availableDays = getNextDays();
  const timeSlots = [
    { id: 't1', label: 'Morning', time: '09:00 AM' },
    { id: 't2', label: 'Late Morning', time: '11:30 AM' },
    { id: 't3', label: 'Afternoon', time: '02:00 PM' },
    { id: 't4', label: 'Late Afternoon', time: '04:30 PM' },
  ];

  const [selectedDate, setSelectedDate] = useState(availableDays[0]?.fullDate || '');
  const [selectedTime, setSelectedTime] = useState(timeSlots[0]?.time || '');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfirmBooking = async () => {
    if (!selectedDate || !selectedTime) {
      Alert.alert('Error', 'Please select a date and time slot.');
      return;
    }

    setLoading(true);
    try {
      const formattedDate = availableDays.find(d => d.fullDate === selectedDate);
      const displayDateStr = formattedDate 
        ? `${formattedDate.dayNum} ${formattedDate.monthName}`
        : selectedDate;

      // Add BOOKED alert notification to Admin alerts list
      await addAlert({
        type: 'BOOKED',
        customerName: `${customer.firstName} ${customer.lastName}`,
        customerId: customer.id,
        registrationNumber: vehicle.registrationNumber,
        makeModel: `${vehicle.make} ${vehicle.model} - Slot: ${displayDateStr} at ${selectedTime}`,
      });

      // Log to audit history
      await addAudit(
        isReschedule ? 'MOT Booking Rescheduled' : 'MOT Booking Requested',
        `${customer.firstName} ${customer.lastName} ${isReschedule ? 'rescheduled' : 'requested'} MOT booking slot for ${vehicle.make} ${vehicle.model} (${vehicle.registrationNumber}) on ${displayDateStr} at ${selectedTime}`
      );

      setLoading(false);

      Alert.alert(
        isReschedule ? 'Rescheduled Successfully' : 'Booking Request Submitted',
        isReschedule 
          ? 'Your appointment has been successfully rescheduled.'
          : 'Your booking slot has been selected and submitted to the garage. You can review confirmations in the notifications screen.',
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.navigate('CustomerPortal', { customerId: customer.id });
            },
          },
        ]
      );
    } catch (err: any) {
      setLoading(false);
      Alert.alert('Error', err.message || 'Failed to confirm booking slot.');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Top Header */}
      <View style={[styles.navbar, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.text} />
          <Text style={[styles.backBtnText, { color: theme.colors.text }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: theme.colors.text }]}>
          {isReschedule ? 'Reschedule MOT Slot' : 'Book MOT Slot'}
        </Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Vehicle Summary Header Card */}
        <View style={[styles.vehicleCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={styles.plate}>
            <Text style={styles.plateText}>{vehicle.registrationNumber}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.vehicleMakeModel, { color: theme.colors.text }]}>
              {vehicle.make} {vehicle.model}
            </Text>
            <Text style={[styles.vehicleSubText, { color: theme.colors.placeholder }]}>
              {isReschedule ? 'Rescheduling appointment for this vehicle' : 'Booking an appointment for this vehicle'}
            </Text>
          </View>
        </View>

        {isReschedule && (
          <View style={[styles.rescheduleNotice, { backgroundColor: theme.colors.warning + '15', borderColor: theme.colors.warning }]}>
            <MaterialCommunityIcons name="alert-circle-outline" size={20} color={theme.colors.warning} style={{ marginRight: 8 }} />
            <Text style={[styles.rescheduleNoticeText, { color: theme.colors.text }]}>
              You are rescheduling your existing MOT booking. The new date and slot will replace your current reservation upon confirmation.
            </Text>
          </View>
        )}

        {/* Date Selector Section */}
        <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>1. Select Appointment Date</Text>
        <View style={styles.datePickerContainer}>
          {availableDays.map((day) => {
            const isSelected = selectedDate === day.fullDate;
            return (
              <TouchableOpacity
                key={day.fullDate}
                onPress={() => setSelectedDate(day.fullDate)}
                style={[
                  styles.dateCard,
                  {
                    backgroundColor: isSelected ? theme.colors.secondary : theme.colors.card,
                    borderColor: isSelected ? theme.colors.secondary : theme.colors.border,
                  },
                ]}
              >
                <Text style={[styles.dayName, { color: isSelected ? '#FFFFFF' : theme.colors.placeholder }]}>
                  {day.dayName}
                </Text>
                <Text style={[styles.dayNum, { color: isSelected ? '#FFFFFF' : theme.colors.text }]}>
                  {day.dayNum}
                </Text>
                <Text style={[styles.monthName, { color: isSelected ? '#FFFFFF' : theme.colors.placeholder }]}>
                  {day.monthName}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Time Selector Section */}
        <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>2. Choose Time Slot</Text>
        <View style={styles.timePickerContainer}>
          {timeSlots.map((slot) => {
            const isSelected = selectedTime === slot.time;
            return (
              <TouchableOpacity
                key={slot.id}
                onPress={() => setSelectedTime(slot.time)}
                style={[
                  styles.timeCard,
                  {
                    backgroundColor: isSelected ? theme.colors.secondary + '15' : theme.colors.card,
                    borderColor: isSelected ? theme.colors.secondary : theme.colors.border,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={isSelected ? 'clock' : 'clock-outline'}
                  size={16}
                  color={isSelected ? theme.colors.secondary : theme.colors.placeholder}
                  style={{ marginRight: 6 }}
                />
                <View>
                  <Text style={[styles.timeLabel, { color: theme.colors.text }]}>{slot.label}</Text>
                  <Text style={[styles.timeText, { color: theme.colors.placeholder }]}>{slot.time}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Notes/Comments Section */}
        <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>3. Special Requests / Notes (Optional)</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="E.g., Rear brakes squealing, please check them during test."
          placeholderTextColor={theme.colors.placeholder}
          multiline
          numberOfLines={4}
          style={[
            styles.notesInput,
            {
              color: theme.colors.text,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.card,
            },
          ]}
        />

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          <TouchableOpacity
            onPress={handleConfirmBooking}
            disabled={loading}
            style={[styles.submitBtn, { backgroundColor: isReschedule ? theme.colors.warning : theme.colors.secondary }]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <View style={styles.btnContent}>
                <MaterialCommunityIcons name="calendar-check" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.submitBtnText}>
                  {isReschedule ? 'Confirm Rescheduling' : 'Confirm Appointment Booking'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 60,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  navTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 24,
    gap: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  plate: {
    backgroundColor: '#FFD300',
    borderWidth: 1.5,
    borderColor: '#000',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  plateText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  vehicleMakeModel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  vehicleSubText: {
    fontSize: 12,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  datePickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 6,
  },
  dateCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    minWidth: 50,
  },
  dayName: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  dayNum: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  monthName: {
    fontSize: 10,
    fontWeight: '600',
  },
  timePickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  timeCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  timeLabel: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  timeText: {
    fontSize: 11,
    marginTop: 1,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    height: 90,
    textAlignVertical: 'top',
    marginBottom: 28,
  },
  actionContainer: {
    marginBottom: 20,
  },
  submitBtn: {
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  rescheduleNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 20,
  },
  rescheduleNoticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
});
