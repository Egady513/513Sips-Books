import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

interface AlcoholEstimatePayload {
  total_bottles: number;
  breakdown: {
    wine?: number;
    beer?: number;
    spirits?: number;
    champagne?: number;
    seltzer?: number;
  };
  lead_id?: string | null;
  event_id?: string | null;
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const payload: AlcoholEstimatePayload = await req.json();

    // Validate required fields
    if (typeof payload.total_bottles !== 'number') {
      return new Response(
        JSON.stringify({ error: 'total_bottles is required and must be a number' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!payload.breakdown || typeof payload.breakdown !== 'object') {
      return new Response(
        JSON.stringify({ error: 'breakdown is required and must be an object' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Insert into alcohol_estimates table
    const { data, error } = await supabase
      .from('alcohol_estimates')
      .insert({
        lead_id: payload.lead_id || null,
        event_id: payload.event_id || null,
        total_bottles: payload.total_bottles,
        breakdown: payload.breakdown,
      })
      .select();

    if (error) {
      console.error('Database insert error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, estimate: data?.[0] }), {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
