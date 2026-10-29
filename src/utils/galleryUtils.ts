export interface GarageImageSource {
  images?: any;
  coverImage?: any;
  logoUrl?: any;
}

export interface BuildGarageImageOptions {
  /** Server origin (e.g. https://api.example.com) used to resolve server-relative paths like /uploads/x.jpg */
  baseOrigin?: string;
}

// Schemes React Native's <Image> can actually load. Anything else (bare words, "null", relative paths
// that couldn't be resolved) renders as a blank box, and on iOS often without firing onError.
const LOADABLE_URI_PATTERN = /^(https?:\/\/[^\s/?#]+[^\s]*|file:\/\/\S+|content:\/\/\S+|data:image\/[a-z0-9.+-]+;base64,\S+)$/i;

/**
 * Normalises a raw image value from the API into a loadable URI, or returns null if it can't be loaded.
 * - trims whitespace
 * - drops non-strings, blanks and stringified empties ("null", "undefined")
 * - resolves protocol-relative (//host/x) and server-relative (/uploads/x) paths
 */
export const normalizeImageUri = (raw: any, options: BuildGarageImageOptions = {}): string | null => {
  if (typeof raw !== 'string') return null;
  let uri = raw.trim();
  if (!uri || uri === 'null' || uri === 'undefined') return null;

  if (uri.startsWith('//')) {
    uri = `https:${uri}`;
  } else if (uri.startsWith('/')) {
    if (!options.baseOrigin) return null;
    uri = `${options.baseOrigin.replace(/\/+$/, '')}${uri}`;
  }

  return LOADABLE_URI_PATTERN.test(uri) ? uri : null;
};

/**
 * Builds the de-duplicated list of candidate garage photo URLs from raw garage data.
 * Only loadable URIs are kept; empty/invalid entries (null, undefined, blank, non-string, malformed) are dropped here.
 * This does not know whether a URL actually loads - see excludeBrokenImages for that.
 * Returns an empty array when there are no usable photos so the UI can show its empty state.
 */
export const buildGarageImageList = (
  garage: GarageImageSource | null | undefined,
  options: BuildGarageImageOptions = {}
): string[] => {
  if (!garage) return [];
  const list: string[] = [];
  const add = (raw: any, atStart = false) => {
    const uri = normalizeImageUri(raw, options);
    if (!uri || list.includes(uri)) return;
    if (atStart) list.unshift(uri);
    else list.push(uri);
  };

  if (Array.isArray(garage.images)) {
    garage.images.forEach((img: any) => add(img));
  }
  add(garage.coverImage, true);
  add(garage.logoUrl);

  return list;
};

/**
 * Removes any URL that has previously failed to load (reported via an Image onError handler or a failed prefetch),
 * so broken/unavailable photos never appear in thumbnails or the full-screen gallery.
 */
export const excludeBrokenImages = (images: string[], brokenUrls: Set<string> | string[]): string[] => {
  const broken = brokenUrls instanceof Set ? brokenUrls : new Set(brokenUrls);
  if (broken.size === 0) return images;
  return images.filter((uri) => !broken.has(uri));
};

/**
 * Keeps a selected gallery index within bounds of the current valid image list,
 * so navigation/index display stays correct after images are removed (e.g. on load failure).
 */
export const clampGalleryIndex = (index: number, length: number): number => {
  if (length <= 0) return 0;
  if (index < 0) return 0;
  if (index > length - 1) return length - 1;
  return index;
};

export interface GalleryViewState {
  index: number;
  total: number;
  currentUri: string | null;
  hasPrev: boolean;
  hasNext: boolean;
  /** "2 / 5" style label; "0 / 0" when empty */
  counterLabel: string;
}

/**
 * Derives everything the full-screen gallery renders from the valid image list and the selected index,
 * clamping at render time so there is never a frame pointing past the end of the list (a blank slide).
 */
export const getGalleryViewState = (images: string[], selectedIndex: number): GalleryViewState => {
  const total = images.length;
  const index = clampGalleryIndex(selectedIndex, total);
  return {
    index,
    total,
    currentUri: total > 0 ? images[index] : null,
    hasPrev: total > 0 && index > 0,
    hasNext: index < total - 1,
    counterLabel: total > 0 ? `${index + 1} / ${total}` : '0 / 0',
  };
};
