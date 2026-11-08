'use client';

import { DemoCard, DocSection, PropsTable } from './primitives/doc';
import { PlatformProvider, PlatformSwitch } from './primitives/platform';
import { Foundations } from './foundations/foundations';
import { AtomStates, BadgeDemo, ButtonDemo, ButtonStates, InputDemo, ProgressDemo, SwitchDemo } from './atoms/atom-demos';
import { CardDemo, ErrorStateDemo, EmptyStateDemo, ListRowDemo, MetricAndBadgeDemo, MoleculeStates } from './molecules/molecule-demos';
import { WikiTabs } from './wiki/wiki-section';

const TOC = [
  { id: 'foundations', label: 'Foundations' },
  { id: 'atoms', label: 'Atoms' },
  { id: 'molecules', label: 'Molecules' },
  { id: 'organisms', label: 'Organisms' },
  { id: 'platforms', label: 'Platform parity' },
  { id: 'references', label: 'References' },
  { id: 'wiki', label: 'Wiki' },
];

const BUTTON_PROPS = [
  { name: 'variant', type: "'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link'", default: "'default'", description: 'Visual style. Use destructive only for irreversible actions.' },
  { name: 'size', type: "'default' | 'sm' | 'lg' | 'icon'", default: "'default'", description: 'Height and padding. Use icon for icon-only buttons and pass aria-label.' },
  { name: 'asChild', type: 'boolean', default: 'false', description: 'Render the child element (for example a Next.js Link) with button styles.' },
  { name: 'disabled', type: 'boolean', default: 'false', description: 'Native disabled. Keeps the label and dims the control.' },
];

const ORGANISMS = [
  { name: 'ConfirmSheet', file: 'src/components/ui/confirm-sheet.tsx', status: 'Spec only', note: 'Needs an open trigger and a sheet overlay.' },
  { name: 'EditDrawer', file: 'src/components/ui/edit-drawer.tsx', status: 'Spec only', note: 'Vaul drawer with form fields.' },
  { name: 'BottomSheet', file: 'src/components/ui/bottom-sheet.tsx', status: 'Spec only', note: 'Generic sheet container.' },
  { name: 'PasscodeScreen', file: 'src/components/ui/passcode-screen.tsx', status: 'Spec only', note: 'Full-screen lock. Native equivalent: mobile/src/components/pin-pad.tsx.' },
  { name: 'PaywallModal', file: 'src/components/ui/paywall-modal.tsx', status: 'Spec only', note: 'Needs billing state. Native parity not checked yet.' },
  { name: 'UndoToast', file: 'src/components/ui/undo-toast.tsx', status: 'Spec only', note: 'Timed action with undo. Native parity not checked yet.' },
  { name: 'TodayContent', file: 'src/components/features/today/today-content.tsx', status: 'Live at /miniapp', note: 'Summary tiles with day-goal rings, quick log (water logs 250 ml with Undo), today\'s entries. Native: mobile/app/(tabs)/index.tsx. Data: src/lib/today.ts (mirrored).' },
];

const PARITY = [
  { rule: 'Minimum touch target', web: '44px (min-h-11)', ios: '44pt', android: '48dp' },
  { rule: 'Input font size (stops zoom on iOS)', web: '16px', ios: '16pt', android: '16sp' },
  { rule: 'Back navigation', web: 'Back control (shell/back.tsx)', ios: 'Edge swipe', android: 'System back' },
  { rule: 'Safe areas', web: 'env(safe-area-inset-*)', ios: 'Insets (react-native-safe-area-context)', android: 'Insets (edge-to-edge)' },
  { rule: 'Hover states', web: 'Only under (hover: hover)', ios: 'Pressed states', android: 'Ripple / pressed states' },
  { rule: 'Overlays', web: 'Dialog, Drawer, Popover', ios: 'Sheet (Expo Router modal)', android: 'Sheet / modal route' },
  { rule: 'Tabs', web: 'Today · Journal · Trends + compose (shell/tab-bar.tsx)', ios: 'Same three tabs + compose (glass-tab-bar.tsx)', android: 'Same tabs. Gap: tab and metric icons are SF Symbols, which Android does not draw (components/symbol.tsx has no fallback)' },
  { rule: 'Settings (You)', web: 'Header avatar on every tab', ios: 'Header avatar (TabHeader)', android: 'Header avatar (TabHeader)' },
  { rule: 'Trends segments', web: 'Charts, Goals, Reports, Graph', ios: 'Charts, Goals, Reports, Graph', android: 'Same. Gap (web): graph category chips use Ukrainian labels in every language' },
];

const REFS = [
  { src: '/design/refs/ref-1-react-native-switch.webp', alt: 'React Native docs: Switch component with example and props', caption: 'Ref 1. React Native Switch: controlled value, onValueChange, platform colors.' },
  { src: '/design/refs/ref-2-component-kit.webp', alt: 'Component kit: buttons, badges, toggle group, input, select and switch', caption: 'Ref 2. Component kit: button variants and sizes, badge, toggle, input and label, select, switch.' },
  { src: '/design/refs/ref-3-shadcn-dropdown.webp', alt: 'shadcn/ui Dropdown Menu documentation page', caption: 'Ref 3. shadcn/ui Dropdown Menu: Base UI, React Aria and Radix variants with a composition example.' },
];

