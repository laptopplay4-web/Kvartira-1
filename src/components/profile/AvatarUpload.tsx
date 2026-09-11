import { useRef, useState } from 'react';

import { Camera, Plus } from 'lucide-react';

import { Avatar } from '@/components/ui/Avatar';
import { AvatarActionSheet } from '@/components/profile/AvatarActionSheet';
import { AvatarCropModal } from '@/components/profile/AvatarCropModal';
import { AvatarPhotoViewer } from '@/components/profile/AvatarPhotoViewer';
import { AvatarProfileMenu } from '@/components/profile/AvatarProfileMenu';
import { usePrefersHover } from '@/hooks/usePrefersHover';
import {
  dataUrlToAvatarUploadInput,
  fileToAvatarUploadInput,
  getAvatarFullPhotoUrl,
  hasAvatarPhoto,
  loadImageFromSrc,
  readFileAsDataUrl,
  inferAvatarMimeType,
  validateAvatarUpload,
} from '@/services/profile/avatar';
import type { User } from '@/types';
import { cn, formatUserName } from '@/utils';

interface AvatarUploadProps {
  user: User;
  disabled?: boolean;
  uploading?: boolean;
  removing?: boolean;
  error?: string;
  variant?: 'profile' | 'compact';
  onUpload: (input: ReturnType<typeof fileToAvatarUploadInput>) => void;
  onRemove: () => void;
}

