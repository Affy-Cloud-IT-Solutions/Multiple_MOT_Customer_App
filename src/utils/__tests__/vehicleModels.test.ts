import {
  fetchVehicleModelsPage,
  checkModelAvailability,
  getLocalModels,
  ModelsLoadError,
} from '../vehicleModels';

const BASE = 'https://api.test/api';

const jsonFetch = (body: any, ok = true, status = 200) =>
  jest.fn(async () => ({ ok, status, json: async () => body })) as any;
const failingFetch = () => jest.fn(async () => {
  throw new Error('Network request failed');
}) as any;

describe('fetchVehicleModelsPage', () => {
  it('returns API models for a make that has them', async () => {
    const fetchImpl = jsonFetch({
      models: ['DUSTER', 'SANDERO'],
      hasModels: true,
      pagination: { page: 1, totalPages: 1 },
    });
    const result = await fetchVehicleModelsPage({ baseUrl: BASE, token: 't', make: 'dacia', fetchImpl });
    expect(result).toEqual({ items: ['DUSTER', 'SANDERO'], hasMore: false, hasModels: true });
    expect(fetchImpl.mock.calls[0][0]).toContain('/vehicles/models?make=DACIA&page=1&limit=20&search=');
  });

  it('falls back to the bundled UK catalogue when the API has no models for DACIA (old NHTSA-only backend)', async () => {
    const fetchImpl = jsonFetch({ models: [], pagination: { page: 1, totalPages: 0 } });
    const result = await fetchVehicleModelsPage({ baseUrl: BASE, make: 'DACIA', fetchImpl });
    expect(result.hasModels).toBe(true);
    expect(result.items).toEqual(expect.arrayContaining(['SANDERO', 'DUSTER']));
  });

  it('filters the bundled catalogue by search term', async () => {
    const result = await fetchVehicleModelsPage({
      baseUrl: BASE,
      make: 'DACIA',
      search: 'sand',
      fetchImpl: jsonFetch({ models: [] }),
    });
    expect(result.items).toEqual(['SANDERO', 'SANDERO STEPWAY']);
  });

  it('reports a make with genuinely no models when the API says so', async () => {
    const fetchImpl = jsonFetch({ models: [], hasModels: false, pagination: { page: 1, totalPages: 0 } });
    const result = await fetchVehicleModelsPage({ baseUrl: BASE, make: 'OBSCURE MAKE', fetchImpl });
    expect(result).toEqual({ items: [], hasMore: false, hasModels: false });
  });

  it('does not treat an empty search result as "no models" when the API says the make has models', async () => {
    const fetchImpl = jsonFetch({ models: [], hasModels: true, pagination: { page: 1, totalPages: 0 } });
    const result = await fetchVehicleModelsPage({ baseUrl: BASE, make: 'OBSCURE MAKE', search: 'zzz', fetchImpl });
    expect(result.hasModels).toBe(true);
  });

  it('does not treat an empty response without the hasModels flag as proof of no models', async () => {
    const result = await fetchVehicleModelsPage({
      baseUrl: BASE,
      make: 'OBSCURE MAKE',
      fetchImpl: jsonFetch({ models: [] }),
    });
    expect(result.hasModels).toBeNull();
  });

  it('throws ModelsLoadError on API failure when there is no local data', async () => {
    await expect(
      fetchVehicleModelsPage({ baseUrl: BASE, make: 'OBSCURE MAKE', fetchImpl: failingFetch() })
    ).rejects.toBeInstanceOf(ModelsLoadError);
    await expect(
      fetchVehicleModelsPage({ baseUrl: BASE, make: 'OBSCURE MAKE', fetchImpl: jsonFetch({ error: 'x' }, false, 502) })
    ).rejects.toBeInstanceOf(ModelsLoadError);
    await expect(
      fetchVehicleModelsPage({ baseUrl: BASE, make: 'OBSCURE MAKE', fetchImpl: jsonFetch({ unexpected: true }) })
    ).rejects.toBeInstanceOf(ModelsLoadError);
  });

  it('still lists UK catalogue models when the API fails for a UK make', async () => {
    const result = await fetchVehicleModelsPage({ baseUrl: BASE, make: 'SKODA', fetchImpl: failingFetch() });
    expect(result.hasModels).toBe(true);
    expect(result.items).toContain('OCTAVIA');
  });
});

describe('checkModelAvailability', () => {
  it('is "available" for a make with models', async () => {
    const fetchImpl = jsonFetch({ models: ['FOCUS'], hasModels: true, pagination: { page: 1, totalPages: 23 } });
    expect(await checkModelAvailability({ baseUrl: BASE, make: 'FORD', fetchImpl })).toBe('available');
  });

  it('is "none" only when the API confirms the make has no models', async () => {
    const fetchImpl = jsonFetch({ models: [], hasModels: false });
    expect(await checkModelAvailability({ baseUrl: BASE, make: 'OBSCURE MAKE', fetchImpl })).toBe('none');
  });

  it('is "error" (not "none") when models fail to load or cannot be confirmed', async () => {
    expect(await checkModelAvailability({ baseUrl: BASE, make: 'OBSCURE MAKE', fetchImpl: failingFetch() })).toBe('error');
    expect(await checkModelAvailability({ baseUrl: BASE, make: 'OBSCURE MAKE', fetchImpl: jsonFetch({ models: [] }) })).toBe(
      'error'
    );
  });

  it('is "idle" when no make is selected', async () => {
    expect(await checkModelAvailability({ baseUrl: BASE, make: '  ', fetchImpl: failingFetch() })).toBe('idle');
  });

  it('gives each make its own answer when switching between makes', async () => {
    const fetchImpl = jest.fn(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () =>
        url.includes('make=OBSCURE%20MAKE')
          ? { models: [], hasModels: false }
          : { models: ['SANDERO'], hasModels: true },
    })) as any;
    expect(await checkModelAvailability({ baseUrl: BASE, make: 'DACIA', fetchImpl })).toBe('available');
    expect(await checkModelAvailability({ baseUrl: BASE, make: 'OBSCURE MAKE', fetchImpl })).toBe('none');
    expect(await checkModelAvailability({ baseUrl: BASE, make: 'DACIA', fetchImpl })).toBe('available');
  });
});

describe('bundled UK catalogue', () => {
  it('has models for every make in the My Vehicles make list', () => {
    const makes = [
      'ALFA ROMEO', 'ASTON MARTIN', 'AUDI', 'BENTLEY', 'BMW', 'CITROEN', 'CUPRA', 'DACIA',
      'DS', 'FERRARI', 'FIAT', 'FORD', 'HONDA', 'HYUNDAI', 'JAGUAR', 'JEEP', 'KIA',
      'LAMBORGHINI', 'LAND ROVER', 'LEXUS', 'LOTUS', 'MASERATI', 'MAZDA', 'MCLAREN',
      'MERCEDES-BENZ', 'MG', 'MINI', 'MITSUBISHI', 'NISSAN', 'PEUGEOT', 'PORSCHE',
      'RENAULT', 'ROLLS-ROYCE', 'SEAT', 'SKODA', 'SMART', 'SSANGYONG', 'SUBARU',
      'SUZUKI', 'TESLA', 'TOYOTA', 'VAUXHALL', 'VOLKSWAGEN', 'VOLVO',
    ];
    makes.forEach(make => expect(getLocalModels(make).length).toBeGreaterThan(0));
  });
});
