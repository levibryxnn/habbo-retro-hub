import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PixelPanel } from "./PixelPanel";
import { RadioPlayer } from "./RadioPlayer";
import { HabboAvatar } from "./HabboAvatar";

export function Sidebar() {
  const { data: topUsers } = useQuery({
    queryKey: ["top-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, habbo_username, hotel, avatar_look, points")
        .order("points", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <aside className="space-y-4">
      <PixelPanel title="Rádio do fã-site" variant="gold">
        <RadioPlayer />
      </PixelPanel>

      <PixelPanel title="Top usuários">
        {topUsers && topUsers.length > 0 ? (
          <ol className="space-y-2">
            {topUsers.map((item, index) => (
              <li key={item.id}>
                <Link
                  to="/nick/$username"
                  params={{ username: item.habbo_username }}
                  className="flex items-center gap-2 rounded-sm border-2 border-transparent px-1 py-1 hover:border-border-strong hover:bg-muted"
                >
                  <span className="font-pixel w-5 text-[0.6rem] text-muted-foreground">
                    {index + 1}
                  </span>
                  <HabboAvatar
                    username={item.habbo_username}
                    figure={item.avatar_look}
                    hotel={item.hotel}
                    headOnly
                    size="s"
                    className="h-8 w-auto"
                  />
                  <span className="truncate text-sm">{item.habbo_username}</span>
                  <span className="font-pixel ml-auto text-[0.55rem] text-secondary">
                    {item.points}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">
            Ninguém no ranking ainda. Valide seu nick e seja o primeiro!
          </p>
        )}
      </PixelPanel>

      <PixelPanel title="Atalhos rápidos">
        <ul className="space-y-1 text-sm">
          <li>
            <Link to="/forum" className="block rounded-sm px-2 py-1 hover:bg-muted">
              💬 Fórum completo
            </Link>
          </li>
          <li>
            <Link to="/eventos" className="block rounded-sm px-2 py-1 hover:bg-muted">
              🎉 Agenda de eventos
            </Link>
          </li>
          <li>
            <Link to="/entrar" className="block rounded-sm px-2 py-1 hover:bg-muted">
              ✅ Validar meu nick
            </Link>
          </li>
          <li>
            <a
              href="https://www.habbo.com.br"
              target="_blank"
              rel="noreferrer"
              className="block rounded-sm px-2 py-1 hover:bg-muted"
            >
              🏨 Ir para o hotel
            </a>
          </li>
        </ul>
      </PixelPanel>
    </aside>
  );
}
