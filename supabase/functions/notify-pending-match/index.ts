import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Only our own Postgres trigger is allowed to call this function.
  const { data: expectedSecret } = await admin.rpc("get_secret", { p_name: "notify_shared_secret" });
  if (!expectedSecret || req.headers.get("x-shared-secret") !== expectedSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const { match_id, opponent_id } = await req.json();
  if (!match_id || !opponent_id) {
    return new Response(JSON.stringify({ error: "match_id og opponent_id kreves" }), { status: 400 });
  }

  const [{ data: match }, { data: subscriptions }, { data: publicKey }, { data: privateKey }] = await Promise.all([
    admin.from("matches").select("*, player1:players!matches_player1_id_fkey(name), player2:players!matches_player2_id_fkey(name)").eq("id", match_id).single(),
    admin.from("push_subscriptions").select("*").eq("player_id", opponent_id),
    admin.rpc("get_secret", { p_name: "vapid_public_key" }),
    admin.rpc("get_secret", { p_name: "vapid_private_key" }),
  ]);

  if (!match || !subscriptions || subscriptions.length === 0) {
    return new Response(JSON.stringify({ success: true, sent: 0 }), { status: 200 });
  }

  if (!publicKey || !privateKey) {
    return new Response(JSON.stringify({ error: "VAPID keys mangler" }), { status: 500 });
  }

  webpush.setVapidDetails("mailto:admin@example.com", publicKey, privateKey);

  const submitterName = match.submitted_by === match.player1_id ? match.player1.name : match.player2.name;
  const submitterSets = match.submitted_by === match.player1_id ? match.sets_won_player1 : match.sets_won_player2;
  const opponentSets = match.submitted_by === match.player1_id ? match.sets_won_player2 : match.sets_won_player1;
  const payload = JSON.stringify({
    title: "Ny kamp registrert",
    body: `${submitterName} registrerte ${submitterSets}-${opponentSets} mot deg. Kampen er automatisk godkjent.`,
    url: "matches",
  });

  let sent = 0;
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      );
      sent++;
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await admin.from("push_subscriptions").delete().eq("id", sub.id);
      }
    }
  }

  return new Response(JSON.stringify({ success: true, sent }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
