import { serve } from "https://deno.land/std/http/server.ts";

serve(async () => {
  try {
    const res = await fetch("https://TU-DOMINIO.com/api/game/tick", {
      method: "POST",
      headers: {
        "Authorization": "Bearer TU_SECRET",
      },
    });

    const text = await res.text();

    return new Response(text, { status: res.status });
  } catch (err) {
    return new Response("Error: " + err.message, { status: 500 });
  }
});