import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization')!;
    
    // Create service role client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify the JWT token and get user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error('Authentication failed:', userError);
      throw new Error('Unauthorized');
    }

    const { dentistId, email, password, name } = await req.json();

    // Verify dentist belongs to requesting user
    const { data: dentist, error: dentistError } = await supabase
      .from('dentists')
      .select('*')
      .eq('id', dentistId)
      .eq('user_id', user.id)
      .single();

    if (dentistError || !dentist) {
      return new Response(
        JSON.stringify({ error: 'Dentista não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create auth user using admin API
    const { data: authData, error: signUpError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name: name || dentist.name,
      }
    });

    if (signUpError) {
      console.error('Error creating user:', signUpError);
      throw signUpError;
    }

    if (!authData.user) {
      throw new Error('Failed to create user');
    }

    // Link dentist to auth user
    const { error: updateError } = await supabase
      .from("dentists")
      .update({
        user_id: authData.user.id,
        auth_enabled: true
      })
      .eq("id", dentistId);

    if (updateError) {
      console.error('Error updating dentist:', updateError);
      throw updateError;
    }

    // Create dentist role
    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({
        user_id: authData.user.id,
        role: 'dentist'
      });

    if (roleError) {
      console.error('Error creating role:', roleError);
      throw roleError;
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Acesso criado com sucesso',
        user_id: authData.user.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
