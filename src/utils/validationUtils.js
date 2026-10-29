 
export const validateFirstName = (firstName) => {
  const sanitized = firstName.replace(/[^A-Za-z]/g, '');
  if (!sanitized.trim()) return { error: 'First name is required.', value: sanitized };
  if (!/^[A-Za-z]+$/.test(sanitized)) return { error: 'First name must contain only letters.', value: sanitized };
  return { error: '', value: sanitized };
};

export const validateLastName = (lastName) => {
  const sanitized = lastName.replace(/[^A-Za-z]/g, '');
  if (!sanitized.trim()) return { error: 'Last name is required.', value: sanitized };
  if (!/^[A-Za-z]+$/.test(sanitized)) return { error: 'Last name must contain only letters.', value: sanitized };
  return { error: '', value: sanitized };
};

export const validatePhoneNumber = (phoneNumber) => {
  const sanitized = phoneNumber.replace(/[^0-9]/g, '');
  if (!sanitized.trim()) return { error: 'Phone number is required.', value: sanitized };
  if (!/^\d{10}$/.test(sanitized)) return { error: 'Phone number must be 10 digits only.', value: sanitized };
  return { error: '', value: sanitized };
};

export const validateEmail = (email) => {
  const sanitized = email.trim(); // no special sanitization
  if (!sanitized) return { error: 'Email is required.', value: sanitized };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitized)) return { error: 'Enter a valid email address.', value: sanitized };
  return { error: '', value: sanitized };
};

export const validatePassword = (password) => {
  const sanitized = password.trim(); // no special sanitization
  if (!sanitized) return { error: 'Password is required.', value: sanitized };
  return { error: '', value: sanitized };
};

export const validateMotExpiryDate = (dateStr) => {
  if (!dateStr || !dateStr.trim()) {
    return { error: 'MOT Expiry Date is required.', value: dateStr };
  }
  
  const reg = /^\d{4}-\d{2}-\d{2}$/;
  if (!reg.test(dateStr)) {
    return { error: 'Date must be in YYYY-MM-DD format.', value: dateStr };
  }
  
  const parts = dateStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  
  if (month < 1 || month > 12) {
    return { error: 'Month must be between 01 and 12.', value: dateStr };
  }
  
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  if (isLeapYear) {
    daysInMonth[1] = 29;
  }
  
  const maxDays = daysInMonth[month - 1];
  if (day < 1 || day > maxDays) {
    return { 
      error: `Day must be between 01 and ${String(maxDays).padStart(2, '0')} for month ${String(month).padStart(2, '0')}.`, 
      value: dateStr 
    };
  }
  
  return { error: '', value: dateStr };
};

// UK (GB + Northern Ireland) plate formats, checked with spaces removed:
// current AB12CDE, prefix A123BCD, suffix ABC123D, dateless/NI ABC1234 or 1234ABC
const UK_PLATE_PATTERNS = [
  /^[A-Z]{2}\d{2}[A-Z]{3}$/,
  /^[A-Z]\d{1,3}[A-Z]{3}$/,
  /^[A-Z]{3}\d{1,3}[A-Z]$/,
  /^[A-Z]{1,3}\d{1,4}$/,
  /^\d{1,4}[A-Z]{1,3}$/,
];

export const isValidUkPlate = (plate) => {
  if (typeof plate !== 'string') return false;
  const compact = plate.replace(/\s+/g, '').toUpperCase();
  return UK_PLATE_PATTERNS.some((re) => re.test(compact));
};

// Required fields of the add-vehicle forms (booking flow and My Vehicles), in on-screen order
const NEW_VEHICLE_FIELDS = [
  { key: 'registration', label: 'UK registration plate' },
  { key: 'make', label: 'vehicle make' },
  { key: 'model', label: 'vehicle model' },
  { key: 'year', label: 'vehicle year' },
  { key: 'motExpiry', label: 'MOT expiry date' },
];

const joinLabels = (labels) =>
  labels.length <= 1 ? labels.join('') : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;

// Missing-field messages for add-vehicle forms where Make/Model are picked from dropdowns
export const VEHICLE_DROPDOWN_FORM_MESSAGES = {
  registration: 'Please enter the UK registration number.',
  make: 'Please select a vehicle make.',
  model: 'Please select a vehicle model.',
  year: 'Please enter the vehicle year.',
  motExpiry: 'Please enter the MOT expiry date.',
};

