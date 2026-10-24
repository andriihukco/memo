import * as React from 'react';
import Link from 'next/link';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

export function ListGroup({ title, footer, children }: { title?: string; footer?: string; children: React.ReactNode }) {
  const rows = React.Children.toArray(children);
  return (
    <section className="space-y-1.5">
      {title && <h2 className="px-4 text-xs uppercase text-muted-foreground">{title}</h2>}
      <Card className="overflow-hidden">
        {rows.map((row, i) => (
          <React.Fragment key={React.isValidElement(row) && row.key != null ? row.key : i}>
            {i > 0 && <Separator className="ms-4 w-auto" />}
            {row}
          </React.Fragment>
        ))}
      </Card>
      {footer && <p className="px-4 text-xs text-muted-foreground">{footer}</p>}
    </section>
  );
}

interface ListRowBase {
  icon?: LucideIcon;
  label: string;
  description?: string;
  value?: string;
  /** Interactive controls (Switch, Button) are only valid when the row has neither href nor onClick. */
  trailing?: React.ReactNode;
  destructive?: boolean;
}
export type ListRowProps = ListRowBase &
  (
    | { href: string; onClick?: never }
    | { onClick: () => void; href?: never }
    | { href?: undefined; onClick?: undefined }
  );

export function ListRow({ icon: Icon, label, description, value, href, onClick, trailing, destructive }: ListRowProps) {
  const cls = cn(
    'flex min-h-11 w-full items-center gap-3 px-4 py-2 text-start text-sm',
    destructive && 'text-destructive',
  );
  const interactive = cn(cls, 'transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset');
  const body = (
    <>
      {Icon && <Icon className="size-5 shrink-0" aria-hidden />}
      <span className="min-w-0 flex-1">
        <span className="block truncate">{label}</span>
        {description && <span className="block text-xs text-muted-foreground">{description}</span>}
      </span>
      {value && <span className="shrink-0 text-muted-foreground">{value}</span>}
      {trailing}
      {href && !trailing && <ChevronRight data-chevron className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" aria-hidden />}
    </>
  );
  if (href) return <Link href={href} className={interactive}>{body}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={interactive}>{body}</button>;
  return <div className={cls}>{body}</div>;
}
