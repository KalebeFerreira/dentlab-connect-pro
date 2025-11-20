import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, workType, teethNumbers, color } = await req.json();
    
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Unauthorized');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Check user subscription and usage limits
    const { data: subscription } = await supabaseClient
      .from('user_subscriptions')
      .select('plan_name, stripe_price_id')
      .eq('user_id', user.id)
      .single();

    // Get current month's usage
    const { data: usageData } = await supabaseClient
      .rpc('get_monthly_image_usage', { p_user_id: user.id });

    const currentUsage = usageData || 0;

    // Define plan limits - Plano Premium has unlimited images (0 = unlimited)
    const PLAN_LIMITS: Record<string, number> = {
      'price_1QYkYUBNMuaYAZcYu12VIrpZ': 60, // Plano Profissional (antigo)
      'price_1SVYyx2X6ylDIgld3AQAlS8h': 60, // Plano Profissional (novo)
      'price_1SVYsz2X6ylDIgldiuS3Yh2z': 0,  // Plano Premium - ilimitado
    };

    // Check if user has reached their limit (skip check for unlimited plans)
    if (subscription?.stripe_price_id && PLAN_LIMITS[subscription.stripe_price_id] !== undefined) {
      const limit = PLAN_LIMITS[subscription.stripe_price_id];
      if (limit > 0 && currentUsage >= limit) {
        return new Response(
          JSON.stringify({ 
            error: `Você atingiu o limite de ${limit} imagens por mês do seu plano. Faça upgrade para continuar gerando imagens.`
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    console.log('Generating dental image with prompt:', prompt);

    if (!prompt) {
      throw new Error('Prompt is required');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Enhance prompt with dental context
    const enhancedPrompt = `Professional dental visualization: ${prompt}. 
    ${workType ? `Type of work: ${workType}.` : ''} 
    ${teethNumbers ? `Teeth numbers: ${teethNumbers}.` : ''} 
    ${color ? `Color: ${color}.` : ''}
    High quality, clinical, professional dental photography style, well-lit, clean background.`;

    console.log('Enhanced prompt:', enhancedPrompt);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image-preview',
        messages: [
          {
            role: 'user',
            content: enhancedPrompt
          }
        ],
        modalities: ['image', 'text']
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to your Lovable AI workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`AI Gateway error: ${errorText}`);
    }

    const data = await response.json();
    console.log('AI response received');

    // Extract the generated image from the response
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageUrl) {
      console.error('No image in response:', JSON.stringify(data));
      throw new Error('No image generated in response');
    }

    // Increment usage counter after successful generation
    await supabaseClient.rpc('increment_image_usage', { p_user_id: user.id });

    // Calculate usage info for response
    const planLimit = subscription?.stripe_price_id && PLAN_LIMITS[subscription.stripe_price_id] !== undefined
      ? PLAN_LIMITS[subscription.stripe_price_id]
      : null;
    
    const isUnlimited = planLimit === 0;

    return new Response(
      JSON.stringify({ 
        imageUrl,
        message: data.choices?.[0]?.message?.content || 'Image generated successfully',
        usageCount: currentUsage + 1,
        usageLimit: isUnlimited ? null : planLimit,
        isUnlimited
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-dental-image function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to generate image'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
