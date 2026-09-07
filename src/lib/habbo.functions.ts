import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const hotelSchema = z
  .string()
  .regex(/^[a-z.]{2,6}$/)
  .default("com.br");

const nickSchema = z
  .string()
  .trim()
  .min(2)
  .max(30)
  .regex(/^[A-Za-z0-9_.:!@#$%^&*()\-=+-]+$/, "Nick inválido");

export type HabboPublicUser = {
  uniqueId: string;
  name: string;
  motto: string;
  figureString: string;
  memberSince: string;
  online: boolean;
  profileVisible: boolean;
  selectedBadges?: { code: string; name: string; description: string }[];
};

async function fetchHabboProfile(name: string, hotel: string): Promise<HabboPublicUser | null> {
  const url = `https://www.habbo.${hotel}/api/public/users?name=${encodeURIComponent(name)}`;
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "HabboFanSite/1.0" },
  });
  if (!response.ok) return null;
  const data = (await response.json()) as HabboPublicUser;
  if (!data || !data.name) return null;
  return data;
}

/** Busca pública de um nick no hotel escolhido. */
export const lookupHabboUser = createServerFn({ method: "POST" })
  .inputValidator((input: { name: string; hotel?: string }) =>
    z.object({ name: nickSchema, hotel: hotelSchema.optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const hotel = data.hotel ?? "com.br";
    const profile = await fetchHabboProfile(data.name, hotel);
    if (!profile) return { found: false as const };
    return {
      found: true as const,
      hotel,
      user: {
        uniqueId: profile.uniqueId,
        name: profile.name,
        motto: profile.motto ?? "",
        figureString: profile.figureString ?? "",
        memberSince: profile.memberSince ?? "",
        online: Boolean(profile.online),
        profileVisible: profile.profileVisible !== false,
        selectedBadges: profile.selectedBadges ?? [],
      },
    };
  });

function randomCode() {
  const digits = Math.floor(1000 + Math.random() * 9000);
  const letters = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `FS-VERIFY-${letters}${digits}`;
}

/** Passo 1: gera o código que deve ser colocado na missão do Habbo. */
export const startVerification = createServerFn({ method: "POST" })
  .inputValidator((input: { name: string; hotel?: string }) =>
    z.object({ name: nickSchema, hotel: hotelSchema.optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const hotel = data.hotel ?? "com.br";
    const profile = await fetchHabboProfile(data.name, hotel);
    if (!profile) {
      return { ok: false as const, error: "Nick não encontrado neste hotel." };
    }

    const code = randomCode();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin
      .from("verification_codes")
      .delete()
      .eq("habbo_username_lower", profile.name.toLowerCase())
      .eq("hotel", hotel);

    const { error } = await supabaseAdmin.from("verification_codes").insert({
      habbo_username_lower: profile.name.toLowerCase(),
      hotel,
      code,
    });
    if (error) return { ok: false as const, error: "Não foi possível gerar o código." };

    return {
      ok: true as const,
      code,
      hotel,
      name: profile.name,
      figureString: profile.figureString ?? "",
      currentMotto: profile.motto ?? "",
    };
  });

function syntheticEmail(name: string, hotel: string) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "-");
  return `${slug}.${hotel.replace(/\./g, "-")}@habbofansite.local`;
}

function randomPassword() {
  return `Fs${crypto.randomUUID()}${crypto.randomUUID()}`.slice(0, 48);
}

/** Passo 2: confere a missão e devolve credenciais de sessão para o fã-site. */
export const confirmVerification = createServerFn({ method: "POST" })
  .inputValidator((input: { name: string; hotel?: string }) =>
    z.object({ name: nickSchema, hotel: hotelSchema.optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const hotel = data.hotel ?? "com.br";
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: codeRow } = await supabaseAdmin
      .from("verification_codes")
      .select("*")
      .eq("habbo_username_lower", data.name.toLowerCase())
      .eq("hotel", hotel)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!codeRow) {
      return { ok: false as const, error: "Nenhum código ativo. Gere um novo código." };
    }
    if (new Date(codeRow.expires_at).getTime() < Date.now()) {
      return { ok: false as const, error: "Código expirado. Gere um novo código." };
    }

    const profile = await fetchHabboProfile(data.name, hotel);
    if (!profile) return { ok: false as const, error: "Nick não encontrado neste hotel." };

    if ((profile.motto ?? "").trim() !== codeRow.code) {
      return {
        ok: false as const,
        error: `A missão atual é "${profile.motto ?? ""}". Coloque exatamente ${codeRow.code} e tente de novo.`,
      };
    }

    const email = syntheticEmail(profile.name, hotel);
    const password = randomPassword();

    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("habbo_username_lower", profile.name.toLowerCase())
      .eq("hotel", hotel)
      .maybeSingle();

    let userId = existing?.id ?? null;

    if (userId) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
      if (error) return { ok: false as const, error: "Falha ao renovar a sessão." };
    } else {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { habbo_username: profile.name, hotel },
      });
      if (error || !created.user) {
        return { ok: false as const, error: "Falha ao criar a conta no fã-site." };
      }
      userId = created.user.id;
      await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "user" });
    }

    await supabaseAdmin.from("profiles").upsert({
      id: userId,
      habbo_username: profile.name,
      hotel,
      habbo_id: profile.uniqueId,
      avatar_look: profile.figureString ?? "",
      motto: profile.motto ?? "",
    });

    const { data: verifiedBadge } = await supabaseAdmin
      .from("badges")
      .select("id")
      .eq("code", "VERIFIED")
      .maybeSingle();
    if (verifiedBadge) {
      await supabaseAdmin
        .from("user_badges")
        .upsert({ user_id: userId, badge_id: verifiedBadge.id }, { onConflict: "user_id,badge_id" });
    }

    await supabaseAdmin
      .from("verification_codes")
      .delete()
      .eq("habbo_username_lower", profile.name.toLowerCase())
      .eq("hotel", hotel);

    return { ok: true as const, email, password, name: profile.name, hotel };
  });
