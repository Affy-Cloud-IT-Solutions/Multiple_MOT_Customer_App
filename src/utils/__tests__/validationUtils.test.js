import { validateNewVehicleForm, isValidUkPlate } from '../validationUtils';

const complete = {
  registration: 'ab12 cde',
  make: 'Ford',
  model: 'Focus',
  year: '2019',
  motExpiry: '2027-03-15',
};

describe('validateNewVehicleForm', () => {
  it('passes and returns cleaned values when all fields are correctly filled', () => {
    const result = validateNewVehicleForm({ ...complete, make: '  Ford ' });
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
    expect(result.values).toEqual({
      registration: 'AB12 CDE',
      make: 'FORD',
      model: 'FOCUS',
      year: '2019',
      motExpiry: '2027-03-15',
    });
  });

  it.each([
    ['registration', 'Please enter the UK registration plate.'],
    ['make', 'Please enter the vehicle make.'],
    ['model', 'Please enter the vehicle model.'],
    ['year', 'Please enter the vehicle year.'],
    ['motExpiry', 'Please enter the MOT expiry date.'],
  ])('reports only the missing %s field', (field, expected) => {
    const result = validateNewVehicleForm({ ...complete, [field]: '' });
    expect(result.isValid).toBe(false);
    expect(result.title).toBe('Missing Details');
    expect(result.message).toBe(expected);
    expect(Object.keys(result.errors)).toEqual([field]);
  });

  it('does not claim the other four fields are missing when only the plate is empty', () => {
    const { message } = validateNewVehicleForm({ ...complete, registration: '' });
    ['make', 'model', 'year', 'MOT'].forEach((word) => expect(message).not.toMatch(word));
  });

  it('treats whitespace-only values as empty', () => {
    const result = validateNewVehicleForm({ ...complete, registration: '   ', model: '\t ' });
    expect(result.message).toBe('Please enter the UK registration plate and vehicle model.');
  });

  it('names exactly the missing fields when several are empty', () => {
    const result = validateNewVehicleForm({ ...complete, registration: '', year: '', motExpiry: '' });
    expect(result.title).toBe('Missing Details');
    expect(result.message).toBe('Please enter the UK registration plate, vehicle year and MOT expiry date.');
    expect(Object.keys(result.errors).sort()).toEqual(['motExpiry', 'registration', 'year']);
  });

  it('names all five fields when the whole form is empty', () => {
    expect(validateNewVehicleForm({}).message).toBe(
      'Please enter the UK registration plate, vehicle make, vehicle model, vehicle year and MOT expiry date.'
    );
  });

  it('reports an invalid year as invalid, not missing', () => {
    const result = validateNewVehicleForm({ ...complete, year: '19' });
    expect(result).toMatchObject({
      isValid: false,
      title: 'Invalid Year',
      message: 'Please enter a valid 4-digit manufacture year (e.g. 2019).',
    });
  });

  it('reports an invalid MOT expiry date with the date-specific message', () => {
    const badFormat = validateNewVehicleForm({ ...complete, motExpiry: '15/03/2027' });
    expect(badFormat).toMatchObject({ title: 'Validation Error', message: 'Date must be in YYYY-MM-DD format.' });

    const badDay = validateNewVehicleForm({ ...complete, motExpiry: '2027-02-30' });
    expect(badDay.message).toBe('Day must be between 01 and 28 for month 02.');
  });

  it('reports both invalid fields together when year and expiry are wrong', () => {
    const result = validateNewVehicleForm({ ...complete, year: 'abcd', motExpiry: '2027-13-01' });
    expect(result.title).toBe('Invalid Details');
    expect(result.message).toBe(
      'Please enter a valid 4-digit manufacture year (e.g. 2019).\nMonth must be between 01 and 12.'
    );
  });

  it('lists missing fields first, then invalid values, when both occur', () => {
    const result = validateNewVehicleForm({ ...complete, registration: '', year: '20' });
    expect(result.title).toBe('Missing Details');
    expect(result.message).toBe(
      'Please enter the UK registration plate.\nPlease enter a valid 4-digit manufacture year (e.g. 2019).'
    );
  });

  it('reports an invalid registration plate as invalid, not missing', () => {
    const result = validateNewVehicleForm({ ...complete, registration: '12345678' });
    expect(result).toMatchObject({
      isValid: false,
      title: 'Invalid Registration',
      message: 'Please enter a valid UK registration plate (e.g. AB12 CDE).',
    });
    expect(Object.keys(result.errors)).toEqual(['registration']);
  });

  it('returns a per-field error for every missing or invalid field (used for red borders)', () => {
    const result = validateNewVehicleForm({ registration: '!!', make: ' ', model: 'Focus', year: '19', motExpiry: '' });
    expect(result.errors).toEqual({
      registration: 'Please enter a valid UK registration plate (e.g. AB12 CDE).',
      make: 'Please enter the vehicle make.',
      year: 'Please enter a valid 4-digit manufacture year (e.g. 2019).',
      motExpiry: 'Please enter the MOT expiry date.',
    });
    expect(result.errors.model).toBeUndefined();
  });
});

