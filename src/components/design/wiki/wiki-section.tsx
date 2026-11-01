import { FileCode2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WIKI, type WikiCategory } from './wiki-content';

const ORDER: WikiCategory[] = ['design', 'frontend', 'backend', 'marketing'];

export function WikiTabs() {
  return (
    <Tabs defaultValue="design" className="w-full">
      <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
        {ORDER.map((key) => (
          <TabsTrigger key={key} value={key} className="min-h-11 flex-1 sm:flex-none">
            {WIKI[key].label}
          </TabsTrigger>
        ))}
      </TabsList>
      {ORDER.map((key) => (
        <TabsContent key={key} value={key} className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">{WIKI[key].intro}</p>
          <ul className="grid gap-3 md:grid-cols-2">
            {WIKI[key].entries.map((entry) => (
              <li key={entry.title} className="space-y-2 rounded-xl border bg-card p-4">
                <h3 className="text-sm font-semibold">{entry.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{entry.body}</p>
                <ul className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
                  {entry.refs.map((ref) => (
                    <li key={ref} className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                      <FileCode2 className="size-3" aria-hidden />
                      {ref}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </TabsContent>
      ))}
    </Tabs>
  );
}
