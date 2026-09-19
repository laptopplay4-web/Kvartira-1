import { Clock, ExternalLink, Mail, MapPin, Phone } from 'lucide-react';
import type { PublicSchoolInfo } from '@/types';
import { VideoPlayer } from '@/components/ui/VideoPlayer';
import {
  EMPTY_SCHOOL_SOCIAL_LINKS,
  SCHOOL_SOCIAL_LINK_KEYS,
  SCHOOL_SOCIAL_LINK_LABELS,
} from '@/services/school/constants';
import { hasAnySchoolSocialLink, normalizeSchoolSocialLinks } from '@/services/school/helpers';

interface SchoolAboutContentProps {
  school: PublicSchoolInfo;
  /** Скрыть название/слоган (если уже в заголовке снаружи). */
  hideHeader?: boolean;
}

export function SchoolAboutContent({ school, hideHeader = false }: SchoolAboutContentProps) {
  const socialLinks = normalizeSchoolSocialLinks(school.socialLinks ?? EMPTY_SCHOOL_SOCIAL_LINKS);
  const video = school.directionsVideo;

  return (
    <div className="space-y-4">
      {!hideHeader && (
        <div>
          <h3 className="text-h2 text-text-primary">{school.name}</h3>
          <p className="mt-1 text-body-sm text-brand">{school.tagline}</p>
        </div>
      )}

      <p className="whitespace-pre-wrap text-body text-text-secondary">{school.about}</p>

      <ul className="space-y-2.5 border-t border-border-subtle pt-4 text-body-sm text-text-secondary">
        <li className="flex items-start gap-2.5">
          <Phone className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
          <a
            href={`tel:${school.contacts.phone.replace(/\s/g, '')}`}
            className="rounded hover:text-brand focus-ring"
          >
            {school.contacts.phone}
          </a>
        </li>
        <li className="flex items-start gap-2.5">
          <Mail className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
          <a
            href={`mailto:${school.contacts.email}`}
            className="rounded hover:text-brand focus-ring"
          >
            {school.contacts.email}
          </a>
        </li>
        <li className="flex items-start gap-2.5">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
          <span>{school.contacts.address}</span>
        </li>
        <li className="flex items-start gap-2.5">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
          <span>{school.contacts.workingHours}</span>
        </li>
      </ul>

      {hasAnySchoolSocialLink(socialLinks) && (
        <div className="space-y-2 border-t border-border-subtle pt-4">
          <h4 className="text-label text-text-primary">Ссылки</h4>
          <ul className="space-y-1 text-body-sm">
            {SCHOOL_SOCIAL_LINK_KEYS.filter((key) => socialLinks[key]?.trim()).map((key) => (
              <li key={key}>
                <a
                  href={socialLinks[key]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg text-brand hover:underline focus-ring"
                >
                  <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
                  {SCHOOL_SOCIAL_LINK_LABELS[key]}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {video?.url && (
        <div className="space-y-2 border-t border-border-subtle pt-4">
          <h4 className="text-label text-text-primary">Как добраться</h4>
          <VideoPlayer
            src={video.url}
            mimeType={video.mimeType}
            className="aspect-video w-full max-h-[min(70vh,32rem)]"
            aria-label={video.filename ?? 'Как добраться'}
          />
        </div>
      )}
    </div>
  );
}
