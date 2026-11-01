'use client';

import { useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Switch } from '@/components/ui/switch';
import { PropsPlayground, type PropValues } from '../primitives/props-playground';
import { PlatformFrame, TOUCH_TARGET, usePlatform } from '../primitives/platform';
import { DemoCard, StateMatrix } from '../primitives/doc';

export function ButtonDemo() {
  const { platform } = usePlatform();
  return (
    <div className="space-y-6">
      <PropsPlayground
        controls={[
          { key: 'variant', label: 'variant', kind: 'select', options: ['default', 'secondary', 'outline', 'ghost', 'destructive', 'link'], initial: 'default' },
          { key: 'size', label: 'size', kind: 'select', options: ['default', 'sm', 'lg', 'icon'], initial: 'default' },
          { key: 'disabled', label: 'disabled', kind: 'toggle', initial: false },
        ]}
        render={(v) => (
          <Button
            variant={v.variant as 'default'}
            size={v.size as 'default'}
            disabled={Boolean(v.disabled)}
            className={TOUCH_TARGET[platform]}
            aria-label={v.size === 'icon' ? 'Add entry' : undefined}
          >
            {v.size === 'icon' ? <Plus /> : 'Continue'}
          </Button>
        )}
        snippet={(v) =>
          `<Button variant="${v.variant}" size="${v.size}"${v.disabled ? ' disabled' : ''}>\n  ${v.size === 'icon' ? '<Plus />' : 'Continue'}\n</Button>`
        }
      />
      <PlatformFrame>
        <div className="flex flex-wrap gap-2">
          <Button className={TOUCH_TARGET[platform]}>Save entry</Button>
          <Button variant="outline" className={TOUCH_TARGET[platform]}>Cancel</Button>
        </div>
      </PlatformFrame>
    </div>
  );
}

export function ButtonStates() {
  return (
    <StateMatrix
      states={[
        { label: 'Default', node: <Button>Save</Button> },
        { label: 'Hover', node: <Button className="bg-primary/90">Save</Button>, note: 'Hover styles apply only with a fine pointer (see Patterns).' },
        { label: 'Focus-visible', node: <Button className="ring-1 ring-ring ring-offset-2 ring-offset-background">Save</Button> },
        { label: 'Disabled', node: <Button disabled>Save</Button> },
        {
          label: 'Loading',
          node: (
            <Button disabled aria-busy="true">
              <Loader2 className="animate-spin" aria-hidden />
              Saving
            </Button>
          ),
          note: 'Keep the label, disable the control, and announce progress via aria-busy.',
        },
        { label: 'Destructive', node: <Button variant="destructive">Delete</Button> },
      ]}
    />
  );
}

export function BadgeDemo() {
  return (
    <PropsPlayground
      controls={[{ key: 'variant', label: 'variant', kind: 'select', options: ['default', 'secondary', 'outline', 'destructive'], initial: 'default' }]}
      render={(v) => <Badge variant={v.variant as 'default'}>Journal</Badge>}
      snippet={(v) => `<Badge variant="${v.variant}">Journal</Badge>`}
    />
  );
}

export function SwitchDemo() {
  const { platform } = usePlatform();
  const [checked, setChecked] = useState(true);
  return (
    <PlatformFrame>
      <label className={`flex items-center justify-between gap-3 text-sm ${TOUCH_TARGET[platform]}`}>
        <span>Show nearby</span>
        <Switch checked={checked} onCheckedChange={setChecked} />
      </label>
    </PlatformFrame>
  );
}

export function InputDemo() {
  const [value, setValue] = useState('');
  return (
    <PropsPlayground
      controls={[
        { key: 'type', label: 'type', kind: 'select', options: ['text', 'email', 'number'], initial: 'text' },
        { key: 'invalid', label: 'invalid', kind: 'toggle', initial: false },
        { key: 'disabled', label: 'disabled', kind: 'toggle', initial: false },
      ]}
      render={(v: PropValues) => (
        <Input
          type={String(v.type)}
          aria-invalid={Boolean(v.invalid)}
          disabled={Boolean(v.disabled)}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Your name"
          className={`w-full max-w-xs ${v.invalid ? 'border-destructive' : ''} ${TOUCH_TARGET.web}`}
        />
      )}
      snippet={(v) =>
        `<Input type="${v.type}"${v.invalid ? ' aria-invalid' : ''}${v.disabled ? ' disabled' : ''} placeholder="Your name" />`
      }
    />
  );
}

export function ProgressDemo() {
  return (
    <PropsPlayground
      controls={[
        { key: 'value', label: 'value (%)', kind: 'select', options: ['0', '25', '50', '75', '100'], initial: '50' },
        { key: 'completed', label: 'completed', kind: 'toggle', initial: false },
      ]}
      render={(v) => (
        <div className="w-full max-w-xs">
          <ProgressBar value={Number(v.value)} completed={Boolean(v.completed)} />
        </div>
      )}
      snippet={(v) => `<ProgressBar value={${v.value}}${v.completed ? ' completed' : ''} />`}
    />
  );
}

export function AtomStates() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <DemoCard title="Input states">
        <div className="space-y-3">
          <Input placeholder="Default" className="text-base md:text-sm" />
          <Input placeholder="Focused: tab to it" className="ring-1 ring-ring" readOnly />
          <Input aria-invalid placeholder="Invalid" className="border-destructive" defaultValue="bad value" />
          <Input disabled placeholder="Disabled" />
        </div>
      </DemoCard>
      <DemoCard title="Switch states">
        <div className="space-y-3 text-sm">
          <label className="flex items-center justify-between"><span>Off</span><Switch /></label>
          <label className="flex items-center justify-between"><span>On</span><Switch defaultChecked /></label>
          <label className="flex items-center justify-between text-muted-foreground"><span>Disabled</span><Switch disabled /></label>
        </div>
      </DemoCard>
    </div>
  );
}
