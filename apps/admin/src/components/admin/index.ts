/** Barrel for back-of-house shell + shared admin component stubs. */
export { AppShell } from "./AppShell";
export { RoleGate } from "./RoleGate";
export {
  CalendarGrid,
  type CalendarGridProps,
  type CalendarEvent,
  type CalendarView,
} from "./CalendarGrid";
export {
  BookingDrawer,
  type BookingDrawerProps,
  type BookingDraft,
} from "./BookingDrawer";
export {
  CustomerTimeline,
  sortTimeline,
  type CustomerTimelineProps,
  type TimelineEntry,
} from "./CustomerTimeline";
export {
  DataTable,
  type DataTableProps,
  type DataTableColumn,
} from "./DataTable";
export { formatPence, parsePoundsToPence } from "./money";
export {
  ChartWrapper,
  type ChartWrapperProps,
  type ChartType,
  type ChartDatum,
} from "./ChartWrapper";
export { ImageUploader, type ImageUploaderProps } from "./ImageUploader";
