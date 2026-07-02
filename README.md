# 🏓 Super Duper Bordtennis

Kampstatistikk, Elo-rating og topplister for kontorets bordtennis-liga.

## Stack

- **Frontend:** Vite + React + TypeScript + Tailwind CSS, hostet på GitHub Pages
- **Backend:** [Supabase](https://supabase.com) (Postgres + Auth + Row Level Security)

Supabase-prosjekt ref: `boragvnduwxbnitxdxuu` (region `eu-central-1`).

## Kom i gang lokalt

```bash
npm install
npm run dev
```

Kopier `.env.example` til `.env` (allerede gjort lokalt) med Supabase-URL og anon-nøkkel.

## Funksjonalitet

- **Invitasjonsbasert**: kun inviterte kan logge inn (offentlig signup er stengt) — enhver innlogget spiller kan invitere kollegaer via e-post
- Innlogging med magic link (Supabase Auth), spilleren velger selv navn/avatar første gang
- Registrere kamp med settscore (best av 1/3/5) — motstanderen må **bekrefte** resultatet før det telles
- Automatisk **Elo-rating** (K-faktor 48 for nye spillere, 32 etter 10 kamper)
- Topplist med filter for alle tider / måned / kvartal
- Spillerprofil med rating-graf over tid, form, streak og prestasjoner
- Head-to-head-sammenligning mellom to spillere
- Achievements/badges: første seier, seiersrekker, Giant Slayer, Comeback King
- QR-kode-side for rask tilgang ved bordet
- Dark mode og PWA (installerbar på mobil)

## Deploy til GitHub Pages

1. Opprett et GitHub-repo og push denne koden til `main`.
2. Under repo **Settings → Pages**, sett Source til **GitHub Actions**.
3. Under repo **Settings → Secrets and variables → Actions**, legg til:
   - `VITE_SUPABASE_URL` = `https://boragvnduwxbnitxdxuu.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = (publishable/anon-nøkkelen, se `.env.example`)
4. Push til `main` — GitHub Actions-workflowen (`.github/workflows/deploy.yml`) bygger og deployer automatisk.

Appen blir tilgjengelig på `https://tehmendel.github.io/super-duper-Bordtennis/`.

## Sikkerhet: steng offentlig registrering

Repoet er offentlig, så det er viktig å sikre at ingen kan opprette en konto selv. Klienten ber allerede om
`shouldCreateUser: false`, men den ekte sperren må stå på serversiden:

1. I Supabase-dashbordet: **Authentication → Sign In / Providers → Email**, slå av **"Allow new users to sign up"**.

Etter dette kan kun brukere som er invitert via `invite-player`-funksjonen (se under "Mer → Inviter spiller" i appen)
logge inn.

## Database

Skjema og RLS-policies er satt opp direkte i Supabase-prosjektet (migrasjoner `init_schema` og
`restrict_trigger_function_execute`). Bruk Supabase Studio eller `supabase db diff` for videre endringer.

Edge-funksjonen `invite-player` (kilde i `supabase/functions/invite-player/`) sender Supabase sin innebygde
invitasjons-e-post via service role-nøkkelen — den er aldri eksponert til klienten. Alle innloggede spillere kan
kalle den fra "Mer → Inviter spiller".
