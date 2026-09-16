import React from 'react';
import type { GenerateOutfitResponse, LocationInput, OutfitSuggestion } from '../../shared/api';
import type { CollabResult, ExploreProfile, SavedOutfit, StylistRequest, WardrobeItem } from '../types';
import { apiFetch } from '../services/api';
import { generateOutfit } from '../services/stylistService';
import { useNotification } from './NotificationContext';
import { useWardrobe } from './WardrobeContext';
import { useAuth } from './AuthContext';

export type CollabOutcome = CollabResult & { friendName: string; friendItems: WardrobeItem[] };

export interface PlannerForm extends StylistRequest {
  locationLabel: string;
}

const PERSONAL_CONTEXT_KEY = 'aura_personal_context';

const DEFAULT_FORM: PlannerForm = {
  location: { type: 'coords', lat: 40.9788, lon: 29.0827, label: 'Kadıköy, İstanbul' },
  locationLabel: 'Kadıköy, İstanbul',
  event: 'Gündelik',
  dressiness: 3,
  mood: 'Rahat',
  ignoreWeather: false,
  requiredItems: [],
  styleTags: [],
};

interface StylistContextValue {
  form: PlannerForm;
  setForm: React.Dispatch<React.SetStateAction<PlannerForm>>;
  setLocation: (location: LocationInput, label: string) => void;
  personalContext: string;
  setPersonalContext: (value: string) => void;

  result: GenerateOutfitResponse | null;
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  currentOutfit: OutfitSuggestion | null;
  isGenerating: boolean;
  generationStatus: string;
  lockedItems: string[];
  toggleLock: (itemId: string) => void;
  generate: (request: StylistRequest) => void;
  replaceItem: (itemId: string) => void;
  reroll: () => void;
  clearResult: () => void;
  sendFeedback: (type: 'worn' | 'disliked', reason?: string) => Promise<void>;
  saveCurrent: () => Promise<void>;

  collabPartner: ExploreProfile | null;
  setCollabPartner: (profile: ExploreProfile | null) => void;
  collabResult: CollabOutcome | null;
  isCollabGenerating: boolean;
  generateCollab: () => Promise<void>;
  clearCollab: () => void;

  savedOutfits: SavedOutfit[];
  refreshOutfits: () => Promise<void>;
  itemById: Map<string, WardrobeItem>;
  wearItems: (itemIds: string[], outfitId?: string) => Promise<void>;
}

const StylistContext = React.createContext<StylistContextValue | undefined>(undefined);

