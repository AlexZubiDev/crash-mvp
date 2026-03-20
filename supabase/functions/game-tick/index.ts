import { serve } from "https://deno.land/std/http/server.ts";

serve(async () => {
  try {
    const res = await fetch("https://crash-o3rttax4a-alexzubidevs-projects.vercel.app/api/game/tick", {
      method: "POST",
      headers: {
        "Authorization": "Bearer crash-secret-azubi-2026",
      },
    });

    const text = await res.text();

    return new Response(text, { status: res.status });
  } catch (err) {
    return new Response("Error: " + err.message, { status: 500 });
  }
});