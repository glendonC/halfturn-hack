import * as Speech from 'expo-speech';
import { VoiceQuality, type Voice } from 'expo-speech';

import type { Settings } from '@/types';

/** A device TTS voice we can offer in Profile / resolve for cues. */
export interface VoiceOption {
  identifier: string;
  name: string;
  language: string;
  enhanced: boolean;
  /** Short Profile subtitle, e.g. "Clear US English". */
  detail?: string;
}

/**
 * Short curated coach roster — Apple's best *usable* US English voices for
 * third-party apps (Spoken Content Enhanced/Premium downloads).
 *
 * Intentionally excludes Siri voices (`siri_*` identifiers): they often appear
 * in the device list but refuse to speak outside Apple apps, falling back to
 * the compact robot. Prefer Samantha/Zoe/Ava/Tom when the player has downloaded
 * them in Settings → Accessibility → Spoken Content → Voices.
 */
const CURATED: readonly { name: string; detail: string }[] = [
  { name: 'Samantha', detail: 'Clear US English' },
  { name: 'Zoe', detail: 'Natural US English' },
  { name: 'Ava', detail: 'Warm US English' },
  { name: 'Tom', detail: 'Natural US male' },
] as const;

function displayName(voice: Voice): string {
  return voice.name.replace(/\s*\((Enhanced|Premium)\)\s*/i, '').trim() || voice.name;
}

/**
 * True for Enhanced/Premium packs. expo-speech only maps `.enhanced` → Enhanced
 * and collapses `.premium` to Default, so we also key off the identifier.
 */
function isNaturalQuality(voice: Voice): boolean {
  if (voice.quality === VoiceQuality.Enhanced) return true;
  const id = voice.identifier.toLowerCase();
  return id.includes('.enhanced.') || id.includes('.premium.') || id.includes('_premium');
}

/** Siri / novelty voices look natural in Settings but often won't speak in-app. */
function isUsableInApp(voice: Voice): boolean {
  const id = voice.identifier.toLowerCase();
  if (id.includes('siri_')) return false;
  if (id.includes('novelty')) return false;
  return true;
}

function toOption(voice: Voice): VoiceOption {
  return {
    identifier: voice.identifier,
    name: displayName(voice),
    language: voice.language,
    enhanced: isNaturalQuality(voice),
  };
}

async function loadDeviceVoices(): Promise<Voice[]> {
  try {
    return await Speech.getAvailableVoicesAsync();
  } catch {
    return [];
  }
}

/**
 * Pick the best installed variant of a curated name: natural-quality en-US
 * first, then any usable en-US match (so Auto still works before downloads).
 */
function pickNamed(voices: Voice[], name: string): Voice | undefined {
  const matches = voices.filter(
    (v) =>
      isUsableInApp(v) &&
      displayName(v).toLowerCase() === name.toLowerCase() &&
      v.language.toLowerCase().startsWith('en'),
  );
  if (matches.length === 0) return undefined;

  const usNatural = matches.find((v) => v.language.toLowerCase() === 'en-us' && isNaturalQuality(v));
  if (usNatural) return usNatural;

  const natural = matches.find((v) => isNaturalQuality(v));
  if (natural) return natural;

  const us = matches.find((v) => v.language.toLowerCase() === 'en-us');
  return us ?? matches[0];
}

/**
 * The short Profile list: only curated Apple voices that are installed.
 * Natural-quality variants preferred; detail string comes from the roster.
 */
export async function listNaturalVoices(_language: string): Promise<VoiceOption[]> {
  const voices = await loadDeviceVoices();
  const options: VoiceOption[] = [];

  for (const entry of CURATED) {
    const hit = pickNamed(voices, entry.name);
    if (!hit) continue;
    // Only offer a row when the natural pack is present — otherwise the picker
    // would re-surface compact robots. Auto still falls back if none are ready.
    if (!isNaturalQuality(hit)) continue;
    options.push({ ...toOption(hit), name: entry.name, detail: entry.detail });
  }

  return options;
}

/**
 * Resolve which voice id to speak with. Explicit `settings.voiceId` wins when
 * still installed; otherwise pick the first curated natural voice available,
 * then any curated compact, then the best remaining English natural voice.
 */
export async function resolveVoiceId(
  settings: Pick<Settings, 'voiceId' | 'language'>,
): Promise<string | undefined> {
  const voices = await loadDeviceVoices();
  if (voices.length === 0) return settings.voiceId ?? undefined;

  if (settings.voiceId) {
    const stillThere = voices.find((v) => v.identifier === settings.voiceId);
    if (stillThere) return stillThere.identifier;
  }

  for (const entry of CURATED) {
    const hit = pickNamed(voices, entry.name);
    if (hit && isNaturalQuality(hit)) return hit.identifier;
  }

  for (const entry of CURATED) {
    const hit = pickNamed(voices, entry.name);
    if (hit) return hit.identifier;
  }

  const english = voices.filter((v) => isUsableInApp(v) && v.language.toLowerCase().startsWith('en'));
  const natural = english.find((v) => isNaturalQuality(v));
  return (natural ?? english[0])?.identifier;
}

/** @deprecated Prefer listNaturalVoices — kept for callers that want the raw pool. */
export async function listVoicesForLanguage(language: string): Promise<VoiceOption[]> {
  const voices = await loadDeviceVoices();
  const wanted = language.toLowerCase();
  return voices
    .filter((v) => isUsableInApp(v) && v.language.toLowerCase().startsWith(wanted.split('-')[0]))
    .map(toOption)
    .sort((a, b) => {
      if (a.enhanced !== b.enhanced) return a.enhanced ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}
