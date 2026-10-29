import {
  buildGarageImageList,
  excludeBrokenImages,
  clampGalleryIndex,
  normalizeImageUri,
  getGalleryViewState,
} from '../galleryUtils';

describe('buildGarageImageList', () => {
  it('returns an empty list (no stock placeholder) when garage has no images at all', () => {
    expect(buildGarageImageList({ images: [] })).toEqual([]);
    expect(buildGarageImageList({})).toEqual([]);
  });

  it('returns an empty list when every image URL is empty or invalid', () => {
    const garage = {
      images: ['', '   ', null, 'null', 'undefined', 'not a url', 'ftp://example.com/a.jpg'],
      coverImage: '',
      logoUrl: '   ',
    };
    expect(buildGarageImageList(garage)).toEqual([]);
  });

  it('keeps only the valid URLs from a mixed valid/invalid list', () => {
    const garage = {
      images: ['https://example.com/a.jpg', '', 'garbage', null, 'https://example.com/b.jpg'],
      logoUrl: 'undefined',
    };
    expect(buildGarageImageList(garage)).toEqual(['https://example.com/a.jpg', 'https://example.com/b.jpg']);
  });

  it('resolves server-relative upload paths against the API origin', () => {
    const garage = { images: ['/uploads/bay.jpg', 'https://example.com/a.jpg'] };
    expect(buildGarageImageList(garage, { baseOrigin: 'https://api.example.com/' })).toEqual([
      'https://api.example.com/uploads/bay.jpg',
      'https://example.com/a.jpg',
    ]);
    // Without an origin a relative path cannot load, so it is dropped rather than shown blank
    expect(buildGarageImageList(garage)).toEqual(['https://example.com/a.jpg']);
  });

  it('filters out empty, blank and non-string entries from garage.images', () => {
    const garage = {
      images: ['', '   ', null, undefined, 42, 'https://example.com/a.jpg'],
    };
    expect(buildGarageImageList(garage)).toEqual(['https://example.com/a.jpg']);
  });

  it('de-duplicates repeated URLs across images, coverImage and logoUrl', () => {
    const garage = {
      images: ['https://example.com/a.jpg', 'https://example.com/a.jpg'],
      coverImage: 'https://example.com/a.jpg',
      logoUrl: 'https://example.com/a.jpg',
    };
    expect(buildGarageImageList(garage)).toEqual(['https://example.com/a.jpg']);
  });

  it('places coverImage first and logoUrl last when distinct', () => {
    const garage = {
      images: ['https://example.com/mid.jpg'],
      coverImage: 'https://example.com/cover.jpg',
      logoUrl: 'https://example.com/logo.jpg',
    };
    expect(buildGarageImageList(garage)).toEqual([
      'https://example.com/cover.jpg',
      'https://example.com/mid.jpg',
      'https://example.com/logo.jpg',
    ]);
  });

  it('returns an empty array when garage itself is null/undefined', () => {
    expect(buildGarageImageList(null)).toEqual([]);
    expect(buildGarageImageList(undefined)).toEqual([]);
  });
});

describe('excludeBrokenImages', () => {
  it('returns the original list unchanged when nothing is broken', () => {
    const images = ['https://example.com/a.jpg', 'https://example.com/b.jpg'];
    expect(excludeBrokenImages(images, new Set())).toEqual(images);
  });

  it('removes a single broken URL from a mixed valid/invalid list', () => {
    const images = ['https://example.com/a.jpg', 'https://example.com/broken.jpg', 'https://example.com/b.jpg'];
    const broken = new Set(['https://example.com/broken.jpg']);
    expect(excludeBrokenImages(images, broken)).toEqual([
      'https://example.com/a.jpg',
      'https://example.com/b.jpg',
    ]);
  });

  it('returns an empty array when every image has failed to load', () => {
    const images = ['https://example.com/a.jpg', 'https://example.com/b.jpg'];
    const broken = new Set(images);
    expect(excludeBrokenImages(images, broken)).toEqual([]);
  });

  it('accepts a plain array of broken urls in addition to a Set', () => {
    const images = ['https://example.com/a.jpg', 'https://example.com/b.jpg'];
    expect(excludeBrokenImages(images, ['https://example.com/a.jpg'])).toEqual([
      'https://example.com/b.jpg',
    ]);
  });
});

