import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

// retryLabel is an addition to the brief's API: patterns hold no i18n, so callers pass a translated label.
export function ErrorState({ title, description, onRetry, retryLabel = 'Retry' }: {
  title: string; description: string; onRetry?: () => void; retryLabel?: string;
}) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="size-4" aria-hidden />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-3 min-h-11" onClick={onRetry}>{retryLabel}</Button>
      )}
    </Alert>
  );
}
