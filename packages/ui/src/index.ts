/**
 * @mch/ui — design system primitives.
 * Token-driven so the entire visual identity is restylable by overriding
 * `tokens.css` (cf. responsive-ui-architecture skill).
 */
export * from './lib/cn';
export { Button, buttonVariants, type ButtonProps } from './components/button';
export { Input, type InputProps } from './components/input';
export { Label } from './components/label';
export { Badge, badgeVariants, type BadgeProps } from './components/badge';
export { Skeleton } from './components/skeleton';
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from './components/card';
export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from './components/dialog';
export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetPortal,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from './components/sheet';
export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from './components/select';
export { Toaster, toast, type ToasterProps } from './components/toast';
export { Section, sectionVariants, type SectionProps } from './components/section';
export { Heading, type HeadingProps } from './components/heading';
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
