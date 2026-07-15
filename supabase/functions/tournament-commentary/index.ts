import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

function roundName(round: number, totalRounds: number) {
  const remaining = totalRounds - round + 1;
  switch (remaining) {
    case 1: return "Finale";
    case 2: return "Semifinale";
    case 3: return "Kvartfinale";
    case 4: return "Åttedelsfinale";
    case 5: return "Sekstendedelsfinale";
    default: return `Runde ${round}`;
  }
}

async function callClaude(apiKey: string, prompt: string): Promise<string | null> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      system:
        "Du er en engasjert, morsom bordtennis-kommentator for en kontorturnering. Skriv KORT (maks 2 setninger), " +
        "energisk kommentar på flytende og korrekt norsk bokmål — skriv slik en ekte norsk sportskommentator ville " +
        "snakket. Ikke oversett engelske uttrykk direkte (unngå ting som 'dark horse' eller 'mayhem'), og ikke " +
        "dikt opp ord eller uttrykk som ikke finnes i naturlig norsk. Ingen innledning som 'Her er kommentaren' " +
        "— skriv KUN selve kommentaren.",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    console.error("Anthropic API error", res.status, await res.text());
    return null;
  }

  const data = await res.json();
  const text = data.content?.find((c: { type: string }) => c.type === "text")?.text;
  return typeof text === "string" ? text.trim() : null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Only our own Postgres triggers are allowed to call this function.
  const { data: expectedSecret } = await admin.rpc("get_secret", { p_name: "notify_shared_secret" });
  if (!expectedSecret || req.headers.get("x-shared-secret") !== expectedSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const { tournament_id, event, match_id } = await req.json();
  if (!tournament_id || !event) {
    return new Response(JSON.stringify({ error: "tournament_id og event kreves" }), { status: 400 });
  }

  const { data: apiKey } = await admin.rpc("get_secret", { p_name: "anthropic_api_key" });
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Anthropic API-nøkkel mangler i Vault" }), { status: 500 });
  }

  const { data: tournament } = await admin.from("tournaments").select("*").eq("id", tournament_id).single();
  if (!tournament) return new Response(JSON.stringify({ error: "Fant ikke turneringen" }), { status: 404 });

  let prompt: string | null = null;

  if (event === "created") {
    const { data: participants } = await admin
      .from("tournament_participants")
      .select("seed, player:players(name)")
      .eq("tournament_id", tournament_id)
      .order("seed");
    const names = (participants ?? []).map((p: { seed: number; player: { name: string } | null }) => `${p.player?.name} (seed ${p.seed})`).join(", ");
    prompt = `Turneringen "${tournament.name}" har akkurat startet med ${participants?.length ?? 0} deltakere: ${names}. Skriv en kort åpningskommentar som hyper opp spillerne.`;
  }

  if (event === "match_decided" && match_id) {
    const { data: match } = await admin
      .from("tournament_matches")
      .select("*, player1:players!tournament_matches_player1_id_fkey(name), player2:players!tournament_matches_player2_id_fkey(name)")
      .eq("id", match_id)
      .single();
    if (match) {
      const { data: allMatches } = await admin.from("tournament_matches").select("round").eq("tournament_id", tournament_id);
      const totalRounds = Math.max(1, ...(allMatches ?? []).map((m: { round: number }) => m.round));
      const { data: participants } = await admin
        .from("tournament_participants")
        .select("seed, player_id")
        .eq("tournament_id", tournament_id);
      const seedOf = (playerId: string) => (participants ?? []).find((p: { player_id: string; seed: number }) => p.player_id === playerId)?.seed;

      const winnerName = match.winner_id === match.player1_id ? match.player1?.name : match.player2?.name;
      const loserName = match.winner_id === match.player1_id ? match.player2?.name : match.player1?.name;
      const winnerSeed = seedOf(match.winner_id);
      const loserSeed = match.winner_id === match.player1_id ? seedOf(match.player2_id) : seedOf(match.player1_id);
      const isUpset = winnerSeed && loserSeed && winnerSeed > loserSeed;

      prompt =
        `${winnerName} (seed ${winnerSeed ?? "?"}) slo ${loserName} (seed ${loserSeed ?? "?"}) ${match.player1_score}-${match.player2_score} i sett, ` +
        `i ${roundName(match.round, totalRounds)} av turneringen "${tournament.name}".` +
        (isUpset ? " Dette er en SENSASJON — den lavere sådde spilleren vant!" : "") +
        (match.is_lucky_loser ? " Dette var en lucky loser-kamp." : "") +
        " Skriv en kort, engasjerende kommentar om dette resultatet.";
    }
  }

  if (event === "completed") {
    const { data: allMatches } = await admin
      .from("tournament_matches")
      .select("*, player1:players!tournament_matches_player1_id_fkey(name), player2:players!tournament_matches_player2_id_fkey(name)")
      .eq("tournament_id", tournament_id);
    const maxRound = Math.max(0, ...(allMatches ?? []).map((m: { round: number }) => m.round));
    const finalMatch = (allMatches ?? []).find((m: { round: number }) => m.round === maxRound);
    const champion = finalMatch && (finalMatch.winner_id === finalMatch.player1_id ? finalMatch.player1?.name : finalMatch.player2?.name);
    const { count: participantCount } = await admin
      .from("tournament_participants")
      .select("*", { count: "exact", head: true })
      .eq("tournament_id", tournament_id);

    const durationMs = tournament.completed_at
      ? new Date(tournament.completed_at).getTime() - new Date(tournament.created_at).getTime()
      : 0;
    const durationMin = Math.round(durationMs / 60000);

    prompt =
      `Turneringen "${tournament.name}" med ${participantCount ?? "?"} deltakere er nå fullført! ${champion ?? "Ukjent spiller"} vant hele turneringen. ` +
      `Turneringen varte i ${durationMin} minutter. Skriv en kort, feststemt avslutningskommentar som hyller vinneren.`;
  }

  if (!prompt) {
    return new Response(JSON.stringify({ success: true, skipped: true }), { status: 200 });
  }

  const content = await callClaude(apiKey, prompt);
  if (!content) {
    return new Response(JSON.stringify({ error: "Kunne ikke generere kommentar" }), { status: 502 });
  }

  const { error: insertError } = await admin.from("tournament_commentary").insert({ tournament_id, content });
  if (insertError) {
    return new Response(JSON.stringify({ error: insertError.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
