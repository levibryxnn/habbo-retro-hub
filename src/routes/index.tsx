import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PixelPanel } from "@/components/habbo/PixelPanel";
import { HabboAvatar } from "@/components/habbo/HabboAvatar";
import { ReactionBar } from "@/components/habbo/ReactionBar";
import { PixelButton } from "@/components/habbo/PixelButton";
import { formatDateTime, timeAgo } from "@/lib/habbo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bobba Fansite — Notícias e rádio do Habbo Hotel" },
      {
        name: "description",
        content:
          "Últimas notícias do Habbo Hotel, rádio ao vivo, eventos do hotel e fórum da comunidade.",
      },
      { property: "og:title", content: "Bobba Fansite — Notícias do Habbo Hotel" },
      {
        property: "og:description",
        content: "Notícias, rádio, fórum e eventos do Habbo Hotel em um só lugar.",
      },
    ],
  }),
  component: HomePage,
});

type NewsRow = {
  id: string;
  title: string;
  content: string;
  created_at: string;
  categories: { name: string; color: string; slug: string } | null;
  profiles: { habbo_username: string; hotel: string; avatar_look: string | null } | null;
};

function HomePage() {
  const { data: news, isLoading } = useQuery({
    queryKey: ["news-feed"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("topics")
        .select(
          "id, title, content, created_at, categories!inner(name, color, slug, kind), profiles(habbo_username, hotel, avatar_look)",
        )
        .eq("categories.kind", "news")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as unknown as NewsRow[];
    },
  });

  const { data: events } = useQuery({
    queryKey: ["events-preview"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, room, host_nick, starts_at")
        .gte("starts_at", new Date(Date.now() - 3600_000).toISOString())
        .order("starts_at", { ascending: true })
        .limit(4);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <>
      <PixelPanel variant="gold" title="Bem-vindo ao Bobba Fansite" bodyClassName="space-y-2">
        <p className="text-sm">
          Notícias do hotel, fórum da comunidade, eventos e a nossa rádio tocando o dia todo.
          Valide seu nick pela missão e comece a participar — sem senha do Habbo.
        </p>
        <Link to="/entrar">
          <PixelButton variant="blue" size="sm">
            Validar meu nick
          </PixelButton>
        </Link>
      </PixelPanel>

      <PixelPanel title="Últimas notícias" bodyClassName="space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando o feed...</p>
        ) : news && news.length > 0 ? (
          news.map((item) => (
            <article key={item.id} className="pixel-panel-sm p-3">
              <div className="flex items-start gap-3">
                <HabboAvatar
                  username={item.profiles?.habbo_username ?? "Habbo"}
                  figure={item.profiles?.avatar_look ?? null}
                  hotel={item.profiles?.hotel}
                  size="s"
                  className="h-16 w-auto"
                />
                <div className="min-w-0 flex-1">
                  <Link
                    to="/topico/$topicId"
                    params={{ topicId: item.id }}
                    className="font-pixel text-[0.7rem] hover:text-secondary"
                  >
                    {item.title}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    por {item.profiles?.habbo_username ?? "equipe"} • {timeAgo(item.created_at)} •{" "}
                    {item.categories?.name}
                  </p>
                  <p className="mt-2 line-clamp-3 text-sm">{item.content}</p>
                  <div className="mt-2">
                    <ReactionBar targetType="topic" targetId={item.id} />
                  </div>
                </div>
              </div>
            </article>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            Ainda não há notícias publicadas. A equipe já vai postar as novidades!
          </p>
        )}
      </PixelPanel>

      <PixelPanel title="Próximos eventos" bodyClassName="space-y-2">
        {events && events.length > 0 ? (
          events.map((event) => (
            <div key={event.id} className="pixel-panel-sm flex flex-wrap gap-2 p-2 text-sm">
              <span className="font-pixel text-[0.6rem]">{event.title}</span>
              <span className="text-muted-foreground">
                {formatDateTime(event.starts_at)}
                {event.room ? ` • sala ${event.room}` : ""}
                {event.host_nick ? ` • por ${event.host_nick}` : ""}
              </span>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum evento agendado no momento.</p>
        )}
        <Link to="/eventos">
          <PixelButton variant="grey" size="sm">
            Ver agenda
          </PixelButton>
        </Link>
      </PixelPanel>
    </>
  );
}