export function DesignPage() {
  return (
    <PlatformProvider>
      <div className="mx-auto max-w-5xl space-y-10 px-4 pb-24 pt-8 md:px-8">
        <header className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Memo design system</p>
          <h1 className="text-3xl font-semibold tracking-tight">Design</h1>
          <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
            Foundations, components and states for web, Android and iOS. Every demo follows the platform you select. Props
            are live: change a control and the snippet updates.
          </p>
          <div className="sticky top-0 z-10 -mx-4 flex flex-wrap items-center gap-3 bg-background/90 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
            <PlatformSwitch />
            <nav aria-label="On this page" className="flex flex-wrap gap-1 text-sm">
              {TOC.map((item) => (
                <a key={item.id} href={`#${item.id}`} className="inline-flex min-h-11 items-center rounded-md px-3 text-muted-foreground hover:text-foreground">
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
        </header>

        <DocSection id="foundations" eyebrow="Foundations" title="Tokens, type and spacing" description="Colors are semantic tokens defined in src/app/globals.css. Dark mode redefines the same names.">
          <Foundations />
        </DocSection>

        <DocSection id="atoms" eyebrow="Atoms" title="Button, badge, switch, input, progress" description="Smallest reusable pieces in src/components/ui. Each demo has interactive props, a snippet and a state matrix.">
          <DemoCard title="Button: interactive props">
            <ButtonDemo />
          </DemoCard>
          <DemoCard title="Button: states">
            <ButtonStates />
          </DemoCard>
          <DemoCard title="Button: props reference">
            <PropsTable rows={BUTTON_PROPS} />
          </DemoCard>
          <DemoCard title="Badge: interactive props">
            <BadgeDemo />
          </DemoCard>
          <DemoCard title="Switch: platform touch target">
            <SwitchDemo />
          </DemoCard>
          <DemoCard title="Input: interactive props">
            <InputDemo />
          </DemoCard>
          <DemoCard title="Progress: interactive props">
            <ProgressDemo />
          </DemoCard>
          <DemoCard title="Input and switch states">
            <AtomStates />
          </DemoCard>
        </DocSection>

        <DocSection id="molecules" eyebrow="Molecules" title="List rows, feedback, empty and error states" description="Shared compositions in src/components/patterns. These are the pieces most screens reuse.">
          <DemoCard title="ListRow inside ListGroup (switch row is non-interactive; the row itself is a control)">
            <ListRowDemo />
          </DemoCard>
          <DemoCard title="ErrorState with retry">
            <ErrorStateDemo />
          </DemoCard>
          <DemoCard title="EmptyState with action">
            <EmptyStateDemo />
          </DemoCard>
          <div className="grid gap-4 md:grid-cols-2">
            <DemoCard title="Card">
              <CardDemo />
            </DemoCard>
            <DemoCard title="MetricPill and CategoryBadge">
              <MetricAndBadgeDemo />
            </DemoCard>
          </div>
          <DemoCard title="Molecule states">
            <MoleculeStates />
          </DemoCard>
        </DocSection>

        <DocSection id="organisms" eyebrow="Organisms" title="Sheets, drawers, lock and paywall" description="Larger overlay and screen-level components. Demos for these need an open trigger and app state, so they are documented here with their status.">
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[32rem] text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 text-start font-medium">Component</th>
                  <th scope="col" className="px-3 py-2 text-start font-medium">Status</th>
                  <th scope="col" className="px-3 py-2 text-start font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {ORGANISMS.map((o) => (
                  <tr key={o.name} className="border-t align-top">
                    <td className="px-3 py-2"><p className="font-mono text-xs">{o.name}</p><p className="font-mono text-xs text-muted-foreground">{o.file}</p></td>
                    <td className="px-3 py-2 text-muted-foreground">{o.status}</td>
                    <td className="px-3 py-2 text-muted-foreground">{o.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DocSection>

        <DocSection id="platforms" eyebrow="Patterns" title="Platform parity" description="Rules each screen must meet on all three platforms. The switch at the top changes the frames above; it does not run native code.">
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 text-start font-medium">Rule</th>
                  <th scope="col" className="px-3 py-2 text-start font-medium">Web</th>
                  <th scope="col" className="px-3 py-2 text-start font-medium">iOS</th>
                  <th scope="col" className="px-3 py-2 text-start font-medium">Android</th>
                </tr>
              </thead>
              <tbody>
                {PARITY.map((r) => (
                  <tr key={r.rule} className="border-t align-top">
                    <td className="px-3 py-2 font-medium">{r.rule}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.web}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.ios}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.android}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DocSection>

        <DocSection id="references" eyebrow="References" title="Reference images" description="Screenshots used as visual and API references for the Switch, the component kit and the dropdown menu.">
          <div className="grid gap-4 md:grid-cols-3">
            {REFS.map((ref) => (
              <figure key={ref.src} className="space-y-2 rounded-xl border bg-card p-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- static reference screenshots in /public */}
                <img src={ref.src} alt={ref.alt} className="w-full rounded-md border" loading="lazy" />
                <figcaption className="text-xs text-muted-foreground">{ref.caption}</figcaption>
              </figure>
            ))}
          </div>
        </DocSection>

        <DocSection id="wiki" eyebrow="Wiki" title="Design, frontend, backend, marketing" description="Short reference entries. Each one names the source file or doc to read before changing the area.">
          <WikiTabs />
        </DocSection>
      </div>
    </PlatformProvider>
  );
}
