import React from 'react';
import {
  Activity, Anchor, ArrowLeft, Award, BookOpen, Bot, Brain, Briefcase, Calendar, CalendarDays,
  CalendarRange, Camera, Car, Check, CheckCircle, ChevronRight, Clock, Cloud, Code, Coffee, Compass,
  Delete, Dumbbell, Download, Droplets, Eye, Flame, Globe, Headphones, Heart, History, Home, Info,
  Infinity as InfinityIcon, Layers, LayoutDashboard, Leaf, Lightbulb, Loader2, Lock, LockOpen, LucideIcon,
  Mic, Menu, Megaphone, Merge, MapPin, Music, Network, Pencil, Palette, PawPrint, Pill, Plus, RectangleEllipsis,
  Scale, ScrollText, Send, Share2, ShoppingBag, SlidersHorizontal, Smile, Sparkles, Star, Sun, Tag, Target,
  Timer, Trash2, TrendingDown, TrendingUp, TriangleAlert, Users, Utensils, Volume2, VolumeX, Wallet, Wind,
  Wheat, X, Zap, Baby, Gamepad2, Plane, ExternalLink, Headset, ArrowRightToLine, Moon, Beef,
  CircleAlert, CalendarClock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/** Material Symbols name → lucide icon. Unknown names fall back to Tag. */
const ICONS: Record<string, LucideIcon> = {
  add: Plus, arrow_back: ArrowLeft, auto_stories: BookOpen, backspace: Delete, calendar_today: Calendar,
  campaign: Megaphone, check: Check, check_circle: CheckCircle, chevron_right: ChevronRight, close: X,
  delete: Trash2, delete_forever: Trash2, download: Download, edit: Pencil, error: CircleAlert, info: Info,
  lightbulb: Lightbulb, wb_incandescent: Lightbulb, lock: Lock, lock_open: LockOpen, merge: Merge,
  monitor_heart: Activity, open_in_new: ExternalLink, password: RectangleEllipsis, progress_activity: Loader2,
  send: Send, share: Share2, smart_toy: Bot, support_agent: Headset, tag: Tag, timer: Timer, warning: TriangleAlert,
  contract: ScrollText, dashboard: LayoutDashboard, hub: Network, menu: Menu, today: Calendar, history: History,
  date_range: CalendarRange, calendar_month: CalendarDays, event_note: CalendarClock, start: ArrowRightToLine,
  all_inclusive: InfinityIcon, tune: SlidersHorizontal, volume_up: Volume2, volume_off: VolumeX,
  local_fire_department: Flame, account_balance_wallet: Wallet, fitness_center: Dumbbell, neurology: Brain,
  water_drop: Droplets, bedtime: Moon, menu_book: BookOpen, scale: Scale, sentiment_satisfied: Smile, bolt: Zap,
  air: Wind, location_on: MapPin, restaurant: Utensils, favorite: Heart, trending_up: TrendingUp,
  trending_down: TrendingDown, coffee: Coffee, eco: Leaf, medication: Pill, emoji_events: Award, star: Star,
  my_location: Target, schedule: Clock, photo_camera: Camera, wb_sunny: Sun, cloud: Cloud, home: Home,
  directions_car: Car, flight: Plane, shopping_bag: ShoppingBag, child_care: Baby, pets: PawPrint,
  sports_esports: Gamepad2, code: Code, palette: Palette, mic: Mic, headphones: Headphones, language: Globe,
  layers: Layers, visibility: Eye, anchor: Anchor, explore: Compass,
  // names used directly as METRIC/category keys
  beef: Beef, brain: Brain, briefcase: Briefcase, droplets: Droplets, dumbbell: Dumbbell, flame: Flame,
  heart: Heart, moon: Moon, music: Music, sparkles: Sparkles, target: Target, users: Users, utensils: Utensils,
  wallet: Wallet, wheat: Wheat,
};

interface IconProps {
  name: string;
  size?: number;
  className?: string;
  /** Accessible name. When provided, the icon is announced by screen readers. */
  'aria-label'?: string;
  /** ARIA role override. Defaults to 'img' when aria-label is present. */
  role?: string;
  filled?: boolean;
  style?: React.CSSProperties;
}

export function Icon({ name, size = 24, className, style, ...props }: IconProps) {
  const hasLabel = Boolean(props['aria-label']);
  const Glyph = ICONS[name] ?? Tag;
  return (
    <Glyph
      size={size}
      className={cn('shrink-0 select-none', className)}
      style={style}
      // When an aria-label is supplied, expose as img; otherwise hide from screen readers entirely
      role={props.role ?? (hasLabel ? 'img' : undefined)}
      aria-hidden={!hasLabel}
      aria-label={props['aria-label']}
    />
  );
}