export function AvatarUpload({
  user,
  disabled,
  uploading,
  removing,
  error,
  variant = 'profile',
  onUpload,
  onRemove,
}: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const avatarButtonRef = useRef<HTMLButtonElement>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingOriginalDataUrl, setPendingOriginalDataUrl] = useState<string | null>(null);
  const [cropImage, setCropImage] = useState<HTMLImageElement | null>(null);
  const [localError, setLocalError] = useState('');
  const prefersHover = usePrefersHover();

  const busy = disabled || uploading || removing;
  const displayError = localError || error;
  const fullPhotoUrl = getAvatarFullPhotoUrl(user);
  const userHasAvatar = hasAvatarPhoto(user);

  const openMenu = () => {
    if (busy) return;
    setMenuOpen(true);
  };

  const closeMenu = () => {
    setMenuOpen(false);
  };

  const openFilePicker = () => inputRef.current?.click();

  const openCropModal = async (file: File | null, src?: string) => {
    try {
      if (file) {
        const dataUrl = await readFileAsDataUrl(file);
        const image = await loadImageFromSrc(dataUrl);
        setPendingOriginalDataUrl(dataUrl);
        setPendingFile(file);
        setCropImage(image);
      } else {
        const image = await loadImageFromSrc(src!);
        setPendingOriginalDataUrl(null);
        setPendingFile(null);
        setCropImage(image);
      }
      setLocalError('');
      setCropOpen(true);
    } catch {
      setLocalError('Не удалось загрузить изображение');
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || busy) return;

    const validation = validateAvatarUpload({
      filename: file.name,
      mimeType: inferAvatarMimeType(file.name, file.type),
      size: file.size,
    });
    if (!validation.valid) {
      setLocalError(validation.message);
      return;
    }

    closeMenu();
    await openCropModal(file);
  };

  const handleApplyCrop = (dataUrl: string) => {
    const input =
      pendingFile && pendingOriginalDataUrl
        ? fileToAvatarUploadInput(pendingFile, dataUrl, pendingOriginalDataUrl)
        : dataUrlToAvatarUploadInput(dataUrl);
    onUpload(input);
    setCropOpen(false);
    setPendingFile(null);
    setPendingOriginalDataUrl(null);
    setCropImage(null);
  };

  const handleCloseCrop = () => {
    if (uploading) return;
    setCropOpen(false);
    setPendingFile(null);
    setPendingOriginalDataUrl(null);
    setCropImage(null);
  };

  const handleChangePhoto = () => {
    closeMenu();
    openFilePicker();
  };

  const handleOpenPhoto = () => {
    closeMenu();
    if (fullPhotoUrl) setViewerOpen(true);
  };

  const handleRemovePhoto = () => {
    closeMenu();
    onRemove();
  };

  const handleAvatarClick = () => {
    if (busy || prefersHover) return;
    setMenuOpen((open) => !open);
  };

  const handleAvatarKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (busy) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setMenuOpen((open) => !open);
    }
  };

  if (variant === 'compact') {
    return (
      <>
        <button
          type="button"
          onClick={() => !busy && setSheetOpen(true)}
          disabled={busy}
          className="flex w-full items-center gap-4 rounded-xl border border-border-subtle bg-surface px-4 py-3 text-left transition-colors hover:bg-surface-hover min-h-11"
        >
          <Avatar
            src={user.avatarUrl}
            firstName={user.firstName}
            lastName={user.lastName}
            size="md"
            className="h-12 w-12"
          />
          <div className="min-w-0 flex-1">
            <p className="text-body-sm font-medium">Фото профиля</p>
            <p className="text-caption text-text-muted">Нажмите, чтобы изменить</p>
          </div>
          <Camera className="h-5 w-5 shrink-0 text-text-muted" aria-hidden />
        </button>
        {displayError && (
          <p className="mt-2 text-caption text-danger" role="alert">
            {displayError}
          </p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={busy}
          onChange={handleFileChange}
        />
        <AvatarActionSheet
          open={sheetOpen}
          hasAvatar={userHasAvatar}
          disabled={busy}
          removing={removing}
          onClose={() => setSheetOpen(false)}
          onUpload={openFilePicker}
          onRemove={onRemove}
        />
        <AvatarCropModal
          open={cropOpen}
          image={cropImage}
          onClose={handleCloseCrop}
          onApply={handleApplyCrop}
          applying={uploading}
        />
      </>
    );
  }

  return (
    <>
      <div
        ref={rootRef}
        className="relative z-20 flex flex-col items-center"
        onMouseEnter={prefersHover ? openMenu : undefined}
      >
        <button
          ref={avatarButtonRef}
          type="button"
          onClick={handleAvatarClick}
          onKeyDown={handleAvatarKeyDown}
          disabled={busy}
          className={cn(
            'group relative rounded-full focus-ring',
            busy && 'opacity-60',
          )}
          aria-label="Меню фото профиля"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <Avatar
            src={user.avatarUrl}
            firstName={user.firstName}
            lastName={user.lastName}
            size="lg"
            className="h-28 w-28 text-3xl ring-4 ring-surface-elevated transition-transform group-active:scale-[0.98] sm:h-32 sm:w-32"
          />
          <span className="absolute bottom-0.5 right-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-brand text-brand-contrast shadow-md ring-2 ring-bg transition-transform group-hover:scale-105 sm:h-8 sm:w-8">
            <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={2.5} aria-hidden />
          </span>
        </button>

        <AvatarProfileMenu
          open={menuOpen}
          hasAvatar={userHasAvatar}
          disabled={busy}
          removing={removing}
          anchorRef={avatarButtonRef}
          onOpenPhoto={handleOpenPhoto}
          onChangePhoto={handleChangePhoto}
          onRemove={handleRemovePhoto}
          onClose={closeMenu}
        />

        {displayError && (
          <p className="mt-3 text-center text-caption text-danger" role="alert">
            {displayError}
          </p>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        disabled={busy}
        onChange={handleFileChange}
      />

      <AvatarPhotoViewer
        open={viewerOpen}
        src={fullPhotoUrl}
        alt={`Фото профиля ${formatUserName(user)}`}
        onClose={() => setViewerOpen(false)}
      />

      <AvatarCropModal
        open={cropOpen}
        image={cropImage}
        onClose={handleCloseCrop}
        onApply={handleApplyCrop}
        applying={uploading}
      />
    </>
  );
}
