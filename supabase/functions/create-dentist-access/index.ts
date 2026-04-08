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
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
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

    // Check if user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers.users.find(u => u.email === email);
    
    let userId: string;
    let isExistingUser = false;
    
    if (existingUser) {
      isExistingUser = true;
      userId = existingUser.id;

      // SECURITY: Only allow linking if the existing user is already a dentist of THIS owner
      // or has no dentist record yet
      const { data: existingDentist } = await supabase
        .from('dentists')
        .select('user_id')
        .eq('user_id', existingUser.id)
        .eq('auth_enabled', true)
        .maybeSingle();

      if (existingDentist && existingDentist.user_id !== user.id) {
        return new Response(
          JSON.stringify({ error: 'Este email já está vinculado a outro laboratório/clínica' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if user has protected roles - prevent account takeover
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', existingUser.id);

      const hasProtectedRole = userRoles?.some(r => r.role === 'clinic' || r.role === 'laboratory' || r.role === 'admin');
      if (hasProtectedRole) {
        return new Response(
          JSON.stringify({ error: 'Este email já está registrado como outro tipo de usuário' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: updatePasswordError } = await supabase.auth.admin.updateUserById(
        userId,
        { 
          password,
          user_metadata: { name: name || dentist.name }
        }
      );
      
      if (updatePasswordError) throw updatePasswordError;
    } else {
      const { data: authData, error: signUpError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: name || dentist.name }
      });

      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error('Failed to create user');
      
      userId = authData.user.id;
    }

    // Link dentist to auth user
    const { error: updateError } = await supabase
      .from("dentists")
      .update({ user_id: userId, auth_enabled: true })
      .eq("id", dentistId);

    if (updateError) throw updateError;

    // Check if role already exists
    const { data: existingRole } = await supabase
      .from("user_roles")
      .select('id')
      .eq('user_id', userId)
      .eq('role', 'dentist')
      .maybeSingle();

    if (!existingRole) {
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: 'dentist' });

      if (roleError) throw roleError;
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: isExistingUser 
          ? 'Dentista vinculado ao usuário existente com sucesso' 
          : 'Acesso criado com sucesso',
        user_id: userId
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
