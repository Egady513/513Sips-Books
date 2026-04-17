import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { imageBase64, mediaType } = await req.json()
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: 'imageBase64 required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
    if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured')

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType || 'image/jpeg',
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: `You are a receipt scanner for a mobile bartending business expense tracker. Extract key information from this receipt and return ONLY a valid JSON object (no markdown, no code blocks, no explanation):

{
  "vendor": "store or company name",
  "amount": 0.00,
  "date": "YYYY-MM-DD or null",
  "description": "brief 1-sentence description of what was purchased",
  "category": "one of: alcohol_mixers | equipment_supplies | travel_mileage | insurance_licenses | marketing | office | professional | employees | other"
}

Category guide:
- alcohol_mixers: alcohol, beer, wine, mixers, garnishes, drink supplies
- equipment_supplies: bar tools, cups, napkins, ice, straws, supplies
- marketing: printing, business cards, ads, social media, design
- office: software, phone, subscriptions, internet, home office
- travel_mileage: gas, uber, parking, transport
- insurance_licenses: insurance, licenses, permits
- professional: accountant, lawyer, consulting fees
- employees: staff pay, contractor payments
- other: anything else

Rules:
- amount = final total paid (after tax), as a decimal number
- If a field cannot be determined, use null
- Return ONLY the JSON object, nothing else`,
            },
          ],
        }],
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Anthropic API error ${response.status}: ${errText}`)
    }

    const apiData = await response.json()
    const rawText = apiData.content?.[0]?.text?.trim() || ''

    // Strip any accidental markdown code fences
    const jsonText = rawText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
    const extracted = JSON.parse(jsonText)

    return new Response(JSON.stringify({ success: true, ...extracted }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('OCR error:', message)
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