describe('clampGalleryIndex', () => {
  it('keeps an in-range index unchanged', () => {
    expect(clampGalleryIndex(1, 3)).toBe(1);
  });

  it('clamps an index that is now out of bounds down to the last valid index', () => {
    expect(clampGalleryIndex(2, 1)).toBe(0);
  });

  it('returns 0 when the valid image list becomes empty', () => {
    expect(clampGalleryIndex(2, 0)).toBe(0);
  });

  it('never returns a negative index', () => {
    expect(clampGalleryIndex(-1, 5)).toBe(0);
  });
});

describe('normalizeImageUri', () => {
  it('rejects non-strings, blanks and stringified empties', () => {
    [undefined, null, 0, {}, '', '   ', 'null', 'undefined'].forEach((raw) => {
      expect(normalizeImageUri(raw)).toBeNull();
    });
  });

  it('rejects malformed or unsupported URLs', () => {
    ['example.com/a.jpg', 'https://', 'http:// spaced.com/a.jpg', 'ftp://example.com/a.jpg', 'about:blank'].forEach(
      (raw) => expect(normalizeImageUri(raw)).toBeNull()
    );
  });

  it('accepts and trims loadable URIs', () => {
    expect(normalizeImageUri('  https://example.com/a.jpg  ')).toBe('https://example.com/a.jpg');
    expect(normalizeImageUri('http://example.com/a.jpg')).toBe('http://example.com/a.jpg');
    expect(normalizeImageUri('file:///data/a.jpg')).toBe('file:///data/a.jpg');
    expect(normalizeImageUri('data:image/png;base64,iVBORw0KGgo=')).toBe('data:image/png;base64,iVBORw0KGgo=');
  });

  it('upgrades protocol-relative URLs to https', () => {
    expect(normalizeImageUri('//cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg');
  });
});

describe('getGalleryViewState', () => {
  const images = ['https://example.com/a.jpg', 'https://example.com/b.jpg', 'https://example.com/c.jpg'];

  it('describes the first photo with only a next arrow', () => {
    expect(getGalleryViewState(images, 0)).toEqual({
      index: 0,
      total: 3,
      currentUri: images[0],
      hasPrev: false,
      hasNext: true,
      counterLabel: '1 / 3',
    });
  });

  it('describes a middle photo with both arrows', () => {
    const state = getGalleryViewState(images, 1);
    expect(state.hasPrev && state.hasNext).toBe(true);
    expect(state.counterLabel).toBe('2 / 3');
  });

  it('describes the last photo with only a previous arrow', () => {
    const state = getGalleryViewState(images, 2);
    expect(state).toMatchObject({ hasPrev: true, hasNext: false, counterLabel: '3 / 3' });
  });

  it('returns an empty state (no current photo, 0 / 0, no arrows) when there are no photos', () => {
    expect(getGalleryViewState([], 4)).toEqual({
      index: 0,
      total: 0,
      currentUri: null,
      hasPrev: false,
      hasNext: false,
      counterLabel: '0 / 0',
    });
  });
});

describe('gallery flow with broken images', () => {
  const garage = {
    coverImage: 'https://example.com/cover.jpg',
    images: ['https://example.com/a.jpg', 'https://example.com/broken.jpg', '', 'https://example.com/b.jpg'],
  };

  it('drops a broken photo from the list and keeps count/indexes in sync', () => {
    const all = buildGarageImageList(garage);
    expect(all).toHaveLength(4);

    const valid = excludeBrokenImages(all, new Set(['https://example.com/broken.jpg']));
    expect(valid).toEqual(['https://example.com/cover.jpg', 'https://example.com/a.jpg', 'https://example.com/b.jpg']);

    // Navigating from a.jpg goes straight to b.jpg - no blank slide in between
    const atA = getGalleryViewState(valid, 1);
    expect(atA.counterLabel).toBe('2 / 3');
    expect(getGalleryViewState(valid, atA.index + 1).currentUri).toBe('https://example.com/b.jpg');
  });

  it('moves to the previous valid photo when the currently viewed last photo fails', () => {
    const all = buildGarageImageList(garage);
    const valid = excludeBrokenImages(all, new Set(['https://example.com/broken.jpg', 'https://example.com/b.jpg']));
    // User was on index 3 (b.jpg) before it failed
    const state = getGalleryViewState(valid, 3);
    expect(state).toMatchObject({ index: 1, total: 2, currentUri: 'https://example.com/a.jpg', hasNext: false, counterLabel: '2 / 2' });
  });

  it('falls back to the empty state when every photo fails to load', () => {
    const all = buildGarageImageList(garage);
    const valid = excludeBrokenImages(all, new Set(all));
    expect(valid).toEqual([]);
    expect(getGalleryViewState(valid, 2)).toMatchObject({ currentUri: null, total: 0, counterLabel: '0 / 0' });
  });
});
