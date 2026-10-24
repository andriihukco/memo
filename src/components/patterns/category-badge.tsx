import { Badge } from '@/components/ui/badge';
import { categoryStyle } from '@/lib/categories';

export function CategoryBadge({ name, label }: { name: string; label: string }) {
  return (
    <Badge variant="outline" style={categoryStyle(name)} className="gap-1.5 border-transparent bg-[hsl(var(--cat)/0.12)] font-medium text-foreground">
      <span className="size-2 rounded-full bg-[hsl(var(--cat))]" aria-hidden />
      {label}
    </Badge>
  );
}