describe('isValidUkPlate', () => {
  it.each(['AB12 CDE', 'ab12cde', 'A123 BCD', 'ABC 123D', 'K1', '1 ABC', 'ABZ 1234'])('accepts %s', (plate) => {
    expect(isValidUkPlate(plate)).toBe(true);
  });

  it.each(['', '   ', 'ABCDEFG', '12345678', 'AB12 CD!', 'AB1234CDE', null, undefined])('rejects %p', (plate) => {
    expect(isValidUkPlate(plate)).toBe(false);
  });
});

describe('validateNewVehicleForm - My Vehicles (model availability + messages)', () => {
  const myVehiclesMessages = {
    registration: 'Please enter the UK registration number.',
    make: 'Please select a vehicle make.',
    model: 'Please select a vehicle model.',
    year: 'Please enter the vehicle year.',
    motExpiry: 'Please enter the MOT expiry date.',
  };
  const opts = (modelAvailability) => ({ modelAvailability, missingMessages: myVehiclesMessages });

  it.each([
    ['registration', 'Please enter the UK registration number.'],
    ['make', 'Please select a vehicle make.'],
    ['year', 'Please enter the vehicle year.'],
    ['motExpiry', 'Please enter the MOT expiry date.'],
  ])('reports only the missing %s field with the My Vehicles message', (field, expected) => {
    const result = validateNewVehicleForm({ ...complete, [field]: '' }, opts('available'));
    expect(result.message).toBe(expected);
    expect(Object.keys(result.errors)).toEqual([field]);
  });

  it('requires a model when the make has models available', () => {
    const result = validateNewVehicleForm({ ...complete, model: '' }, opts('available'));
    expect(result).toMatchObject({ isValid: false, title: 'Missing Details', message: 'Please select a vehicle model.' });
  });

  it('allows a blank model when the make genuinely has no models', () => {
    const result = validateNewVehicleForm({ ...complete, make: 'OBSCURE MAKE', model: '' }, opts('none'));
    expect(result.isValid).toBe(true);
    expect(result.values.model).toBe('');
  });

  it('still accepts a selected model for a make with models', () => {
    expect(validateNewVehicleForm({ ...complete, make: 'DACIA', model: 'Sandero' }, opts('available')).isValid).toBe(true);
  });

  it('blocks a blank model while models are still loading', () => {
    const result = validateNewVehicleForm({ ...complete, model: '' }, opts('loading'));
    expect(result.isValid).toBe(false);
    expect(result.errors.model).toMatch(/still loading/);
  });

  it('blocks a blank model when models failed to load (API error is not "no models")', () => {
    const result = validateNewVehicleForm({ ...complete, model: '' }, opts('error'));
    expect(result.isValid).toBe(false);
    expect(result.errors.model).toMatch(/couldn't load models/);
  });

  it('lists one line per missing field when several are missing', () => {
    const result = validateNewVehicleForm({ ...complete, registration: ' ', make: '', model: '' }, opts('idle'));
    expect(result.message).toBe(
      'Please enter the UK registration number.\nPlease select a vehicle make.\nPlease select a vehicle model.'
    );
  });

  it('does not block other fields because a no-models make has a blank model', () => {
    const result = validateNewVehicleForm({ ...complete, model: '', year: '' }, opts('none'));
    expect(result.message).toBe('Please enter the vehicle year.');
    expect(result.errors.model).toBeUndefined();
  });

  it('rejects a year outside the range the backend accepts', () => {
    const next = new Date().getFullYear() + 1;
    expect(validateNewVehicleForm({ ...complete, year: '1899' }, opts('available')).errors.year).toBe(
      `Please enter a year between 1900 and ${next}.`
    );
    expect(validateNewVehicleForm({ ...complete, year: String(next + 1) }, opts('available')).isValid).toBe(false);
    expect(validateNewVehicleForm({ ...complete, year: String(next) }, opts('available')).isValid).toBe(true);
  });
});
