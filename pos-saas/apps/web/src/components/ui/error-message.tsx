import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface ErrorMessageProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorMessage({
  title = 'Algo salio mal',
  message,
  onRetry,
}: ErrorMessageProps) {
  return (
    <Card className="flex flex-col items-center justify-center p-8 text-center">
      <AlertTriangle className="mb-4 h-10 w-10 text-rose-400" />
      <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
      {message && <p className="mt-2 text-sm text-slate-400">{message}</p>}
      {onRetry && (
        <Button variant="outline" className="mt-4" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Reintentar
        </Button>
      )}
    </Card>
  );
}
