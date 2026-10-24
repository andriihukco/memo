import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

// Patterns hold no i18n: offering retry requires the caller's translated label.
type ErrorStateProps = { title: string; description: string } & (
  | { onRetry?: undefined; retryLabel?: never }
  | { onRetry: () => void; retryLabel: string }
);

export function ErrorState({ title, description, onRetry, retryLabel }: ErrorStateProps) {
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
