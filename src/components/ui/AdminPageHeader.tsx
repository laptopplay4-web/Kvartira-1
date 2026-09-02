import { BackLink } from '@/components/ui/BackLink';

interface AdminPageHeaderProps {
  title: string;
}

export function AdminPageHeader({ title }: AdminPageHeaderProps) {
  return (
    <header className="mb-6">
      <BackLink label="Администрирование" fallbackTo="/admin" />
      <h1 className="text-h1">{title}</h1>
    </header>
  );
}
