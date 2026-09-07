import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { startVerification, confirmVerification } from "@/lib/habbo.functions";
import { supabase } from "@/integrations/supabase/client";
import { PixelPanel } from "@/components/habbo/PixelPanel";
import { PixelButton } from "@/components/habbo/PixelButton";
import { HabboAvatar } from "@/components/habbo/HabboAvatar";
import { HOTELS, DEFAULT_HOTEL } from "@/lib/habbo";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/entrar")({
  head: () => ({
    meta: [
      { title: "Validar nick — Bobba Fansite" },
      {
        name: "description",
        content:
          "Entre no fã-site sem senha: coloque o código na sua missão do Habbo e valide o seu nick.",
      },
      { property: "og:title", content: "Validar nick do Habbo — Bobba Fansite" },
      {
        property: "og:description",
        content: "Login por missão: rápido, seguro e sem pedir a senha do Habbo.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const start = useServerFn(startVerification);
  const confirm = useServerFn(confirmVerification);

  const [nick, setNick] = useState("");
  const [hotel, setHotel] = useState<string>(DEFAULT_HOTEL);
  const [code, setCode] = useState<string | null>(null);
  const [figure, setFigure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleStart = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!nick.trim()) return;
    setBusy(true);
    try {
      const result = await start({ data: { name: nick.trim(), hotel } });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCode(result.code);
      setFigure(result.figureString || null);
      toast.success("Código gerado! Coloque na sua missão.");
    } catch {
      toast.error("Não foi possível falar com o hotel agora.");
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async () => {
    setBusy(true);
    try {
      const result = await confirm({ data: { name: nick.trim(), hotel } });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: result.email,
        password: result.password,
      });
      if (error) {
        toast.error("Nick validado, mas a sessão falhou. Tente novamente.");
        return;
      }
      toast.success(`Bem-vindo, ${result.name}!`);
      navigate({ to: "/nick/$username", params: { username: result.name } });
    } catch {
      toast.error("Não foi possível validar agora.");
    } finally {
      setBusy(false);
    }
  };

  if (user && profile) {
    return (
      <PixelPanel title="Você já está conectado" variant="gold" bodyClassName="space-y-3">
        <div className="flex items-center gap-3">
          <HabboAvatar
            username={profile.habbo_username}
            figure={profile.avatar_look}
            hotel={profile.hotel}
            className="h-24 w-auto"
          />
          <div>
            <p className="font-pixel text-[0.7rem]">{profile.habbo_username}</p>
            <p className="text-sm text-muted-foreground">{profile.motto || "sem missão"}</p>
          </div>
        </div>
        <PixelButton variant="grey" size="sm" onClick={() => signOut()}>
          Sair da conta
        </PixelButton>
      </PixelPanel>
    );
  }

  return (
    <>
      <PixelPanel title="Validação por missão" variant="gold" bodyClassName="space-y-3">
        <p className="text-sm">
          O fã-site <strong>nunca pede a senha do Habbo</strong>. Para provar que a conta é sua,
          basta colocar um código temporário na sua missão dentro do jogo.
        </p>

        <form onSubmit={handleStart} className="flex flex-wrap items-end gap-2">
          <label className="flex-1 text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">Seu nick</span>
            <input
              value={nick}
              onChange={(event) => setNick(event.target.value)}
              placeholder="Ex.: Bobba.Master"
              className="w-full rounded-sm border-2 border-border-strong bg-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">Hotel</span>
            <select
              value={hotel}
              onChange={(event) => setHotel(event.target.value)}
              className="rounded-sm border-2 border-border-strong bg-input px-3 py-2 text-sm"
            >
              {HOTELS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.flag} {item.label}
                </option>
              ))}
            </select>
          </label>
          <PixelButton type="submit" disabled={busy}>
            Gerar código
          </PixelButton>
        </form>
      </PixelPanel>

      {code && (
        <PixelPanel title="Passo 2 — coloque na missão" bodyClassName="space-y-3">
          <div className="flex flex-wrap items-center gap-4">
            <HabboAvatar username={nick} figure={figure} hotel={hotel} className="h-28 w-auto" />
            <div className="space-y-2">
              <p className="text-sm">Altere a sua missão dentro do jogo para:</p>
              <p className="pixel-panel-sm bg-primary px-3 py-2 font-pixel text-[0.8rem] text-primary-foreground">
                {code}
              </p>
              <p className="text-xs text-muted-foreground">
                Depois de salvar a missão no hotel, volte aqui e clique em Validar. O código expira
                em 30 minutos.
              </p>
              <div className="flex gap-2">
                <PixelButton variant="success" onClick={handleConfirm} disabled={busy}>
                  Validar
                </PixelButton>
                <PixelButton
                  variant="grey"
                  onClick={() => navigator.clipboard?.writeText(code)}
                  type="button"
                >
                  Copiar código
                </PixelButton>
              </div>
            </div>
          </div>
        </PixelPanel>
      )}
    </>
  );
}
