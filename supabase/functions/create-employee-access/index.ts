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

    const { employeeId, email, password, name } = await req.json();

    // Verify employee belongs to requesting user
    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('*')
      .eq('id', employeeId)
      .eq('user_id', user.id)
      .single();

    if (employeeError || !employee) {
      return new Response(
        JSON.stringify({ error: 'Funcionário não encontrado' }),
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
      
      const { error: updatePasswordError } = await supabase.auth.admin.updateUserById(
        userId,
        { 
          password,
          user_metadata: { name: name || employee.name }
        }
      );
      
      if (updatePasswordError) throw updatePasswordError;
    } else {
      const { data: authData, error: signUpError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: name || employee.name }
      });

      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error('Failed to create user');
      
      userId = authData.user.id;
    }

    // Link employee to auth user
    const { error: updateError } = await supabase
      .from("employees")
      .update({ auth_user_id: userId, auth_enabled: true })
      .eq("id", employeeId);

    if (updateError) throw updateError;

    // Check if role already exists
    const { data: existingRole } = await supabase
      .from("user_roles")
      .select('id')
      .eq('user_id', userId)
      .eq('role', 'employee')
      .single();

    if (!existingRole) {
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: 'employee' });

      if (roleError) throw roleError;
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: isExistingUser 
          ? 'Funcionário vinculado ao usuário existente' 
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
