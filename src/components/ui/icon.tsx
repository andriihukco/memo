import { cn } from '@/lib/utils';

/**
 * Lucide → Material Symbols Rounded mapping table
 *
 * | Lucide               | Material Symbols         | Notes                        |
 * |----------------------|--------------------------|------------------------------|
 * | ScrollText           | home                     | Tab bar: Feed                |
 * | LayoutDashboard      | widgets                  | Tab bar: Widgets             |
 * | Network              | show_chart               | Tab bar: Graph               |
 * | FileText             | description              | Reports/Insights             |
 * | Settings             | settings                 | Settings button              |
 * | Plus                 | add                      | Add button                   |
 * | Trash2               | delete                   | Delete button                |
 * | ChevronDown          | expand_more              | Expand/collapse              |
 * | ChevronRight         | chevron_right            | Navigation arrow             |
 * | X                    | close                    | Close button                 |
 * | Check                | check                    | Checkmark                    |
 * | Lock                 | lock                     | Lock icon                    |
 * | LockOpen             | lock_open                | Unlock icon                  |
 * | MessageCircle        | chat_bubble              | Thread indicator             |
 * | Bot                  | smart_toy                | AI/bot indicator             |
 * | Brain                | neurology                | Brain metric                 |
 * | Lightbulb            | lightbulb                | Tab bar: Insights            |
 * | TrendingUp           | trending_up              | Trend up                     |
 * | TrendingDown         | trending_down            | Trend down                   |
 * | Minus                | remove                   | Neutral trend                |
 * | Calendar             | calendar_today           | Date picker                  |
 * | Tag                  | tag                      | Default category             |
 * | Flame                | local_fire_department    | Calories/energy              |
 * | Wallet               | account_balance_wallet   | Expenses                     |
 * | Dumbbell             | fitness_center           | Workout                      |
 * | Droplets             | water_drop               | Water/hydration              |
 * | Moon                 | bedtime                  | Sleep                        |
 * | BookOpen             | menu_book                | Books/reading                |
 * | Scale                | scale                    | Weight                       |
 * | Smile                | sentiment_satisfied      | Mood                         |
 * | Zap                  | bolt                     | Energy                       |
 * | Wind                 | air                      | Wind/breathing               |
 * | MapPin               | location_on              | Location/travel              |
 * | Utensils             | restaurant               | Food                         |
 * | Heart                | favorite                 | Health/heart                 |
 * | Activity             | monitor_heart            | Activity                     |
 * | Coffee               | coffee                   | Coffee                       |
 * | Leaf                 | eco                      | Nature/eco                   |
 * | Pill                 | medication               | Medication                   |
 * | Award                | emoji_events             | Award/achievement            |
 * | Star                 | star                     | Star/rating                  |
 * | Target               | my_location              | Target/goal                  |
 * | Clock                | schedule                 | Time                         |
 * | RectangleEllipsis    | password                 | Passcode                     |
 * | ClockFading          | timer                    | Lock timer                   |
 */

interface IconProps {
  name: string;
  size?: number;
  className?: string;
  'aria-label'?: string;
  filled?: boolean;
}

export function Icon({ name, size = 24, className, filled = false, ...props }: IconProps) {
  return (
    <span
      className={cn('material-symbols-rounded select-none', className)}
      style={{
        fontSize: size,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${size}`,
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      aria-hidden={!props['aria-label']}
      {...props}
    >
      {name}
    </span>
  );
}
