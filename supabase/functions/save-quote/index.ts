import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

interface SaveQuotePayload {
  leadId: string;
  total: number;
  deposit: number;
  balance: number;
  guestCount?: number;
  hours?: number;
  bartenders?: number;
  eventDate?: string;
  breakdown?: unknown;
  promoCode?: string;
  addonNotes?: string;   // multi-event: "Event 1 — Name: $500\nEvent 2 — Name: $750"
  validUntil?: string;   // YYYY-MM-DD
  status?: 'draft' | 'sent' | 'accepted' | 'declined';
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const payload: SaveQuotePayload = await req.json();

    if (!payload.leadId) {
      return json({ error: 'leadId is required' }, 400);
    }
    if (typeof payload.total !== 'number' || payload.total <= 0) {
      return json({ error: 'total must be a positive number' }, 400);
    }

    // Default valid_until to 30 days from now if not provided
    const validUntil = payload.validUntil || (() => {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      return d.toISOString().split('T')[0];
    })();

    const firstVersion = {
      versionNum: 1,
      total: payload.total,
      deposit: payload.deposit,
      balance: payload.balance,
      status: payload.status || 'draft',
      created_at: new Date().toISOString(),
    };

    const quoteRecord = {
      lead_id: payload.leadId,
      total: payload.total,
      deposit: payload.deposit,
      balance: payload.balance,
      guest_count: payload.guestCount ?? null,
      hours: payload.hours ?? null,
      bartenders: payload.bartenders ?? null,
      event_date: payload.eventDate ?? null,
      breakdown: payload.breakdown ?? null,
      promo_code: payload.promoCode ?? null,
      addon_notes: payload.addonNotes ?? null,
      valid_until: validUntil,
      status: payload.status || 'draft',
      version_history: [firstVersion],
    };

    const { data: quote, error: insertError } = await supabase
      .from('quotes')
      .insert([quoteRecord])
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return json({ error: insertError.message }, 500);
    }

    // Update lead status to 'quoted' (only if currently 'new')
    await supabase
      .from('leads')
      .update({ status: 'quoted' })
      .eq('id', payload.leadId)
      .eq('status', 'new');

    return json({ success: true, quote }, 201);
  } catch (err) {
    console.error('Function error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
});
