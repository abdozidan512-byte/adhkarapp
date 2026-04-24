import { getDB } from "./db";

// تخزين صوت الأذكار في IndexedDB على مفتاح فريد لكل ذكر
// نستخدم نفس object store الخاص بالـ audio مع reciterId="azkar" و key مبني على hash النص

async function hashText(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .slice(0, 12)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// نزيل علامات [[N]] والتشكيل الزائد قبل النطق ليكون أوضح
function cleanForSpeech(text: string): string {
  return text
    .replace(/\[\[\d+\]\]/g, " ")
    .replace(/[ﷺ]/g, "صلى الله عليه وسلم")
    .replace(/\s+/g, " ")
    .trim();
}

export async function getZikrAudioBlob(text: string): Promise<Blob> {
  const cleaned = cleanForSpeech(text);
  const hash = await hashText(cleaned);
  const key = `azkar-${hash}`;

  const db = await getDB();
  if (db) {
    const cached = await db.get("audio", key);
    if (cached) return cached.blob;
  }

  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: cleaned }),
  });
  if (!res.ok) {
    let msg = `TTS failed: ${res.status}`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
  const blob = await res.blob();
  if (db) {
    await db.put("audio", {
      key,
      blob,
      size: blob.size,
      reciterId: "azkar",
      surahNumber: 0,
      cachedAt: Date.now(),
    });
  }
  return blob;
}

export async function isZikrAudioCached(text: string): Promise<boolean> {
  const cleaned = cleanForSpeech(text);
  const hash = await hashText(cleaned);
  const key = `azkar-${hash}`;
  const db = await getDB();
  if (!db) return false;
  const cached = await db.get("audio", key);
  return !!cached;
}
