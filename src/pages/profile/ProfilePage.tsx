import { Link } from 'react-router-dom';
import { Settings, Shield, LogOut, ChevronRight, TrendingUp, HelpCircle, FileText } from 'lucide-react';
import { isProgressFeatureEnabled } from '@/config/features';
import { useCurrentUser, useAuthStore } from '@/stores/authStore';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useAvatarMutations } from '@/hooks/useAvatarMutations';
import { getRoleLabel, can } from '@/permissions';
import { AvatarUpload } from '@/components/profile/AvatarUpload';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatUserName } from '@/utils';

export default function ProfilePage() {
  const user = useCurrentUser()!;
  const logout = useAuthStore((s) => s.logout);
  const isOnline = useOnlineStatus();
  const { avatarError, uploadAvatarMutation, removeAvatarMutation } = useAvatarMutations(user.id);

  const menuItems = [
    { to: '/profile/settings', icon: Settings, label: 'Настройки' },
    ...(isProgressFeatureEnabled() &&
    (can(user, 'progress:view-own') ||
      can(user, 'progress:view-assigned') ||
      can(user, 'progress:view-all'))
      ? [{ to: '/profile/progress', icon: TrendingUp, label: 'Прогресс' }]
      : []),
    ...(can(user, 'support:view-faq') ? [{ to: '/profile/help', icon: HelpCircle, label: 'Помощь' }] : []),
    ...(can(user, 'legal:view-own')
      ? [{ to: '/profile/legal', icon: FileText, label: 'Документы и согласия' }]
      : []),
    ...(can(user, 'admin:access')
      ? [{ to: '/home', icon: Shield, label: 'Администрирование' }]
      : []),
  ];

  return (
    <div className="page-container max-w-lg">
      <header className="mb-8 flex flex-col items-center text-center">
        <AvatarUpload
          user={user}
          variant="profile"
          disabled={!isOnline}
          uploading={uploadAvatarMutation.isPending}
          removing={removeAvatarMutation.isPending}
          error={avatarError}
          onUpload={(input) => {
            if (!isOnline) return;
            uploadAvatarMutation.mutate(input);
          }}
          onRemove={() => {
            if (!isOnline) return;
            removeAvatarMutation.mutate();
          }}
        />
        <h1 className="mt-5 text-h1">{formatUserName(user)}</h1>
        <p className="mt-1 text-body-sm text-brand">{getRoleLabel(user.role)}</p>
        {user.bio && <p className="mt-2 text-body-sm text-text-secondary">{user.bio}</p>}
      </header>

      <div className="space-y-2">
        {menuItems.map(({ to, icon: Icon, label }) => (
          <Link key={to} to={to}>
            <Card interactive className="flex items-center gap-3">
              <Icon className="h-5 w-5 text-text-muted" aria-hidden />
              <span className="flex-1 font-medium">{label}</span>
              <ChevronRight className="h-4 w-4 text-text-muted" aria-hidden />
            </Card>
          </Link>
        ))}
      </div>

      <Button variant="destructive" fullWidth className="mt-8" onClick={() => logout()}>
        <LogOut className="h-4 w-4" aria-hidden />
        Выйти
      </Button>
    </div>
  );
}
