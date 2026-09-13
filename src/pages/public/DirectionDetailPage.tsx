import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Music2 } from 'lucide-react';
import { api } from '@/services/api';
import { ApiError } from '@/services/api/types';
import { PublicDetailHeader } from '@/components/public/PublicDetailHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';

export default function DirectionDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['public', 'direction', id],
    queryFn: () => api.public.getDirection(id!),
    enabled: !!id,
  });

  const notFound = error instanceof ApiError && error.status === 404;

  return (
    <div className="min-h-dvh">
      <PublicDetailHeader backTo="/#directions" backLabel="Направления" />

      <main className="page-container max-w-3xl py-8">
        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        )}

        {error && !notFound && (
          <ErrorState message="Не удалось загрузить направление" onRetry={() => refetch()} />
        )}

        {notFound && (
          <EmptyState
            icon={Music2}
            title="Направление не найдено"
            description="Возможно, оно было удалено или ссылка устарела"
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
              <span className="text-5xl" aria-hidden>
                {data.icon ?? '🎵'}
              </span>
              <h1 className="mt-4 text-display">{data.name}</h1>
              {data.description && (
                <p className="mx-auto mt-4 max-w-xl text-body text-text-secondary">{data.description}</p>
              )}
            </div>

            <section className="mt-10">
              <h2 className="text-h2">Преподаватели</h2>
              {data.teachers.length === 0 ? (
                <EmptyState
                  className="py-8"
                  title="Пока нет преподавателей"
                  description="Следите за обновлениями на главной странице"
                />
              ) : (
                <div className="mt-4 space-y-3">
                  {data.teachers.map((teacher) => (
                    <Link
                      key={teacher.id}
                      to={`/teachers/${teacher.id}`}
                      className="focus-ring block rounded-xl"
                    >
                      <Card className="transition-colors hover:border-brand/40">
                        <div className="flex gap-4">
                          <Avatar
                            src={teacher.avatarUrl}
                            firstName={teacher.firstName}
                            lastName={teacher.lastName}
                            size="lg"
                          />
                          <div className="min-w-0">
                            <h3 className="text-h3">
                              {teacher.firstName} {teacher.lastName}
                            </h3>
                            {teacher.bio && (
                              <p className="mt-1 line-clamp-2 text-body-sm text-text-secondary">
                                {teacher.bio}
                              </p>
                            )}
                          </div>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <Card className="mt-10 text-center" padding="lg">
              <p className="text-body text-text-secondary">
                Запишитесь на занятие после входа в приложение
              </p>
              <div className="mt-4 flex flex-col justify-center gap-3 sm:flex-row">
                <Link to="/login">
                  <Button className="w-full sm:w-auto">Войти</Button>
                </Link>
              </div>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
