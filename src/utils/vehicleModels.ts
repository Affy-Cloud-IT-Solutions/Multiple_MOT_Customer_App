// Bundled copy of Multiple_MOT_Backend/data/ukVehicleModels.json - keep the two files in sync
import UK_VEHICLE_MODELS from '../data/ukVehicleModels.json';

/**
 * Whether the selected make has models to choose from:
 * - idle: no make selected
 * - loading: availability is being checked
 * - available: the make has models, so one must be selected
 * - none: the data source confirmed the make has no models, so Model may be left blank
 * - error: models could not be loaded/confirmed - never treated as "none"
 */
export type ModelAvailability = 'idle' | 'loading' | 'available' | 'none' | 'error';

export interface ModelsPage {
  items: string[];
  hasMore: boolean;
  /** true/false when the source says whether the make has any models, null when that couldn't be confirmed */
  hasModels: boolean | null;
}

export class ModelsLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModelsLoadError';
  }
}

const LOCAL_MODELS: Record<string, string[]> = UK_VEHICLE_MODELS;

const normalizeMake = (make: string) => (make || '').trim().toUpperCase();

export const getLocalModels = (make: string): string[] => LOCAL_MODELS[normalizeMake(make)] || [];

const pageLocalModels = (models: string[], search: string, page: number, limit: number) => {
  const query = search.trim().toUpperCase();
  const filtered = query ? models.filter(m => m.includes(query)) : models;
  const start = (page - 1) * limit;
  return { items: filtered.slice(start, start + limit), hasMore: start + limit < filtered.length };
};

interface FetchModelsArgs {
  baseUrl: string;
  token?: string | null;
  make: string;
  search?: string;
  page?: number;
  limit?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Loads one page of models for a make from the API.
 * The API is the source of truth; the bundled UK catalogue is used when the API fails or has no
 * models for a UK make (e.g. an older backend that only queried the US NHTSA database).
 * Throws ModelsLoadError when models can't be loaded and there is no local data - an API failure
 * is never reported as "this make has no models".
 */
export const fetchVehicleModelsPage = async ({
  baseUrl,
  token,
  make,
  search = '',
  page = 1,
  limit = 20,
  fetchImpl = fetch,
}: FetchModelsArgs): Promise<ModelsPage> => {
  const key = normalizeMake(make);
  if (!key) return { items: [], hasMore: false, hasModels: null };
  const local = getLocalModels(key);

  let data: any;
  try {
    const response = await fetchImpl(
      `${baseUrl}/vehicles/models?make=${encodeURIComponent(key)}&page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`,
      {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      }
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    data = await response.json();
    if (!data || !Array.isArray(data.models)) throw new Error('Unexpected models response');
  } catch (e: any) {
    if (local.length > 0) return { ...pageLocalModels(local, search, page, limit), hasModels: true };
    throw new ModelsLoadError(`Could not load models for ${key}: ${e?.message || 'unknown error'}`);
  }

  if (data.models.length > 0) {
    return {
      items: data.models,
      hasMore: data.pagination ? data.pagination.page < data.pagination.totalPages : false,
      hasModels: true,
    };
  }
  // Empty page: either a search/page past the end, or the API has nothing for this make
  if (data.hasModels === true) return { items: [], hasMore: false, hasModels: true };
  if (local.length > 0) return { ...pageLocalModels(local, search, page, limit), hasModels: true };
  if (data.hasModels === false) return { items: [], hasMore: false, hasModels: false };
  // Older API without the hasModels flag: an empty list alone doesn't prove the make has no models
  return { items: [], hasMore: false, hasModels: null };
};

/** Works out whether the make has models, for deciding if Model is required. */
export const checkModelAvailability = async (
  args: Omit<FetchModelsArgs, 'search' | 'page' | 'limit'>
): Promise<ModelAvailability> => {
  if (!normalizeMake(args.make)) return 'idle';
  try {
    const result = await fetchVehicleModelsPage({ ...args, search: '', page: 1, limit: 1 });
    if (result.hasModels === true) return 'available';
    if (result.hasModels === false) return 'none';
    return 'error';
  } catch {
    return 'error';
  }
};
