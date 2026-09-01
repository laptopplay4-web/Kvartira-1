import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { cn } from '@/utils';

interface MobileHeaderProps {
  className?: string;
  showNotifications?: boolean;
  notifBadge?: number;
}

export function MobileHeader({ className, showNotifications = true, notifBadge = 0 }: MobileHeaderProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex items-center justify-between border-b border-border-subtle bg-surface/95 px-4 py-3 backdrop-blur-md md:hidden',
        className,
      )}
    >
      <Link to="/home" className="focus-ring rounded-lg" aria-label="На главную">
        <Logo size="sm" />
      </Link>
      {showNotifications && (
        <Link
          to="/notifications"
          className="relative flex min-h-11 min-w-11 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-elevated hover:text-text-primary focus-ring"
          aria-label={notifBadge > 0 ? `Уведомления, ${notifBadge} непрочитанных` : 'Уведомления'}
        >
          <Bell className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          {notifBadge > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-brand-contrast">
              {notifBadge > 9 ? '9+' : notifBadge}
            </span>
          )}
        </Link>
      )}
    </header>
  );
}
