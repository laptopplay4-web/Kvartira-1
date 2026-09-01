import { Link } from 'react-router-dom';
import { Clock, Mail, MapPin, Phone } from 'lucide-react';
import type { PublicLandingData } from '@/types';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { formatFullDate } from '@/utils/dates';
import { PUBLIC_EVENT_TYPE_LABELS } from '@/services/public/constants';

interface PublicLandingContentProps {
  data: PublicLandingData;
}

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-8 text-center">
      <h2 className="text-h1">{title}</h2>
      {subtitle && <p className="mt-2 text-body text-text-secondary">{subtitle}</p>}
    </div>
  );
}

export function PublicLandingContent({ data }: PublicLandingContentProps) {
  const { school, directions, teachers, events, news } = data;

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-1/4 top-0 h-96 w-96 rounded-full bg-brand/10 blur-3xl" />
        <div className="absolute -right-1/4 bottom-1/3 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-6 py-6 lg:px-10">
        <Link to="/" className="focus-ring rounded-lg" aria-label={`${school.name} — на главную`}>
          <Logo size="md" />
        </Link>
        <div className="flex items-center gap-2">
          <Link
            to="/login"
            className="focus-ring rounded-lg px-3 py-2 text-sm font-medium text-text-secondary hover:text-brand"
          >
            Войти
          </Link>
          <Link to="/register" className="hidden sm:block">
            <Button size="sm" variant="secondary">
              Регистрация
            </Button>
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex-1">
        <section className="px-6 pb-16 pt-4 text-center lg:px-10">
          <Logo size="xl" className="mx-auto mb-6" />
          <p className="mb-4 text-sm font-medium uppercase tracking-widest text-brand">{school.tagline}</p>
          <h1 className="text-display mx-auto max-w-3xl">
            Музыка начинается
            <span className="block text-brand">в «{school.name}»</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-body text-text-secondary">{school.about}</p>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/register">
              <Button size="lg">Начать обучение</Button>
            </Link>
            <a href="#directions">
              <Button size="lg" variant="secondary">
                Направления
              </Button>
            </a>
          </div>
        </section>

        <section id="directions" className="border-t border-border-subtle px-6 py-16 lg:px-10">
          <SectionHeading title="Направления" subtitle="Выберите инструмент или вокал" />
          <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {directions.map((direction) => (
              <Link
                key={direction.id}
                to={`/directions/${direction.id}`}
                className="focus-ring block rounded-xl"
              >
                <Card className="h-full text-center transition-colors hover:border-brand/40">
                  <span className="text-3xl" aria-hidden>
                    {direction.icon ?? '🎵'}
                  </span>
                  <h3 className="mt-3 text-h2">{direction.name}</h3>
                  {direction.description && (
                    <p className="mt-2 text-body-sm text-text-secondary">{direction.description}</p>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        </section>

        <section id="teachers" className="border-t border-border-subtle px-6 py-16 lg:px-10">
          <SectionHeading title="Преподаватели" subtitle="Опытные педагоги школы" />
          <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2">
            {teachers.map((teacher) => (
              <Link
                key={teacher.id}
                to={`/teachers/${teacher.id}`}
                className="focus-ring block rounded-xl"
              >
                <Card className="h-full transition-colors hover:border-brand/40">
                  <div className="flex gap-4">
                    <Avatar
                      src={teacher.avatarUrl}
                      firstName={teacher.firstName}
                      lastName={teacher.lastName}
                      size="lg"
                    />
                    <div className="min-w-0">
                      <h3 className="text-h2">
                        {teacher.firstName} {teacher.lastName}
                      </h3>
                      {teacher.bio && (
                        <p className="mt-1 line-clamp-2 text-body-sm text-text-secondary">{teacher.bio}</p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {teacher.directions.map((d) => (
                          <Badge key={d.id} variant="default">
                            {d.icon ? `${d.icon} ` : ''}
                            {d.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        <section id="events" className="border-t border-border-subtle px-6 py-16 lg:px-10">
          <SectionHeading title="Мероприятия" subtitle="Концерты, мастер-классы и конкурсы" />
          <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-3">
            {events.map((event) => (
              <Card key={event.id} className="flex flex-col">
                <Badge variant="brand">{PUBLIC_EVENT_TYPE_LABELS[event.type]}</Badge>
                <h3 className="mt-2 text-h2">{event.title}</h3>
                <p className="mt-2 line-clamp-3 flex-1 text-body-sm text-text-secondary">{event.description}</p>
                <div className="mt-4 space-y-1 text-caption text-text-muted">
                  <p className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {formatFullDate(event.date)} · {event.startTime}
                  </p>
                  <p className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {event.location}
                  </p>
                </div>
                {event.spotsLeft != null && (
                  <p className="mt-2 text-caption text-text-secondary">
                    Свободно мест: {event.spotsLeft}
                  </p>
                )}
              </Card>
            ))}
          </div>
          <p className="mx-auto mt-8 max-w-lg text-center text-body-sm text-text-secondary">
            Запись на мероприятия доступна после{' '}
            <Link to="/login" className="font-medium text-brand hover:underline">
              входа
            </Link>{' '}
            в приложение.
          </p>
        </section>

        {news.length > 0 && (
          <section id="news" className="border-t border-border-subtle px-6 py-16 lg:px-10">
            <SectionHeading title="Новости" subtitle="Анонсы и обновления школы" />
            <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2">
              {news.map((item) => (
                <Card key={item.id}>
                  <p className="text-caption text-text-muted">{formatFullDate(item.publishedAt)}</p>
                  <h3 className="mt-2 text-h2">{item.title}</h3>
                  <p className="mt-2 text-body-sm text-text-secondary">{item.excerpt}</p>
                </Card>
              ))}
            </div>
          </section>
        )}

        <section id="contacts" className="border-t border-border-subtle px-6 py-16 lg:px-10">
          <SectionHeading title="Контакты" subtitle="Приходите в гости или напишите нам" />
          <Card className="mx-auto max-w-2xl" padding="lg">
            <ul className="space-y-4 text-body">
              <li className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden />
                <span>{school.contacts.address}</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="h-5 w-5 shrink-0 text-brand" aria-hidden />
                <a href={`tel:${school.contacts.phone.replace(/\D/g, '')}`} className="hover:text-brand">
                  {school.contacts.phone}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="h-5 w-5 shrink-0 text-brand" aria-hidden />
                <a href={`mailto:${school.contacts.email}`} className="hover:text-brand">
                  {school.contacts.email}
                </a>
              </li>
              <li className="flex items-center gap-3 text-text-secondary">
                <Clock className="h-5 w-5 shrink-0 text-brand" aria-hidden />
                {school.contacts.workingHours}
              </li>
            </ul>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/register" className="flex-1">
                <Button className="w-full">Записаться</Button>
              </Link>
              <Link to="/login" className="flex-1">
                <Button className="w-full" variant="secondary">
                  Войти
                </Button>
              </Link>
            </div>
          </Card>
        </section>
      </main>

      <footer className="relative z-10 border-t border-border-subtle px-6 py-8 text-center text-caption text-text-muted lg:px-10">
        <p>
          © {new Date().getFullYear()} {school.name}. {school.tagline}.
        </p>
        <p className="mt-3">
          <Link to="/legal" className="text-brand hover:underline">
            Документы и согласия
          </Link>
        </p>
      </footer>
    </div>
  );
}
