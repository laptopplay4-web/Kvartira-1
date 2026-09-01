import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { useCurrentUser } from '@/stores/authStore';

interface PublicDetailHeaderProps {
  backTo: string;
  backLabel: string;
}

export function PublicDetailHeader({ backTo, backLabel }: PublicDetailHeaderProps) {
  const user = useCurrentUser();

  return (
    <header className="border-b border-border-subtle px-4 py-4">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
        <Link
          to={backTo}
          className="focus-ring flex items-center gap-1 rounded text-sm text-text-secondary hover:text-brand"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {backLabel}
        </Link>
        <Link to="/" className="focus-ring rounded-lg" aria-label="На главную">
          <Logo size="sm" />
        </Link>
        {user ? (
          <Link to="/home" className="text-sm text-brand hover:underline">
            В приложение
          </Link>
        ) : (
          <Link to="/login" className="text-sm text-brand hover:underline">
            Войти
          </Link>
        )}
      </div>
    </header>
  );
}
