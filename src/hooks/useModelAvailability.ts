import { useCallback, useEffect, useRef, useState } from 'react';
import { checkModelAvailability, fetchVehicleModelsPage, ModelAvailability } from '../utils/vehicleModels';

/**
 * Tracks whether the selected make has models (which decides if Model is required) and provides
 * the Model dropdown's fetchItems for that make. Responses for a make the user has since changed
 * away from are ignored, and load failures are reported as 'error', never as "no models".
 */
export function useModelAvailability(make: string, baseUrl: string, token?: string | null) {
  const [availability, setAvailability] = useState<ModelAvailability>('idle');
  const currentMakeRef = useRef('');

  useEffect(() => {
    const makeKey = make.trim().toUpperCase();
    currentMakeRef.current = makeKey;
    if (!makeKey) {
      setAvailability('idle');
      return;
    }
    setAvailability('loading');
    checkModelAvailability({ baseUrl, token, make: makeKey }).then(status => {
      if (currentMakeRef.current === makeKey) setAvailability(status);
    });
  }, [make, baseUrl, token]);

  // Throws when models can't be loaded, so the dropdown shows an error + retry instead of "No models found"
  const fetchModels = useCallback(
    async (search: string, page: number) => {
      const makeKey = make.trim().toUpperCase();
      const result = await fetchVehicleModelsPage({ baseUrl, token, make: makeKey, search, page });
      // A successful unfiltered first page also settles whether Model is required (e.g. after a retry)
      if (!search && page === 1 && result.hasModels !== null && currentMakeRef.current === makeKey) {
        setAvailability(result.hasModels ? 'available' : 'none');
      }
      return { items: result.items, hasMore: result.hasMore };
    },
    [make, baseUrl, token]
  );

  return { availability, fetchModels };
}
