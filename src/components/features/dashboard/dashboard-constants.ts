// Emoji library (10 categories × ~10 each)
export const EMOJI_LIBRARY = [
  // Health & Body
  '💪','🏃','🧘','🚴','🏋️','🤸','🧗','🏊','⚽','🎾',
  // Food & Drink
  '🍎','🥗','🍕','☕','🧃','🍷','🥤','🍜','🥑','🍳',
  // Mind & Mood
  '🧠','💭','😊','😴','🎯','⚡','🔥','💡','✨','🌟',
  // Nature
  '🌿','🌸','🌊','☀️','🌙','🍀','🌺','🦋','🌈','❄️',
  // Finance
  '💰','💳','📈','💸','🏦','🛒','🎁','💎','🪙','📊',
  // Work & Learning
  '💻','📚','✏️','🎓','🔬','📝','🗂️','🏆','🎨','🎵',
  // Travel & Places
  '✈️','🏠','🗺️','🚗','🚂','⛵','🏔️','🌍','🏖️','🗼',
  // People & Social
  '❤️','🤝','👶','🐾','👥','🙏','🎉','🥂','💌','🫂',
  // Tracking & Metrics
  '⏱️','📏','🔢','📉','🎲','🔐','🧪','⚗️','🔭','🧬',
  // Misc
  '⭐','🏅','🎖️','🔑','💫','🌀','🎭','🎪','🎬','🎤',
];

// Apple-inspired color palette (solid bg for icon circles)
export const ICON_COLORS = [
  { id: 'blue',    bg: 'bg-blue-500',    hex: '#3b82f6', text: 'text-white' },
  { id: 'indigo',  bg: 'bg-indigo-500',  hex: '#6366f1', text: 'text-white' },
  { id: 'violet',  bg: 'bg-violet-500',  hex: '#8b5cf6', text: 'text-white' },
  { id: 'purple',  bg: 'bg-purple-500',  hex: '#a855f7', text: 'text-white' },
  { id: 'pink',    bg: 'bg-pink-500',    hex: '#ec4899', text: 'text-white' },
  { id: 'rose',    bg: 'bg-rose-500',    hex: '#f43f5e', text: 'text-white' },
  { id: 'red',     bg: 'bg-red-500',     hex: '#ef4444', text: 'text-white' },
  { id: 'orange',  bg: 'bg-orange-500',  hex: '#f97316', text: 'text-white' },
  { id: 'amber',   bg: 'bg-amber-500',   hex: '#f59e0b', text: 'text-white' },
  { id: 'yellow',  bg: 'bg-yellow-400',  hex: '#facc15', text: 'text-gray-900' },
  { id: 'lime',    bg: 'bg-lime-500',    hex: '#84cc16', text: 'text-white' },
  { id: 'green',   bg: 'bg-green-500',   hex: '#22c55e', text: 'text-white' },
  { id: 'emerald', bg: 'bg-emerald-500', hex: '#10b981', text: 'text-white' },
  { id: 'teal',    bg: 'bg-teal-500',    hex: '#14b8a6', text: 'text-white' },
  { id: 'cyan',    bg: 'bg-cyan-500',    hex: '#06b6d4', text: 'text-white' },
  { id: 'sky',     bg: 'bg-sky-500',     hex: '#0ea5e9', text: 'text-white' },
  { id: 'slate',   bg: 'bg-slate-500',   hex: '#64748b', text: 'text-white' },
  { id: 'gray',    bg: 'bg-gray-600',    hex: '#4b5563', text: 'text-white' },
] as const;

// Emoji map for metric keys
export const METRIC_EMOJI: Record<string, string> = {
  kcal_intake:     '🔥',
  kcal_burned:     '💪',
  activity_kcal:   '💪',
  water_ml:        '💧',
  water_glasses:   '💧',
  sleep_hours:     '😴',
  sleep_quality:   '😴',
  steps_count:     '🏃',
  active_min:      '🏋️',
  distance_km:     '📍',
  distance_m:      '📍',
  weight_kg:       '⚖️',
  mood_score:      '😊',
  stress_level:    '😤',
  energy_level:    '⚡',
  pages_read:      '📚',
  reading_min:     '📚',
  protein_g:       '🥩',
  carbs_g:         '🍞',
  fat_g:           '🧈',
  meditation_min:  '🧘',
  mindfulness_min: '🧘',
  alcohol_units:   '🍷',
  cold_shower_min: '🚿',
  fasting_hours:   '⏱️',
  squats_count:    '🏋️',
  pushups_count:   '💪',
  expenses_day:    '💸',
};

// Lucide icon name → Material Symbols name mapping for metric icons
export const METRIC_ICON_MAP: Record<string, string> = {
  flame: 'local_fire_department',
  wallet: 'account_balance_wallet',
  dumbbell: 'fitness_center',
  lightbulb: 'lightbulb',
  brain: 'neurology',
  droplets: 'water_drop',
  moon: 'bedtime',
  'book-open': 'menu_book',
  scale: 'scale',
  smile: 'sentiment_satisfied',
  zap: 'bolt',
  wind: 'air',
  'map-pin': 'location_on',
  utensils: 'restaurant',
  heart: 'favorite',
  activity: 'monitor_heart',
  'trending-up': 'trending_up',
  'trending-down': 'trending_down',
  coffee: 'coffee',
  leaf: 'eco',
  pill: 'medication',
  award: 'emoji_events',
  star: 'star',
  target: 'my_location',
  clock: 'schedule',
  tag: 'tag',
};
