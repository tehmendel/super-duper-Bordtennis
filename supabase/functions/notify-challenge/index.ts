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

  const { data: expectedSecret } = await admin.rpc("get_secret", { p_name: "notify_shared_secret" });
  if (!expectedSecret || req.headers.get("x-shared-secret") !== expectedSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const { challenger_id, challenged_id } = await req.json();
  if (!challenger_id || !challenged_id) {
    return new Response(JSON.stringify({ error: "challenger_id og challenged_id kreves" }), { status: 400 });
  }

  const [{ data: challenger }, { data: subscriptions }, { data: publicKey }, { data: privateKey }] = await Promise.all([
    admin.from("players").select("name").eq("id", challenger_id).single(),
    admin.from("push_subscriptions").select("*").eq("player_id", challenged_id),
    admin.rpc("get_secret", { p_name: "vapid_public_key" }),
    admin.rpc("get_secret", { p_name: "vapid_private_key" }),
  ]);

  if (!challenger || !subscriptions || subscriptions.length === 0 || !publicKey || !privateKey) {
    return new Response(JSON.stringify({ success: true, sent: 0 }), { status: 200 });
  }

  webpush.setVapidDetails("mailto:admin@example.com", publicKey, privateKey);

  const payload = JSON.stringify({
    title: "Du er utfordret! ⚔️",
    body: `${challenger.name} utfordrer deg til en kamp!`,
    url: ".",
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
