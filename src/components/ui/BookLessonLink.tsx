import { Link } from 'react-router-dom';
import type { ComponentProps } from 'react';
import { useOnlineStatus, OFFLINE_NETWORK_MESSAGE } from '@/hooks/useOnlineStatus';
import { Button } from './Button';

type BookLessonLinkProps = Omit<ComponentProps<typeof Button>, 'disabled' | 'onClick'> & {
  to?: string;
};

export function BookLessonLink({ to = '/lessons/book', children, ...props }: BookLessonLinkProps) {
  const isOnline = useOnlineStatus();

  if (!isOnline) {
    return (
      <Button {...props} disabled title={OFFLINE_NETWORK_MESSAGE} aria-disabled>
        {children}
      </Button>
    );
  }

  return (
    <Link to={to}>
      <Button {...props}>{children}</Button>
    </Link>
  );
}
