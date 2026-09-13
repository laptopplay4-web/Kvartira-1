import { Link, NavLink } from 'react-router-dom';
import { Bell, BookOpen } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { SchoolAboutButton } from '@/components/school/SchoolAboutButton';
import { cn } from '@/utils';

const headerNavLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'relative flex min-h-11 min-w-11 items-center justify-center rounded-lg transition-colors focus-ring',
    isActive
      ? 'bg-brand-muted font-medium text-brand'
      : 'text-text-secondary hover:bg-surface-elevated hover:text-text-primary',
  );

interface MobileHeaderProps {
  className?: string;
  showAssignments?: boolean;
  assignmentsBadge?: number;
  showNotifications?: boolean;
  notifBadge?: number;
}

export function MobileHeader({
  className,
  showAssignments = false,
  assignmentsBadge = 0,
  showNotifications = true,
  notifBadge = 0,
}: MobileHeaderProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex items-center justify-between border-b border-border-subtle bg-surface/95 px-4 py-3 backdrop-blur-md md:justify-end md:border-b-0 md:bg-transparent md:px-6 md:py-2',
        className,
      )}
    >
      <div className="flex items-center gap-1 md:hidden">
        <Link to="/home" className="focus-ring rounded-lg" aria-label="На главную">
          <Logo size="sm" />
        </Link>
        <SchoolAboutButton />
      </div>
      <div className="flex items-center gap-1">
        {showAssignments && (
          <NavLink
            to="/assignments"
            className={headerNavLinkClass}
            aria-label={
              assignmentsBadge > 0
                ? `Домашние задания, ${assignmentsBadge} непрочитанных`
                : 'Домашние задания'
            }
          >
            <BookOpen className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            {assignmentsBadge > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-brand-contrast">
                {assignmentsBadge > 9 ? '9+' : assignmentsBadge}
              </span>
            )}
          </NavLink>
        )}
        {showNotifications && (
          <NavLink
            to="/notifications"
            end
            className={headerNavLinkClass}
            aria-label={notifBadge > 0 ? `Уведомления, ${notifBadge} непрочитанных` : 'Уведомления'}
          >
            <Bell className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            {notifBadge > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-brand-contrast">
                {notifBadge > 9 ? '9+' : notifBadge}
              </span>
            )}
          </NavLink>
        )}
      </div>
    </header>
  );
}
