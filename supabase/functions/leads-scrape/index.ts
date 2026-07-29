import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

/**
 * Google Maps leads scraper via SerpAPI (google_maps engine).
 * User provides their own SERPAPI_API_KEY as a secret so this is "free" (uses their free-tier quota).
 * Filters supported: keyword+location, hasWebsite (yes/no/any), hasPhone, min rating, min reviews.
 */
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
    const maxResults: number = Math.min(Number(body.maxResults || 40), 100);
    const saveAsLeads: boolean = body.saveAsLeads !== false;

    if (!workspace_id || !keyword) return json({ error: 'workspace_id and keyword are required' }, 400);

    const { data: mem } = await admin.from('workspace_members').select('user_id').eq('workspace_id', workspace_id).eq('user_id', user.id).maybeSingle();
    if (!mem) return json({ error: 'Not a workspace member' }, 403);

    // ===== Plan quota enforcement =====
    // Resolve owner + subscription
    const { data: ws } = await admin.from('workspaces').select('owner_id').eq('id', workspace_id).maybeSingle();
    const ownerId = ws?.owner_id;
    const { data: ownerProfile } = ownerId
      ? await admin.from('profiles').select('subscription_status').eq('user_id', ownerId).maybeSingle()
      : { data: null };
    const plan = String((ownerProfile as any)?.subscription_status || 'trial').toLowerCase();
    const BASE_LIMITS: Record<string, number> = { starter: 150, growth: 1000, business: 5000, trial: 30 };
    const baseAllowance = BASE_LIMITS[plan] ?? 30;

    // Month window (UTC)
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

    // Used = leads inserted this month with source='scraped'
    const { count: usedCount } = await admin.from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspace_id).eq('source', 'scraped')
      .gte('created_at', monthStart);

    // Top-ups purchased this month
    const { data: topups } = await admin.from('scrape_topups')
      .select('leads_granted').eq('workspace_id', workspace_id).eq('month_key', monthKey);
    const topupTotal = (topups || []).reduce((s: number, r: any) => s + (r.leads_granted || 0), 0);

    const totalAllowance = baseAllowance + topupTotal;
    const used = usedCount || 0;
    const remaining = Math.max(0, totalAllowance - used);

    if (remaining <= 0) {
      return json({
        error: 'quota_exceeded',
        message: `Monthly scraping limit reached (${used}/${totalAllowance}). Upgrade your plan or unlock 150 more leads for ₹299.`,
        plan, used, allowance: totalAllowance, remaining: 0,
      }, 402);
    }

    const apiKey = Deno.env.get('SERPAPI_API_KEY');
    if (!apiKey) return json({ error: 'SERPAPI_API_KEY not configured. Add it in Settings.' }, 400);

    const effectiveMax = Math.min(maxResults, remaining);
    const query = location ? `${keyword} in ${location}` : keyword;
    const results: any[] = [];
    let start = 0;
    while (results.length < effectiveMax && start < 100) {
      const url = new URL('https://serpapi.com/search.json');
      url.searchParams.set('engine', 'google_maps');
      url.searchParams.set('q', query);
      url.searchParams.set('type', 'search');
      url.searchParams.set('start', String(start));
      url.searchParams.set('api_key', apiKey);
      const resp = await fetch(url.toString());
      const data = await resp.json();
      if (!resp.ok || data.error) return json({ error: data.error || `SerpAPI ${resp.status}` }, 400);
      const local = data.local_results || [];
      if (local.length === 0) break;
      results.push(...local);
      start += 20;
      if (local.length < 20) break;
    }

    // Apply filters
    const filtered = results.filter((r: any) => {
      if (requirePhone && !r.phone) return false;
      if (hasWebsite === 'yes' && !r.website) return false;
      if (hasWebsite === 'no' && r.website) return false;
      if (minRating && (Number(r.rating || 0) < minRating)) return false;
      if (minReviews && (Number(r.reviews || 0) < minReviews)) return false;
      return true;
    }).slice(0, effectiveMax);

    const scraped = filtered.map((r: any) => ({
      name: r.title || 'Unknown',
      phone: r.phone || null,
      website: r.website || null,
      address: r.address || null,
      rating: r.rating || null,
      reviews: r.reviews || null,
      category: r.type || (r.types || [])[0] || null,
      place_id: r.place_id || null,
    }));

    let inserted = 0;
    if (saveAsLeads && scraped.length > 0) {
      // Deduplicate by phone within workspace
      const phones = scraped.map(s => s.phone).filter(Boolean) as string[];
      const { data: existing } = await admin.from('leads').select('phone').eq('workspace_id', workspace_id).in('phone', phones.length ? phones : ['__none__']);
      const existingSet = new Set(((existing as any[]) || []).map(e => e.phone));
      const rows = scraped.filter(s => !s.phone || !existingSet.has(s.phone)).map(s => ({
        workspace_id,
        name: s.name,
        phone: s.phone,
        source: 'scraped',
        status: 'new',
        tags: [s.category].filter(Boolean),
        notes: [s.address, s.website, s.rating ? `⭐ ${s.rating} (${s.reviews || 0} reviews)` : null].filter(Boolean).join(' • '),
      }));
      // Enforce remaining quota by trimming rows
      const capped = rows.slice(0, remaining);
      if (capped.length > 0) {
        const { error, count } = await admin.from('leads').insert(capped, { count: 'exact' });
        if (error) return json({ error: error.message, scraped }, 400);
        inserted = count || capped.length;
      }
    }

    return json({
      ok: true, total_found: results.length, matched: scraped.length, inserted,
      plan, used: used + inserted, allowance: totalAllowance,
      remaining: Math.max(0, totalAllowance - (used + inserted)),
      results: scraped,
    });
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 500);
  }
});
