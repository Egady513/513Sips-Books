import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

interface SaveContractPayload {
  leadId: string;
  contractPDF: string; // base64-encoded PDF
  isUnsigned: boolean;
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
    const payload: SaveContractPayload = await req.json();

    // Validate required fields
    if (!payload.leadId) {
      return new Response(
        JSON.stringify({ error: 'leadId is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!payload.contractPDF) {
      return new Response(
        JSON.stringify({ error: 'contractPDF is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (typeof payload.isUnsigned !== 'boolean') {
      return new Response(
        JSON.stringify({ error: 'isUnsigned must be a boolean' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Decode base64 to binary
    const binaryString = atob(payload.contractPDF);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const file = new File([bytes], 'contract.pdf', { type: 'application/pdf' });

    // Generate file path with timestamp
    const timestamp = new Date().getTime();
    const prefix = payload.isUnsigned ? 'unsigned' : 'signed';
    const filePath = `contracts/${payload.leadId}/${prefix}_${timestamp}.pdf`;

    // Upload to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from('contracts')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return new Response(JSON.stringify({ error: uploadError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('contracts')
      .getPublicUrl(filePath);

    // Update leads table with the contract URL
    const fieldToUpdate = payload.isUnsigned ? 'unsigned_contract_url' : 'signed_contract_url';
    const { error: updateError } = await supabase
      .from('leads')
      .update({ [fieldToUpdate]: publicUrl })
      .eq('id', payload.leadId);

    if (updateError) {
      console.error('Database update error:', updateError);
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        contractUrl: publicUrl,
        contractId: filePath,
      }),
      {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