export function StylistProvider({ children }: { children: React.ReactNode }) {
  const { notify, ask } = useNotification();
  const { items, fetchWardrobe } = useWardrobe();
  const { user } = useAuth();

  const [form, setForm] = React.useState<PlannerForm>(DEFAULT_FORM);
  const [personalContext, setPersonalContextState] = React.useState(() => localStorage.getItem(PERSONAL_CONTEXT_KEY) || '');

  const [result, setResult] = React.useState<GenerateOutfitResponse | null>(null);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [generationStatus, setGenerationStatus] = React.useState('');
  // Değiştir/Yenile/Kilit: formdan gelen istek değişmez; kilitler ve bu oturumda reddedilen parçalar ayrı tutulur
  const [baseRequest, setBaseRequest] = React.useState<StylistRequest | null>(null);
  const [lockedItems, setLockedItems] = React.useState<string[]>([]);
  const [sessionExcluded, setSessionExcluded] = React.useState<string[]>([]);
  const [recentHistory, setRecentHistory] = React.useState<string[][]>([]);
  const controllerRef = React.useRef<AbortController | null>(null);

  const [collabPartner, setCollabPartner] = React.useState<ExploreProfile | null>(null);
  const [collabResult, setCollabResult] = React.useState<CollabOutcome | null>(null);
  const [isCollabGenerating, setIsCollabGenerating] = React.useState(false);

  const [savedOutfits, setSavedOutfits] = React.useState<SavedOutfit[]>([]);
  const [extraItems, setExtraItems] = React.useState<Record<string, WardrobeItem>>({});

  const setPersonalContext = React.useCallback((value: string) => {
    setPersonalContextState(value);
    localStorage.setItem(PERSONAL_CONTEXT_KEY, value);
  }, []);

  const setLocation = React.useCallback((location: LocationInput, label: string) => {
    setForm(prev => ({ ...prev, location, locationLabel: label }));
  }, []);

  const itemById = React.useMemo(() => {
    const map = new Map<string, WardrobeItem>(Object.entries(extraItems));
    for (const item of items) map.set(item.id, item);
    for (const outfit of result?.outfits || []) for (const item of outfit.items) if (!map.has(item.id)) map.set(item.id, item as WardrobeItem);
    return map;
  }, [items, extraItems, result]);

  const refreshOutfits = React.useCallback(async () => {
    try {
      const data = await apiFetch<{ outfits: SavedOutfit[] }>('/api/outfits');
      setSavedOutfits(data.outfits || []);
    } catch {
      // Liste bir sonraki açılışta yeniden denenir
    }
  }, []);

  React.useEffect(() => {
    if (user) refreshOutfits();
  }, [user, refreshOutfits]);

  // Kayıtlı kombinlerde, yüklenmiş gardırop sayfalarında olmayan parçaları sunucudan tamamla
  React.useEffect(() => {
    const missing = Array.from(new Set(savedOutfits.flatMap(o => o.items))).filter(id => !itemById.has(id));
    if (missing.length === 0) return;
    apiFetch<{ items: WardrobeItem[] }>(`/api/wardrobe?ids=${encodeURIComponent(missing.slice(0, 200).join(','))}`)
      .then(data => setExtraItems(prev => ({ ...prev, ...Object.fromEntries(data.items.map(i => [i.id, i])) })))
      .catch(() => undefined);
  }, [savedOutfits]); // eslint-disable-line react-hooks/exhaustive-deps

  const quietFeedback = React.useCallback((body: Record<string, unknown>) => {
    apiFetch('/api/feedback', { body }).catch(() => undefined);
  }, []);

  const run = React.useCallback(async (request: StylistRequest, history: string[][]) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setIsGenerating(true);
    setGenerationStatus('Hava durumu ve gardırobun inceleniyor…');
    const statusTimer = setTimeout(() => setGenerationStatus('Kombinler hazırlanıyor…'), 2500);
    try {
      const response: GenerateOutfitResponse = await generateOutfit(items, {
        ...request,
        personalContext: personalContext.trim() || undefined,
        recentOutfits: history,
      }, controller.signal);
      if (controller.signal.aborted) return;
      setResult(response);
      setSelectedIndex(0);
      const shown = (response.outfits || []).map(o => o.itemIds);
      if (shown.length) setRecentHistory(prev => [...prev, ...shown].slice(-9));
    } catch (error: any) {
      if (error?.name === 'AbortError') return;
      const message = /429|kota/i.test(error?.message || '')
        ? 'Yapay zeka kota sınırına ulaşıldı. Biraz sonra tekrar dene.'
        : error?.message || 'Kombin oluşturulamadı.';
      notify(message, 'error');
    } finally {
      clearTimeout(statusTimer);
      if (!controller.signal.aborted) {
        setIsGenerating(false);
        setGenerationStatus('');
      }
    }
  }, [items, personalContext, notify]);

  const generate = React.useCallback((request: StylistRequest) => {
    setBaseRequest(request);
    setLockedItems([]);
    setSessionExcluded([]);
    setRecentHistory([]);
    setResult(null);
    run({ ...request, lockedItems: [], excludedItems: request.excludedItems || [] }, []);
  }, [run]);

  const currentOutfit = result?.outfits?.[selectedIndex] || result?.outfits?.[0] || null;

  const replaceItem = React.useCallback((itemId: string) => {
    if (!baseRequest || !currentOutfit || !result) return;
    quietFeedback({ type: 'replaced', itemId, itemIds: currentOutfit.itemIds, generationId: result.generationId, context: result.context });
    const excluded = Array.from(new Set([...sessionExcluded, itemId]));
    setSessionExcluded(excluded);
    const keep = currentOutfit.itemIds.filter(id => id !== itemId);
    const required = Array.from(new Set([...(baseRequest.requiredItems || []), ...lockedItems, ...keep])).filter(id => !excluded.includes(id));
    run({ ...baseRequest, requiredItems: required, lockedItems, excludedItems: excluded }, recentHistory);
  }, [baseRequest, currentOutfit, result, sessionExcluded, lockedItems, recentHistory, run, quietFeedback]);

  const reroll = React.useCallback(() => {
    if (!baseRequest || !result) return;
    quietFeedback({ type: 'rerolled', generationId: result.generationId, context: result.context });
    const required = Array.from(new Set([...(baseRequest.requiredItems || []), ...lockedItems]));
    run({ ...baseRequest, requiredItems: required, lockedItems, excludedItems: sessionExcluded.filter(id => !required.includes(id)) }, recentHistory);
  }, [baseRequest, result, lockedItems, sessionExcluded, recentHistory, run, quietFeedback]);

  const toggleLock = React.useCallback((itemId: string) => {
    setLockedItems(prev => (prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]));
  }, []);

  const clearResult = React.useCallback(() => {
    controllerRef.current?.abort();
    setIsGenerating(false);
    setResult(null);
    setLockedItems([]);
    setSessionExcluded([]);
  }, []);

  const sendFeedback = React.useCallback(async (type: 'worn' | 'disliked', reason?: string) => {
    if (!result || !currentOutfit) return;
    try {
      const data = await apiFetch<{ stored: boolean }>('/api/feedback', {
        body: { type, reason, generationId: result.generationId, itemIds: currentOutfit.itemIds, context: result.context },
      });
      if (type === 'worn') {
        notify('Giyim günlüğüne eklendi.', 'success');
        fetchWardrobe();
      } else if (data.stored) {
        notify('Teşekkürler, sonraki önerilerde dikkate alınacak.', 'info');
      } else {
        notify('Geri bildirimlerinden öğrenebilmem için Profil › Ayarlar › Gizlilik bölümünden izin verebilirsin.', 'info');
      }
    } catch (err: any) {
      notify(err.message || 'Geri bildirim kaydedilemedi.', 'error');
    }
  }, [result, currentOutfit, notify, fetchWardrobe]);

  const saveCurrent = React.useCallback(async () => {
    if (!currentOutfit || !result) return;
    const name = await ask('Kombine bir ad ver', currentOutfit.title || 'Favori kombinim');
    if (!name) return;
    try {
      await apiFetch('/api/outfits', {
        body: {
          name,
          items: currentOutfit.itemIds,
          stylingReason: currentOutfit.reason,
          compatibilityScore: currentOutfit.score,
          generationId: result.generationId,
          context: result.context,
          source: 'ai',
        },
      });
      notify('Kombin kaydedildi.', 'success');
      refreshOutfits();
    } catch (err: any) {
      notify(err.message || 'Kombin kaydedilemedi.', 'error');
    }
  }, [currentOutfit, result, ask, notify, refreshOutfits]);

  const generateCollab = React.useCallback(async () => {
    if (!collabPartner) return;
    setIsCollabGenerating(true);
    try {
      const data = await apiFetch<any>('/api/collab/generate', {
        body: {
          friendUserId: collabPartner.id,
          event: form.event,
          dressiness: form.dressiness,
          activity: form.activity,
          mood: form.mood,
          dateTime: form.dateTime,
          ignoreWeather: form.ignoreWeather,
          location: form.location,
        },
      });
      setCollabResult({
        collabId: data.collabId,
        myOutfit: data.myOutfit,
        friendOutfit: data.friendOutfit,
        myItems: data.myItems,
        friendItems: data.friendItems || [],
        compatibilityScore: data.compatibilityScore,
        collabReason: data.collabReason,
        styleHarmony: data.styleHarmony,
        warnings: data.warnings,
        friendName: data.friendName,
      });
      notify(`${collabPartner.name} bilgilendirildi.`, 'success');
    } catch (err: any) {
      notify(err.message || 'Beraber kombin oluşturulamadı.', 'error');
    } finally {
      setIsCollabGenerating(false);
    }
  }, [collabPartner, form, notify]);

  const wearItems = React.useCallback(async (itemIds: string[], outfitId?: string) => {
    try {
      await apiFetch('/api/wear-log', { body: { itemIds, outfitId, source: outfitId ? 'saved' : 'manual' } });
      notify('Bugün giydiklerine eklendi.', 'success');
      fetchWardrobe();
    } catch (err: any) {
      notify(err.message || 'Giyim kaydı eklenemedi.', 'error');
    }
  }, [notify, fetchWardrobe]);

  const value: StylistContextValue = {
    form, setForm, setLocation, personalContext, setPersonalContext,
    result, selectedIndex, setSelectedIndex, currentOutfit, isGenerating, generationStatus,
    lockedItems, toggleLock, generate, replaceItem, reroll, clearResult, sendFeedback, saveCurrent,
    collabPartner, setCollabPartner, collabResult, isCollabGenerating, generateCollab, clearCollab: () => setCollabResult(null),
    savedOutfits, refreshOutfits, itemById, wearItems,
  };

  return <StylistContext.Provider value={value}>{children}</StylistContext.Provider>;
}

export function useStylist() {
  const context = React.useContext(StylistContext);
  if (!context) throw new Error('useStylist, StylistProvider içinde kullanılmalı');
  return context;
}
