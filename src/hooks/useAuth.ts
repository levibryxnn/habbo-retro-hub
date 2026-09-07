import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type FanProfile = {
  id: string;
  habbo_username: string;
  hotel: string;
  avatar_look: string | null;
  motto: string | null;
  points: number;
  created_at: string;
};

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<FanProfile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (!nextSession) {
        setProfile(null);
        setRoles([]);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [{ data: profileRow }, { data: roleRows }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      if (cancelled) return;
      setProfile((profileRow as FanProfile) ?? null);
      setRoles((roleRows ?? []).map((r) => r.role as string));
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const isStaff = roles.includes("admin") || roles.includes("mod");

  return {
    session,
    user,
    profile,
    roles,
    isStaff,
    isAdmin: roles.includes("admin"),
    loading,
    signOut: () => supabase.auth.signOut(),
  };
}
