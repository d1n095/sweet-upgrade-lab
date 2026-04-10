import { useEffect, useMemo } from 'react';

const isPreviewRuntime = () => {
  if (typeof window === 'undefined') return false;

  const { hostname, search } = window.location;

  return (
    hostname.endsWith('lovableproject.com') ||
    hostname.startsWith('id-preview--') ||
    search.includes('__lovable_token=')
  );
};

export const usePreviewCleanMode = () => {
  const isPreviewCleanMode = useMemo(() => isPreviewRuntime(), []);

  useEffect(() => {
    if (!isPreviewCleanMode) return;

    document.documentElement.dataset.previewClean = 'true';

    return () => {
      delete document.documentElement.dataset.previewClean;
    };
  }, [isPreviewCleanMode]);

  return isPreviewCleanMode;
};
