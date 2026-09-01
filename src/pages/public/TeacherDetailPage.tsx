import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { UserRound } from 'lucide-react';
import { api } from '@/services/api';
import { ApiError } from '@/services/api/types';
import { PublicDetailHeader } from '@/components/public/PublicDetailHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';

export default function TeacherDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['public', 'teacher', id],
    queryFn: () => api.public.getTeacher(id!),
    enabled: !!id,
  });

  const notFound = error instanceof ApiError && error.status === 404;

  return (
    <div className="min-h-dvh">
      <PublicDetailHeader backTo="/#teachers" backLabel="Преподаватели" />

      <main className="page-container max-w-3xl py-8">
        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="mx-auto h-24 w-24 rounded-full" />
            <Skeleton className="mx-auto h-8 w-48" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {error && !notFound && (
          <ErrorState message="Не удалось загрузить профиль" onRetry={() => refetch()} />
        )}

        {notFound && (
          <EmptyState
            icon={UserRound}
            title="Преподаватель не найден"
            description="Возможно, ссылка устарела или преподаватель больше не работает в школе"
            action={
              <Link to="/">
                <Button variant="secondary">На главную</Button>
              </Link>
            }
          />
        )}

        {data && (
          <>
            <div className="text-center">
              <Avatar
                src={data.avatarUrl}
                firstName={data.firstName}
                lastName={data.lastName}
                size="lg"
                className="mx-auto h-24 w-24 text-2xl"
              />
              <h1 className="mt-4 text-display">
                {data.firstName} {data.lastName}
              </h1>
              {data.bio && (
                <p className="mx-auto mt-4 max-w-xl text-body text-text-secondary">{data.bio}</p>
              )}
            </div>

            {data.directions.length > 0 && (
              <section className="mt-8">
                <h2 className="text-h2 text-center">Направления</h2>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {data.directions.map((direction) => (
                    <Link
                      key={direction.id}
                      to={`/directions/${direction.id}`}
                      className="focus-ring rounded-full"
                    >
                      <Badge variant="brand" className="px-4 py-2 text-sm">
                        {direction.icon ? `${direction.icon} ` : ''}
                        {direction.name}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <Card className="mt-10 text-center" padding="lg">
              <p className="text-body text-text-secondary">
                Выберите удобное время и запишитесь на занятие
              </p>
              <div className="mt-4 flex flex-col justify-center gap-3 sm:flex-row">
                <Link to="/register">
                  <Button className="w-full sm:w-auto">Записаться</Button>
                </Link>
                <Link to="/login">
                  <Button className="w-full sm:w-auto" variant="secondary">
                    Войти
                  </Button>
                </Link>
              </div>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
