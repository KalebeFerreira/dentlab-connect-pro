import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type UserRole = "admin" | "clinic" | "laboratory" | "dentist" | "employee";

const getFallbackRoleFromMetadata = (metadata?: Record<string, any>): UserRole | null => {
  const role = metadata?.role;
  const userType = metadata?.user_type;

  if (role === "admin" || role === "clinic" || role === "laboratory" || role === "dentist" || role === "employee") {
    return role;
  }

  if (userType === "clinic" || userType === "laboratory") {
    return userType;
  }

  return null;
};

export const useUserRole = () => {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRole = async () => {
      if (authLoading) return;

      if (!user) {
        setRole(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          console.error("Error fetching user role:", error);
          setRole(getFallbackRoleFromMetadata(user.user_metadata));
        } else {
          setRole((data?.role as UserRole) ?? getFallbackRoleFromMetadata(user.user_metadata));
        }
      } catch (error) {
        console.error("Error in fetchRole:", error);
        setRole(getFallbackRoleFromMetadata(user.user_metadata));
      } finally {
        setLoading(false);
      }
    };

    fetchRole();
  }, [user, authLoading]);

  return {
    role,
    loading,
    isAdmin: role === "admin",
    isClinic: role === "clinic",
    isLaboratory: role === "laboratory",
    isDentist: role === "dentist",
    isEmployee: role === "employee"
  };
};
