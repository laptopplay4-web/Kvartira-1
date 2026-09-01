import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@/stores/authStore';
import { api } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { PublicLandingContent } from '@/components/public/PublicLandingContent';

function LandingSkeleton() {
  return (
    <div className="min-h-dvh px-6 py-6">
      <Skeleton className="h-10 w-32" />
      <div className="mx-auto mt-20 max-w-xl space-y-4 text-center">
        <Skeleton className="mx-auto h-24 w-24 rounded-full" />
        <Skeleton className="mx-auto h-8 w-48" />
        <Skeleton className="mx-auto h-12 w-full max-w-md" />
        <Skeleton className="mx-auto h-20 w-full max-w-lg" />
      </div>
      <div className="mx-auto mt-16 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-36" />
        ))}
      </div>
    </div>
  );
}

export default function LandingPage() {
  const user = useCurrentUser();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['public', 'landing'],
    queryFn: () => api.public.getLandingData(),
    enabled: !user,
  });

  if (user) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
        <p className="text-body text-text-secondary">Вы уже вошли</p>
        <Link to="/home">
          <Button className="mt-4">Перейти в приложение</Button>
        </Link>
      </div>
    );
  }

  if (isLoading) return <LandingSkeleton />;

  if (error || !data) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4">
        <ErrorState onRetry={() => refetch()} />
      </div>
    );
  }

  return <PublicLandingContent data={data} />;
}
