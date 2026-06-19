import {
  type LucideIcon,
  type LucideProps,
  Award,
  Calendar,
  CalendarCheck,
  CalendarDays,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  Flame,
  Heart,
  Image as ImageIcon,
  Camera,
  Mail,
  MapPin,
  Menu,
  Phone,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Tag as TagIcon,
  Ticket,
  X,
} from "lucide-react";

/**
 * Thin name → lucide mapping used by ported prototype markup that referenced
 * icons by string name. Prefer importing lucide icons directly in new code;
 * this exists for parity with the design source's <Icon name="..."/> calls.
 */
const REGISTRY = {
  award: Award,
  calendar: Calendar,
  "calendar-check": CalendarCheck,
  "calendar-days": CalendarDays,
  check: Check,
  "check-check": CheckCheck,
  "check-circle": CheckCircle2,
  "chevron-down": ChevronDown,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  clock: Clock,
  compass: Compass,
  flame: Flame,
  heart: Heart,
  image: ImageIcon,
  instagram: Camera,
  mail: Mail,
  "map-pin": MapPin,
  menu: Menu,
  phone: Phone,
  search: Search,
  "shield-check": ShieldCheck,
  sparkles: Sparkles,
  star: Star,
  tag: TagIcon,
  ticket: Ticket,
  x: X,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof REGISTRY;

export function Icon({
  name,
  className = "ic",
  ...rest
}: { name: IconName; className?: string } & LucideProps) {
  const Cmp = REGISTRY[name];
  return <Cmp className={className} {...rest} />;
}
