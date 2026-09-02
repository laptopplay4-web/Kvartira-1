import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

function getErrorDetails(error: unknown): { title: string; message: string; details: string } {
  if (isRouteErrorResponse(error)) {
    const dataMessage =
      typeof error.data === 'string'
        ? error.data
        : typeof error.data === 'object' &&
            error.data !== null &&
            'message' in error.data &&
            typeof error.data.message === 'string'
          ? error.data.message
          : '';

    return {
      title: `Ошибка ${error.status}`,
      message: dataMessage || error.statusText || 'Не удалось загрузить страницу',
      details: '',
    };
  }

  if (error instanceof Error) {
    return {
      title: 'Непредвиденная ошибка',
      message: error.message || 'Произошла ошибка приложения',
      details: error.stack ?? '',
    };
  }

  if (typeof error === 'string') {
    return { title: 'Непредвиденная ошибка', message: error, details: '' };
  }

  return {
    title: 'Непредвиденная ошибка',
    message: 'Произошла ошибка приложения',
    details: '',
  };
}

export function RouteErrorPage() {
  const error = useRouteError();
  const { title, message, details } = getErrorDetails(error);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div
        role="alert"
        className="app-error-panel w-full max-w-lg select-text rounded-xl border border-border-subtle bg-surface p-6 text-center"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-muted">
          <AlertCircle className="h-7 w-7 text-danger" aria-hidden />
        </div>
        <h1 className="text-h2">{title}</h1>
        <p className="mt-2 text-body-sm text-text-secondary">{message}</p>
        {details && (
          <pre className="mt-4 max-h-64 overflow-auto rounded-lg bg-surface-elevated p-4 text-left text-caption whitespace-pre-wrap break-words">
            {details}
          </pre>
        )}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button type="button" onClick={() => window.location.reload()}>
            Обновить
          </Button>
          <Link to="/home">
            <Button type="button" variant="secondary">
              На главную
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
