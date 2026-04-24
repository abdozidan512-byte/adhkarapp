import { createFileRoute } from "@tanstack/react-router";

// TTS عبر Lovable AI Gateway باستخدام نموذج صوتي طبيعي
// نستخدم google/gemini-2.5-flash-preview-tts الذي يولّد نطقاً عربياً قريباً من الصوت البشري
export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { text } = (await request.json()) as { text?: string };
          if (!text || typeof text !== "string" || text.length > 4000) {
            return new Response(JSON.stringify({ error: "نص غير صالح" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
          if (!LOVABLE_API_KEY) {
            return new Response(JSON.stringify({ error: "LOVABLE_API_KEY غير مهيأ" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          // نستدعي بوابة Lovable AI لتوليد الصوت
          const response = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-preview-tts",
              input: text,
              voice: "Kore", // صوت أنثوي/ذكوري عربي طبيعي
              response_format: "mp3",
            }),
          });

          if (!response.ok) {
            const errText = await response.text();
            // محاولة احتياطية: openai-compatible TTS
            const fallback = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-pro-preview-tts",
                input: text,
                voice: "Charon",
              }),
            });
            if (!fallback.ok) {
              return new Response(
                JSON.stringify({ error: `TTS failed: ${response.status}`, details: errText.slice(0, 300) }),
                { status: 502, headers: { "Content-Type": "application/json" } }
              );
            }
            const buf2 = await fallback.arrayBuffer();
            return new Response(buf2, {
              status: 200,
              headers: {
                "Content-Type": "audio/mpeg",
                "Cache-Control": "public, max-age=2592000, immutable",
              },
            });
          }

          const buf = await response.arrayBuffer();
          return new Response(buf, {
            status: 200,
            headers: {
              "Content-Type": "audio/mpeg",
              "Cache-Control": "public, max-age=2592000, immutable",
            },
          });
        } catch (e) {
          return new Response(
            JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
