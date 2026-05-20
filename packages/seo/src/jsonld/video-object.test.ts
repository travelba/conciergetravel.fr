import { describe, expect, it } from 'vitest';

import { videoObjectJsonLd } from './video-object';

describe('videoObjectJsonLd', () => {
  it('emits a valid VideoObject with required fields', () => {
    const node = videoObjectJsonLd({
      name: 'Visite immersive — Le Bristol',
      description: 'Visite vidéo immersive du Bristol Paris.',
      thumbnailUrl: 'https://example.com/poster.jpg',
      uploadDate: '2026-05-20',
      contentUrl: 'https://example.com/hero.mp4',
      duration: 'PT45S',
      width: 1920,
      height: 1080,
    });
    expect(node).not.toBeNull();
    expect(node).toMatchObject({
      '@type': 'VideoObject',
      name: 'Visite immersive — Le Bristol',
      thumbnailUrl: 'https://example.com/poster.jpg',
      uploadDate: '2026-05-20',
      contentUrl: 'https://example.com/hero.mp4',
      duration: 'PT45S',
      width: 1920,
      height: 1080,
    });
  });

  it('returns null when neither contentUrl nor embedUrl is provided', () => {
    const node = videoObjectJsonLd({
      name: 'V',
      description: 'D',
      thumbnailUrl: 'https://example.com/poster.jpg',
      uploadDate: '2026-05-20',
    });
    expect(node).toBeNull();
  });

  it('returns null on malformed uploadDate', () => {
    const node = videoObjectJsonLd({
      name: 'V',
      description: 'D',
      thumbnailUrl: 'https://example.com/poster.jpg',
      uploadDate: 'pas-une-date',
      contentUrl: 'https://example.com/hero.mp4',
    });
    expect(node).toBeNull();
  });

  it('rejects non-HTTPS URLs', () => {
    const node = videoObjectJsonLd({
      name: 'V',
      description: 'D',
      thumbnailUrl: 'http://example.com/poster.jpg',
      uploadDate: '2026-05-20',
      contentUrl: 'https://example.com/hero.mp4',
    });
    expect(node).toBeNull();
  });

  it('accepts thumbnailUrl as array', () => {
    const node = videoObjectJsonLd({
      name: 'V',
      description: 'D',
      thumbnailUrl: ['https://example.com/poster1.jpg', 'https://example.com/poster2.jpg'],
      uploadDate: '2026-05-20',
      embedUrl: 'https://player.cloudinary.com/embed/abc',
    });
    expect(node).not.toBeNull();
    expect(node?.thumbnailUrl).toHaveLength(2);
    expect(node?.embedUrl).toBe('https://player.cloudinary.com/embed/abc');
  });
});
