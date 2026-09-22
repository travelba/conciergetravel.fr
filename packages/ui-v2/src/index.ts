/**
 * @mch/ui-v2 — Booking-like design system for MyConciergeHotel.com v2.
 * Token-driven; restyle by overriding `tokens.css`.
 */
export * from './lib/cn';
export {
  scaleRatingToTen,
  resolveRatingLabel,
  formatRatingScore,
  type RatingLabel,
} from './lib/rating-label';
export {
  buildPriceSlotView,
  formatPriceMinor,
  type BuildConciergePriceSlotInput,
  type BuildLivePriceSlotInput,
  type BuildPriceSlotInput,
  type PriceComparatorRow,
  type PriceSlotConciergeView,
  type PriceSlotLiveView,
  type PriceSlotError,
  type PriceSlotMode,
  type PriceSlotView,
  type Result,
} from './price-slot.logic';

export { Button, buttonVariants, type ButtonProps } from './components/button';
export { Input, type InputProps } from './components/input';
export { Badge, badgeVariants, type BadgeProps } from './components/badge';
export { RatingBadge, ratingBadgeVariants, type RatingBadgeProps } from './components/rating-badge';
export { SearchBar, type SearchBarProps, type SearchBarSegment } from './components/search-bar';
export { HotelCard, type HotelCardProps } from './components/hotel-card';
export {
  FilterSidebar,
  FILTER_GROUP_ORDER,
  type FilterGroup,
  type FilterGroupId,
  type FilterOption,
  type FilterSidebarProps,
} from './components/filter-sidebar';
export {
  PhotoMosaic,
  type PhotoMosaicItem,
  type PhotoMosaicProps,
} from './components/photo-mosaic';
export { PriceSlot, type PriceSlotProps } from './components/price-slot';
export { StickyBookingBox, type StickyBookingBoxProps } from './components/sticky-booking-box';
export { RoomTable, type RoomTableProps, type RoomTableRow } from './components/room-table';
export {
  HeaderV2,
  type HeaderTab,
  type HeaderUtilityLink,
  type HeaderV2Props,
} from './components/header-v2';
export {
  FooterV2,
  type FooterColumn,
  type FooterLink,
  type FooterV2Props,
} from './components/footer-v2';
