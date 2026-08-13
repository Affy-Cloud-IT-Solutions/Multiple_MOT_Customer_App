import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useWebData } from '../context/WebDataContext';
import { useToast } from '../components/Toast';
import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, CornerUpLeft, Clipboard } from 'lucide-react';

export default function BookingScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const { customers, addAlert, addAudit } = useWebData();

  // Selected vehicle & options passed via state router navigation
  const stateData = location.state || {};
  const vehicle = stateData.vehicle || {
    registrationNumber: 'AB18 CDE',
    make: 'FORD',
    model: 'FOCUS TDCI',
    customerId: 'c1',
  };

  const isReschedule = stateData.isReschedule || false;
  const rescheduleAlertId = stateData.alertId || null;
  const isAdmin = stateData.isAdmin || false;

  // Find customer associated with vehicle
  const customer = customers.find((c) => 
    String(c.id).toLowerCase() === String(vehicle.customerId || '').toLowerCase() ||
    String(c._id).toLowerCase() === String(vehicle.customerId || '').toLowerCase()
  ) || customers[0];

  const [currentViewDate, setCurrentViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('09:00 AM');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const getDaysInMonth = (year: number, month: number) => {
    const date = new Date(year, month, 1);
    const days = [];
    const firstDayIndex = date.getDay(); // 0 = Sun, 6 = Sat
    
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }
    
    const lastDay = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= lastDay; d++) {
      days.push(new Date(year, month, d));
    }
    
    return days;
  };

  const isDateSelectable = (date: Date | null) => {
    if (!date) return false;
    const currentToday = new Date();
    currentToday.setHours(0, 0, 0, 0);
    
    if (date < currentToday) return false;
    if (date.getDay() === 0) return false; // Sunday
    
    return true;
  };

  const handlePrevMonth = () => {
    const prev = new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() - 1, 1);
    const now = new Date();
    if (prev.getFullYear() < now.getFullYear() || (prev.getFullYear() === now.getFullYear() && prev.getMonth() < now.getMonth())) {
      return;
    }
    setCurrentViewDate(prev);
  };

  const handleNextMonth = () => {
    const next = new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() + 1, 1);
    setCurrentViewDate(next);
  };

  const formatLocalDate = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const calendarDays = getDaysInMonth(currentViewDate.getFullYear(), currentViewDate.getMonth());

  const timeSlots = [
    { id: 't1', label: 'Morning', time: '09:00 AM' },
    { id: 't2', label: 'Late Morning', time: '11:30 AM' },
    { id: 't3', label: 'Afternoon', time: '02:00 PM' },
    { id: 't4', label: 'Late Afternoon', time: '04:30 PM' },
  ];

  const isTimeSlotPassed = (slotTimeStr: string) => {
    const todayISO = formatLocalDate(new Date());
    if (selectedDate !== todayISO) {
      return false;
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();

    const match = slotTimeStr.match(/^(\d{2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return false;

    let hour = parseInt(match[1]);
    const min = parseInt(match[2]);
    const period = match[3].toUpperCase();

    if (period === 'PM' && hour !== 12) {
      hour += 12;
    } else if (period === 'AM' && hour === 12) {
      hour = 0;
    }

    if (currentHour > hour) {
      return true;
    } else if (currentHour === hour) {
      return currentMin >= min;
    }
    return false;
  };

  useEffect(() => {
    // Default select date
    const d = new Date();
    if (d.getDay() === 0) {
      d.setDate(d.getDate() + 1); // Sunday skip
    }
    setSelectedDate(formatLocalDate(d));
  }, []);

  useEffect(() => {
    const available = timeSlots.filter(slot => !isTimeSlotPassed(slot.time));
    if (available.length > 0) {
      if (!available.some(s => s.time === selectedTime)) {
        setSelectedTime(available[0].time);
      }
    } else {
      setSelectedTime('');
    }
  }, [selectedDate]);

  const handleConfirmBooking = async () => {
    if (!selectedDate || !selectedTime) {
      showToast('Please select an appointment date and slot.', 'warning');
      return;
    }

    if (!customer) {
      showToast('No customer profile associated with this account.', 'error');
      return;
    }

    setLoading(true);
    try {
      const parts = selectedDate.split('-');
      const monthsList = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const displayDateStr = parts.length === 3 
        ? `${parseInt(parts[2])} ${monthsList[parseInt(parts[1]) - 1]}`
        : selectedDate;

      // Call API
      await addAlert({
        type: 'BOOKED',
        customerName: `${customer.firstName} ${customer.lastName}`,
        customerId: customer.id,
        registrationNumber: vehicle.registrationNumber,
        makeModel: `${vehicle.make} ${vehicle.model} - Slot: ${displayDateStr} at ${selectedTime}`,
        status: isAdmin ? 'Approved' : 'Pending',
        date: selectedDate,
      });

      const auditMsg = isAdmin
        ? `Garage staff booked MOT booking slot for ${customer.firstName} ${customer.lastName}'s ${vehicle.make} ${vehicle.model} (${vehicle.registrationNumber}) on ${displayDateStr} at ${selectedTime}`
        : `${customer.firstName} ${customer.lastName} ${isReschedule ? 'rescheduled' : 'requested'} MOT booking slot for ${vehicle.make} ${vehicle.model} (${vehicle.registrationNumber}) on ${displayDateStr} at ${selectedTime}`;

      await addAudit(
        isReschedule ? 'MOT Booking Rescheduled' : (isAdmin ? 'MOT Booking Booked' : 'MOT Booking Requested'),
        auditMsg
      );

      setLoading(false);
      const successMsg = isReschedule
        ? 'MOT Booking rescheduled successfully!'
        : (isAdmin 
            ? 'MOT Booking confirmed and approved!'
            : 'MOT Booking request submitted successfully!');

      showToast(successMsg);
      
      // Navigate back
      if (isAdmin) {
        navigate('/admin/customers');
      } else {
        navigate('/customer');
      }
    } catch (err: any) {
      setLoading(false);
      console.error(err);
      showToast(err.message || 'Failed to confirm booking.', 'error');
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <button onClick={() => navigate(-1)} style={styles.backBtn}>
            <CornerUpLeft size={18} />
            <span>Go Back</span>
          </button>
          <span style={styles.headerTitle}>
            {isReschedule ? 'Reschedule MOT Booking Slot' : (isAdmin ? 'Admin Booking Desk' : 'Book MOT Appointment')}
          </span>
          <div style={{ width: '90px' }} />
        </div>
      </header>

      <main style={styles.main}>
        <div className="responsive-grid" style={{ gridTemplateColumns: '1fr 1fr', alignItems: 'start' }}>
          {/* Calendar left side */}
          <div className="card">
            <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <CalendarIcon size={20} color="var(--primary)" /> 1. Select Date
            </h3>

            {/* Calendar */}
            <div style={styles.calendarCard}>
              <div style={styles.calendarHeader}>
                <button onClick={handlePrevMonth} style={styles.calNavBtn}>
                  <ChevronLeft size={22} />
                </button>
                <strong style={{ fontSize: '1rem' }}>
                  {monthNames[currentViewDate.getMonth()]} {currentViewDate.getFullYear()}
                </strong>
                <button onClick={handleNextMonth} style={styles.calNavBtn}>
                  <ChevronRight size={22} />
                </button>
              </div>

              <div style={styles.weekdaysRow}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, index) => (
                  <span key={d} style={{
                    ...styles.weekdayLabel,
                    color: index === 0 ? 'var(--error)' : 'var(--text-secondary)'
                  }}>
                    {d}
                  </span>
                ))}
              </div>

              <div style={styles.daysGrid}>
                {calendarDays.map((day, idx) => {
                  if (!day) {
                    return <div key={`empty-${idx}`} style={styles.dayCell} />;
                  }

                  const isoString = formatLocalDate(day);
                  const isSelected = selectedDate === isoString;
                  const selectable = isDateSelectable(day);
                  const today = new Date();
                  const isToday = day.getDate() === today.getDate() && 
                                  day.getMonth() === today.getMonth() && 
                                  day.getFullYear() === today.getFullYear();

                  return (
                    <button
                      key={isoString}
                      disabled={!selectable}
                      onClick={() => setSelectedDate(isoString)}
                      style={{
                        ...styles.dayCell,
                        backgroundColor: isSelected ? 'var(--secondary)' : 'transparent',
                        color: isSelected ? '#FFFFFF' : 'var(--text-primary)',
                        border: isToday && !isSelected ? '1.5px solid var(--secondary)' : 'none',
                        opacity: selectable ? 1 : 0.25,
                        cursor: selectable ? 'pointer' : 'not-allowed',
                        fontWeight: isSelected || isToday ? 'bold' : 'normal',
                      }}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Slots & notes right side */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Vehicle Info */}
            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              <div className="uk-plate" style={{ fontSize: '1.2rem' }}>{vehicle.registrationNumber}</div>
              <div>
                <h4 style={{ margin: 0, fontWeight: '800' }}>{vehicle.make} {vehicle.model}</h4>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Customer: <strong>{customer ? `${customer.firstName} ${customer.lastName}` : 'N/A'}</strong>
                </p>
              </div>
            </div>

            {/* Time Slot Picker */}
            <div className="card">
              <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Clock size={20} color="var(--primary)" /> 2. Choose Time Slot
              </h3>

              {timeSlots.filter(slot => !isTimeSlotPassed(slot.time)).length === 0 ? (
                <div style={styles.warningNotice}>
                  No slots available for today. Please select a future date on the calendar.
                </div>
              ) : (
                <div style={styles.timeGrid}>
                  {timeSlots.filter(slot => !isTimeSlotPassed(slot.time)).map((slot) => {
                    const isSelected = selectedTime === slot.time;
                    return (
                      <button
                        key={slot.id}
                        onClick={() => setSelectedTime(slot.time)}
                        style={{
                          ...styles.timeCard,
                          borderColor: isSelected ? 'var(--secondary)' : 'var(--border-color)',
                          backgroundColor: isSelected ? 'var(--secondary-light)' : 'var(--bg-secondary)',
                          color: isSelected ? 'var(--secondary)' : 'var(--text-primary)',
                        }}
                      >
                        <Clock size={16} />
                        <div>
                          <strong style={{ display: 'block', fontSize: '0.875rem' }}>{slot.label}</strong>
                          <span style={{ fontSize: '0.8rem', opacity: 0.85 }}>{slot.time}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Notes & special comments */}
            <div className="card">
              <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Clipboard size={20} color="var(--primary)" /> 3. Special Requests (Optional)
              </h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="E.g. Front brakes squealing, please check them during test."
                className="form-input"
                style={{ height: '80px', resize: 'none' }}
              />

              <button
                onClick={handleConfirmBooking}
                disabled={loading || !selectedDate || !selectedTime}
                className="btn btn-primary"
                style={{ width: '100%', height: '46px', marginTop: '1.5rem' }}
              >
                {loading ? 'Processing Booking...' : 'Confirm MOT Appointment'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    backgroundColor: 'var(--bg-primary)',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    height: '65px',
    backgroundColor: '#0F172A',
    borderBottom: '1px solid #1E293B',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 1.5rem',
  },
  headerContent: {
    width: '100%',
    maxWidth: '1200px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backBtn: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#94A3B8',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
  },
  headerTitle: {
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'Outfit',
    fontSize: '1.15rem',
  },
  main: {
    flex: 1,
    width: '100%',
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '2.5rem 1.5rem',
  },
  calendarCard: {
    padding: '1rem',
    border: '1px solid var(--border-color)',
    borderRadius: '10px',
  },
  calendarHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.25rem',
  },
  calNavBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    padding: '0.25rem',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdaysRow: {
    display: 'flex',
    justifyContent: 'space-between',
    borderBottom: '1px solid var(--border-color)',
    paddingBottom: '0.5rem',
    marginBottom: '0.75rem',
  },
  weekdayLabel: {
    width: '14.2%',
    textAlign: 'center',
    fontSize: '0.8rem',
    fontWeight: '600',
  },
  daysGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    rowGap: '0.5rem',
  },
  dayCell: {
    width: '14.2%',
    height: '38px',
    borderRadius: '50%',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.875rem',
    backgroundColor: 'transparent',
  },
  warningNotice: {
    padding: '1rem',
    borderRadius: '8px',
    border: '1px solid var(--error)',
    backgroundColor: 'var(--error-light)',
    color: 'var(--error)',
    fontSize: '0.875rem',
  },
  timeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '0.85rem',
  },
  timeCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    padding: '0.85rem 1rem',
    border: '1.5px solid',
    borderRadius: '8px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.2s',
  },
};