// Same range the backend Vehicle schema enforces (min 1900, max next year)
const MIN_VEHICLE_YEAR = 1900;

/**
 * Validates an add-vehicle form field by field.
 * Whitespace-only values count as empty. Only the fields that are actually missing are named,
 * and filled-in fields with a bad value get their own message instead of being reported as missing.
 *
 * options.modelAvailability ('idle' | 'loading' | 'available' | 'none' | 'error', see utils/vehicleModels):
 *   Model may only be left blank when it is 'none' (the make genuinely has no models). While models are
 *   loading or failed to load, a blank Model is blocked with an explanatory message.
 * options.missingMessages: per-field messages for missing fields; when given, each missing field gets its
 *   own line instead of the combined "Please enter the X, Y and Z." sentence.
 *
 * Returns { isValid, title, message, errors: { [field]: message }, values: cleaned values }.
 */
export const validateNewVehicleForm = ({ registration, make, model, year, motExpiry } = {}, options = {}) => {
  const { modelAvailability, missingMessages } = options;
  const clean = (v) => (typeof v === 'string' ? v.trim() : '');
  const values = {
    registration: clean(registration).toUpperCase(),
    make: clean(make).toUpperCase(),
    model: clean(model).toUpperCase(),
    year: clean(year),
    motExpiry: clean(motExpiry),
  };

  // A blank model is fine for a make with no models; while unknown it's reported below instead of as "missing"
  const modelUnconfirmed = !values.model && (modelAvailability === 'loading' || modelAvailability === 'error');
  const modelOptional = modelAvailability === 'none';

  /** @type {Record<string, string>} */
  const errors = {};
  const missing = NEW_VEHICLE_FIELDS.filter(
    (f) => !values[f.key] && !(f.key === 'model' && (modelOptional || modelUnconfirmed))
  );
  missing.forEach((f) => {
    errors[f.key] = (missingMessages && missingMessages[f.key]) || `Please enter the ${f.label}.`;
  });

  const invalid = [];
  if (values.registration && !isValidUkPlate(values.registration)) {
    errors.registration = 'Please enter a valid UK registration plate (e.g. AB12 CDE).';
    invalid.push({ key: 'registration', title: 'Invalid Registration' });
  }
  if (modelUnconfirmed) {
    errors.model =
      modelAvailability === 'loading'
        ? 'Models for this make are still loading. Please wait a moment, then select a model.'
        : 'We couldn\'t load models for this make. Please check your connection and try again.';
    invalid.push({ key: 'model', title: 'Vehicle Model' });
  }
  if (values.year) {
    const maxYear = new Date().getFullYear() + 1;
    const yearNum = parseInt(values.year, 10);
    if (!/^\d{4}$/.test(values.year)) {
      errors.year = 'Please enter a valid 4-digit manufacture year (e.g. 2019).';
      invalid.push({ key: 'year', title: 'Invalid Year' });
    } else if (yearNum < MIN_VEHICLE_YEAR || yearNum > maxYear) {
      errors.year = `Please enter a year between ${MIN_VEHICLE_YEAR} and ${maxYear}.`;
      invalid.push({ key: 'year', title: 'Invalid Year' });
    }
  }
  if (values.motExpiry) {
    const expiryCheck = validateMotExpiryDate(values.motExpiry);
    if (expiryCheck.error) {
      errors.motExpiry = expiryCheck.error;
      invalid.push({ key: 'motExpiry', title: 'Validation Error' });
    }
  }

  if (missing.length === 0 && invalid.length === 0) {
    return { isValid: true, title: '', message: '', errors, values };
  }

  const lines = [];
  if (missing.length > 0) {
    if (missingMessages) missing.forEach((f) => lines.push(errors[f.key]));
    else lines.push(`Please enter the ${joinLabels(missing.map((f) => f.label))}.`);
  }
  invalid.forEach((f) => lines.push(errors[f.key]));

  let title = 'Invalid Details';
  if (missing.length > 0) title = 'Missing Details';
  else if (invalid.length === 1) title = invalid[0].title;

  return { isValid: false, title, message: lines.join('\n'), errors, values };
};
