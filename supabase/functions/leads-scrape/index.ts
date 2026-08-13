import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

type Biz = {
  name: string; phone: string | null; website: string | null; address: string | null;
  rating: number | null; reviews: number | null; category: string | null; place_id: string | null;
  city: string | null; temperature: 'hot' | 'warm' | 'cold'; score: number;
};

/** Lead temperature scoring — no website + reachable phone + good ratings = hottest prospect. */
function score(r: { phone?: any; website?: any; rating?: any; reviews?: any }) {
  let s = 0;
  if (!r.website) s += 2;
  if (r.phone) s += 1;
  if (Number(r.rating || 0) >= 4) s += 1;
  if (Number(r.reviews || 0) >= 20) s += 1;
  const temperature: 'hot' | 'warm' | 'cold' = s >= 4 ? 'hot' : s >= 2 ? 'warm' : 'cold';
  return { s, temperature };
}

function cityFrom(address?: string | null, fallback?: string) {
  if (!address) return fallback?.trim() || null;
  const parts = String(address).split(',').map(p => p.trim()).filter(Boolean);
  // second-from-last chunk is usually the city ("street, City, State 123456, Country")
  return (parts.length >= 3 ? parts[parts.length - 3] : parts[0]) || fallback?.trim() || null;
}

/** SerpAPI google_maps engine (platform key or the workspace's own key). */
async function fetchSerpApi(apiKey: string, query: string, max: number) {
  const out: any[] = [];
  let start = 0;
  while (out.length < max && start < 100) {
    const url = new URL('https://serpapi.com/search.json');
    url.searchParams.set('engine', 'google_maps');
    url.searchParams.set('q', query);
    url.searchParams.set('type', 'search');
    url.searchParams.set('start', String(start));
    url.searchParams.set('api_key', apiKey);
    const resp = await fetch(url.toString());
    const data = await resp.json();
    if (!resp.ok || data.error) throw new Error(data.error || `SerpAPI ${resp.status}`);
    const local = data.local_results || [];
    if (local.length === 0) break;
    out.push(...local.map((r: any) => ({
      title: r.title, phone: r.phone, website: r.website, address: r.address,
      rating: r.rating, reviews: r.reviews, type: r.type || (r.types || [])[0], place_id: r.place_id,
    })));
    start += 20;
    if (local.length < 20) break;
  }
  return out;
}

