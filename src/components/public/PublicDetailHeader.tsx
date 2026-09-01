import { Link } from 'react-router-dom';
import { BackLink } from '@/components/ui/BackLink';
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
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
        <BackLink label={backLabel} fallbackTo={backTo} className="mb-0 min-h-0" />
        <Logo size="sm" />
        {user ? (
          <Link to="/home" className="text-sm text-brand hover:underline">
            В кабинет
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
