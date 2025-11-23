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
    
    console.log('Request data:', { dentistId, email: email ? 'provided' : 'missing', hasPassword: !!password });

    // Verify dentist belongs to requesting user
    const { data: dentist, error: dentistError } = await supabase
      .from('dentists')
      .select('*')
      .eq('id', dentistId)
      .eq('user_id', user.id)
      .single();

    if (dentistError || !dentist) {
      console.error('Dentist not found:', dentistError);
      return new Response(
        JSON.stringify({ error: 'Dentista não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Dentist found:', dentist.name);

    // Check if user already exists
    console.log('Checking if user exists with email:', email);
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers.users.find(u => u.email === email);
    
    console.log('Existing user found:', !!existingUser);
    
    let userId: string;
    let isExistingUser = false;
    
    if (existingUser) {
      console.log('User already exists with id:', existingUser.id);
      isExistingUser = true;
      userId = existingUser.id;
      
      // Update password for existing user
      console.log('Updating password for existing user');
      const { error: updatePasswordError } = await supabase.auth.admin.updateUserById(
        userId,
        { 
          password,
          user_metadata: {
            name: name || dentist.name,
          }
        }
      );
      
      if (updatePasswordError) {
        console.error('Error updating user password:', updatePasswordError);
        throw updatePasswordError;
      }
      
      console.log('Password updated successfully');
    } else {
      console.log('Creating new user with email:', email);
      // Create new auth user
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
      
      console.log('New user created with id:', authData.user.id);
      userId = authData.user.id;
    }

    console.log('Linking dentist to user_id:', userId);
    // Link dentist to auth user
    const { error: updateError } = await supabase
      .from("dentists")
      .update({
        user_id: userId,
        auth_enabled: true
      })
      .eq("id", dentistId);

    if (updateError) {
      console.error('Error updating dentist:', updateError);
      throw updateError;
    }
    
    console.log('Dentist linked successfully');

    // Check if role already exists
    console.log('Checking if dentist role exists for user');
    const { data: existingRole } = await supabase
      .from("user_roles")
      .select('id')
      .eq('user_id', userId)
      .eq('role', 'dentist')
      .single();

    console.log('Existing role found:', !!existingRole);

    // Only create role if it doesn't exist
    if (!existingRole) {
      console.log('Creating dentist role');
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: userId,
          role: 'dentist'
        });

      if (roleError) {
        console.error('Error creating role:', roleError);
        throw roleError;
      }
      console.log('Role created successfully');
    } else {
      console.log('Role already exists, skipping creation');
    }

    console.log('Operation completed successfully');
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
