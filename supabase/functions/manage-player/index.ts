import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "Mangler autorisasjon" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Scoped to the caller's own session, so current_player_can_write() resolves
  // auth.uid() to the actual caller rather than the service role.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data: canWrite, error: permError } = await callerClient.rpc("current_player_can_write", {
    p_page_key: "players",
  });
  if (permError || !canWrite) {
    return jsonResponse({ error: "Du har ikke skrivetilgang til Spillere" }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Ugyldig forespørsel" }, 400);
  }

  if (body.action === "create") {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!name) return jsonResponse({ error: "Navn er påkrevd" }, 400);
    if (!USERNAME_RE.test(username)) {
      return jsonResponse({ error: "Brukernavn må være 3-20 tegn (bokstaver, tall, _ eller .)" }, 400);
    }
    if (password.length < 8) return jsonResponse({ error: "Passordet må være minst 8 tegn" }, 400);

    const { data: existing } = await admin.from("players").select("id").ilike("username", username).maybeSingle();
    if (existing) return jsonResponse({ error: "Brukernavnet er allerede tatt" }, 400);

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: `${username}@players.local`,
      password,
      email_confirm: true,
      user_metadata: { username },
    });
    if (createError || !created.user) {
      return jsonResponse({ error: createError?.message ?? "Kunne ikke opprette konto" }, 400);
    }

    const { data: player, error: insertError } = await admin
      .from("players")
      .insert({ name, username, auth_user_id: created.user.id })
      .select()
      .single();

    if (insertError || !player) {
      await admin.auth.admin.deleteUser(created.user.id);
      return jsonResponse({ error: insertError?.message ?? "Kunne ikke opprette spiller" }, 400);
    }

    return jsonResponse({ success: true, playerId: player.id });
  }

  if (body.action === "reset_password") {
    const playerId = typeof body.playerId === "string" ? body.playerId : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!playerId) return jsonResponse({ error: "Mangler spiller-id" }, 400);
    if (password.length < 8) return jsonResponse({ error: "Passordet må være minst 8 tegn" }, 400);

    const { data: player } = await admin.from("players").select("auth_user_id").eq("id", playerId).maybeSingle();
    if (!player?.auth_user_id) {
      return jsonResponse({ error: "Denne spilleren har ingen konto å nullstille passord for" }, 400);
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(player.auth_user_id, { password });
    if (updateError) return jsonResponse({ error: updateError.message }, 400);

    return jsonResponse({ success: true });
  }

  return jsonResponse({ error: "Ukjent handling" }, 400);
});
