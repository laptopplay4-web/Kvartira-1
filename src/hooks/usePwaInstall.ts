import { useCallback, useEffect, useState } from 'react';
import { PWA_INSTALL_SHOW_DELAY_MS } from '@/services/pwa/constants';
import {
  canShowInstallBanner,
  isPwaInstalled,
  recordInstallPromptDismissal,
} from '@/services/pwa/helpers';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(isPwaInstalled);
  const [showBanner, setShowBanner] = useState(false);
  const [readyToShow, setReadyToShow] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (isPwaInstalled()) {
      setIsInstalled(true);
      return;
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowBanner(false);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onAppInstalled);

    const delayTimer = window.setTimeout(() => setReadyToShow(true), PWA_INSTALL_SHOW_DELAY_MS);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onAppInstalled);
      window.clearTimeout(delayTimer);
    };
  }, []);

  useEffect(() => {
    setShowBanner(readyToShow && canShowInstallBanner(!!deferredPrompt));
  }, [readyToShow, deferredPrompt]);

  const dismissPrompt = useCallback(() => {
    recordInstallPromptDismissal();
    setShowBanner(false);
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return;

    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      setShowBanner(false);
      if (outcome === 'dismissed') {
        recordInstallPromptDismissal();
      }
    } finally {
      setInstalling(false);
    }
  }, [deferredPrompt]);

  return {
    showBanner,
    isInstalled,
    canInstall: !!deferredPrompt && !isInstalled,
    installing,
    promptInstall,
    dismissPrompt,
  };
}
