/**
 * @mch/ui — design system primitives.
 * Token-driven so the entire visual identity is restylable by overriding
 * `tokens.css` (cf. responsive-ui-architecture skill).
 */
export * from './lib/cn';
export { Button, type ButtonProps } from './components/button';
export {
  HotelImage,
  buildCloudinarySrc,
  buildCloudinaryFetchSrc,
  isHttpUrl,
  type HotelImageProps,
  type HotelImageVariant,
} from './components/hotel-image';
export {
  SIGNATURE_TRANSFORM,
  SIGNATURE_LQIP,
  HERO_TRANSFORM,
  GALLERY_TRANSFORM,
  THUMBNAIL_TRANSFORM,
  CLOUDINARY_PRESETS,
  type CloudinaryPresetKey,
} from './cloudinary-presets';