/** Apify Google Maps scraper (user's own free-tier token). */
async function fetchApify(token: string, actor: string, keyword: string, location: string, max: number) {
  const actorId = (actor || 'compass~crawler-google-places').replace('/', '~');
  const resp = await fetch(
    `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        searchStringsArray: [keyword],
        locationQuery: location || undefined,
        maxCrawledPlacesPerSearch: max,
        language: 'en',
        skipClosedPlaces: true,
      }),
    },
  );
  const text = await resp.text();
  if (!resp.ok) throw new Error(`Apify ${resp.status}: ${text.slice(0, 300)}`);
  const items = JSON.parse(text || '[]');
  return (Array.isArray(items) ? items : []).map((r: any) => ({
    title: r.title || r.name,
    phone: r.phone || r.phoneUnformatted || null,
    website: r.website || null,
    address: r.address || r.street || null,
    rating: r.totalScore ?? r.rating ?? null,
    reviews: r.reviewsCount ?? null,
    type: r.categoryName || (r.categories || [])[0] || null,
    place_id: r.placeId || null,
  }));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  try {
    const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    if (!jwt) return json({ error: 'Unauthorized' }, 401);
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: userData } = await admin.auth.getUser(jwt);
    const user = userData?.user;
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json();
    const workspace_id: string = body.workspace_id;
    const keyword: string = (body.keyword || '').trim();
    const location: string = (body.location || '').trim();
    const hasWebsite: 'yes' | 'no' | 'any' = body.hasWebsite || 'any';
    const requirePhone: boolean = !!body.requirePhone;
    const minRating: number = Number(body.minRating || 0);
    const minReviews: number = Number(body.minReviews || 0);
    const temperatures: string[] = Array.isArray(body.temperatures) ? body.temperatures : [];
    const maxResults: number = Math.min(Number(body.maxResults || 40), 200);
    const saveAsLeads: boolean = body.saveAsLeads !== false;

    if (!workspace_id || !keyword) return json({ error: 'workspace_id and keyword are required' }, 400);

    const { data: mem } = await admin.from('workspace_members').select('user_id').eq('workspace_id', workspace_id).eq('user_id', user.id).maybeSingle();
    if (!mem) return json({ error: 'Not a workspace member' }, 403);

    // ===== Bring-your-own scraper key (free — no platform quota) =====
    const { data: own } = await admin.from('scraper_settings')
      .select('provider,api_key,actor_id,enabled').eq('workspace_id', workspace_id).maybeSingle();
    const byo = !!(own?.enabled && own?.api_key);

    // ===== Plan quota (only when using our scraper) =====
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    let plan = 'byo';
    let totalAllowance = maxResults;
    let used = 0;
    let remaining = maxResults;

    if (!byo) {
      const { data: ws } = await admin.from('workspaces').select('owner_id').eq('id', workspace_id).maybeSingle();
      const ownerId = ws?.owner_id;
      const { data: ownerProfile } = ownerId
        ? await admin.from('profiles').select('subscription_status').eq('user_id', ownerId).maybeSingle()
        : { data: null };
      plan = String((ownerProfile as any)?.subscription_status || 'trial').toLowerCase();
      const BASE_LIMITS: Record<string, number> = { starter: 150, growth: 1000, business: 5000, trial: 30 };
      const baseAllowance = BASE_LIMITS[plan] ?? 30;

      const { count: usedCount } = await admin.from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspace_id).eq('source', 'scraped')
        .gte('created_at', monthStart);

      const { data: topups } = await admin.from('scrape_topups')
        .select('leads_granted').eq('workspace_id', workspace_id).eq('month_key', monthKey);
      const topupTotal = (topups || []).reduce((s: number, r: any) => s + (r.leads_granted || 0), 0);

      totalAllowance = baseAllowance + topupTotal;
      used = usedCount || 0;
      remaining = Math.max(0, totalAllowance - used);

      if (remaining <= 0) {
        return json({
          error: 'quota_exceeded',
          message: `Monthly scraping limit reached (${used}/${totalAllowance}). Top up at ₹1 per lead, upgrade your plan, or connect your own free scraper API key.`,
          plan, used, allowance: totalAllowance, remaining: 0,
        }, 402);
      }
    }

    const effectiveMax = Math.min(maxResults, remaining);
    const query = location ? `${keyword} in ${location}` : keyword;

    let raw: any[] = [];
    let provider = 'serpapi';
    try {
      if (byo && own!.provider === 'apify') {
        provider = 'apify';
        raw = await fetchApify(own!.api_key!, own!.actor_id || '', keyword, location, effectiveMax);
      } else if (byo) {
        raw = await fetchSerpApi(own!.api_key!, query, effectiveMax);
      } else {
        const apiKey = Deno.env.get('SERPAPI_API_KEY');
        if (!apiKey) return json({ error: 'Scraper is not configured yet. Add your own free Apify/SerpAPI key in the "My API key" tab.' }, 400);
        raw = await fetchSerpApi(apiKey, query, effectiveMax);
      }
    } catch (e: any) {
      return json({ error: String(e?.message || e) }, 400);
    }

    // Filters + enrichment
    const enriched: Biz[] = raw.map((r: any) => {
      const { s, temperature } = score(r);
      return {
        name: r.title || 'Unknown',
        phone: r.phone || null,
        website: r.website || null,
        address: r.address || null,
        rating: r.rating ?? null,
        reviews: r.reviews ?? null,
        category: r.type || null,
        place_id: r.place_id || null,
        city: cityFrom(r.address, location),
        temperature, score: s,
      };
    });

    const filtered = enriched.filter((r) => {
      if (requirePhone && !r.phone) return false;
      if (hasWebsite === 'yes' && !r.website) return false;
      if (hasWebsite === 'no' && r.website) return false;
      if (minRating && Number(r.rating || 0) < minRating) return false;
      if (minReviews && Number(r.reviews || 0) < minReviews) return false;
      if (temperatures.length && !temperatures.includes(r.temperature)) return false;
      return true;
    })
      .sort((a, b) => b.score - a.score)
      .slice(0, effectiveMax);

    let inserted = 0;
    if (saveAsLeads && filtered.length > 0) {
      const phones = filtered.map(s => s.phone).filter(Boolean) as string[];
      const { data: existing } = await admin.from('leads').select('phone').eq('workspace_id', workspace_id).in('phone', phones.length ? phones : ['__none__']);
      const existingSet = new Set(((existing as any[]) || []).map(e => e.phone));
      const rows = filtered.filter(s => !s.phone || !existingSet.has(s.phone)).map(s => ({
        workspace_id,
        name: s.name,
        phone: s.phone,
        source: 'scraped',
        status: 'new',
        tags: [s.temperature, s.city, s.category].filter(Boolean),
        notes: [
          s.address,
          s.website ? `🌐 ${s.website}` : 'No website',
          s.rating ? `⭐ ${s.rating} (${s.reviews || 0} reviews)` : null,
          `Lead score ${s.score}/5 · ${s.temperature.toUpperCase()}`,
        ].filter(Boolean).join(' • '),
      }));
      const capped = byo ? rows : rows.slice(0, remaining);
      if (capped.length > 0) {
        const { error, count } = await admin.from('leads').insert(capped, { count: 'exact' });
        if (error) return json({ error: error.message, results: filtered }, 400);
        inserted = count || capped.length;
      }
    }

    return json({
      ok: true, provider, byo,
      total_found: raw.length, matched: filtered.length, inserted,
      breakdown: {
        hot: filtered.filter(f => f.temperature === 'hot').length,
        warm: filtered.filter(f => f.temperature === 'warm').length,
        cold: filtered.filter(f => f.temperature === 'cold').length,
      },
      plan, used: used + inserted, allowance: totalAllowance,
      remaining: byo ? null : Math.max(0, totalAllowance - (used + inserted)),
      results: filtered,
    });
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 500);
  }
});
