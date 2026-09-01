import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

interface AdminPageHeaderProps {
  title: string;
}

export function AdminPageHeader({ title }: AdminPageHeaderProps) {
  return (
    <header className="mb-6">
      <Link
        to="/home"
        className="mb-4 flex min-h-11 items-center gap-1 rounded text-sm text-text-secondary hover:text-brand focus-ring"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Главная
      </Link>
      <h1 className="text-h1">{title}</h1>
    </header>
  );
}
