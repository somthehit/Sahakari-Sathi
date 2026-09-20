import { useState, useEffect, useRef } from 'react';

export interface AutoSaveDraftState<T> {
  data: T;
  timestamp: string;
}

export function useAutoSaveDraft<T>(
  storageKey: string,
  currentData: T,
  setFormData: React.Dispatch<React.SetStateAction<T>>,
  isDataModified: (data: T) => boolean,
  intervalMs = 3000,
  defaults?: T
) {
  const [hasDraft, setHasDraft] = useState(false);
  const [draftTimestamp, setDraftTimestamp] = useState<string | null>(null);
  const [draftBannerVisible, setDraftBannerVisible] = useState(false);

  // Keep a ref to setFormData to avoid stale callback closures in setInterval
  const setFormDataRef = useRef(setFormData);
  useEffect(() => {
    setFormDataRef.current = setFormData;
  }, [setFormData]);

  // Check on mount if a draft exists in localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed: AutoSaveDraftState<T> = JSON.parse(saved);
        if (parsed && parsed.data && isDataModified(parsed.data)) {
          setHasDraft(true);
          setDraftTimestamp(parsed.timestamp || 'Recently');
          setDraftBannerVisible(true);
        }
      }
    } catch (e) {
      console.error(`[AutoSave] Error checking draft for ${storageKey}:`, e);
    }
  }, [storageKey]);

  // Periodic auto-save loop
  useEffect(() => {
    const timer = setInterval(() => {
      if (isDataModified(currentData)) {
        try {
          const payload: AutoSaveDraftState<T> = {
            data: currentData,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          };
          localStorage.setItem(storageKey, JSON.stringify(payload));
          setHasDraft(true);
        } catch (e) {
          console.error(`[AutoSave] Error saving draft for ${storageKey}:`, e);
        }
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [storageKey, currentData, intervalMs]);

  const restoreDraft = () => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed: AutoSaveDraftState<T> = JSON.parse(saved);
        if (parsed && parsed.data) {
          // Merge the saved draft over the pristine defaults so fields that were
          // added after the draft was saved (e.g. gender/dobBS/membershipDateBS)
          // never come back as undefined — that previously caused DB NOT NULL 400s.
          setFormDataRef.current(defaults ? { ...defaults, ...parsed.data } : parsed.data);
          setDraftBannerVisible(false);
        }
      }
    } catch (e) {
      console.error(`[AutoSave] Error restoring draft for ${storageKey}:`, e);
    }
  };

  const clearDraft = () => {
    try {
      localStorage.removeItem(storageKey);
      setHasDraft(false);
      setDraftBannerVisible(false);
      setDraftTimestamp(null);
    } catch (e) {
      console.error(`[AutoSave] Error clearing draft for ${storageKey}:`, e);
    }
  };

  return {
    hasDraft,
    draftTimestamp,
    draftBannerVisible,
    restoreDraft,
    clearDraft,
    setDraftBannerVisible,
  };
}
