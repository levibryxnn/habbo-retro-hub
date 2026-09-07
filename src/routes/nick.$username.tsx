import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { lookupHabboUser } from "@/lib/habbo.functions";
import { supabase } from "@/integrations/supabase/client";
import { PixelPanel } from "@/components/habbo/PixelPanel";
import { HabboAvatar } from "@/components/habbo/HabboAvatar";
import { formatDateTime, DEFAULT_HOTEL } from "@/lib/habbo";

export const Route = createFileRoute("/nick/$username")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.username} — Perfil no Bobba Fansite` },
      {
        name: "description",
        content: `Visual, missão, emblemas e atividade de ${params.username} no Habbo Hotel e no fã-site.`,
      },
      { property: "og:title", content: `${params.username} no Habbo Hotel` },
      {
        property: "og:description",
        content: `Perfil de ${params.username}: avatar, missão, emblemas e pontos no fã-site.`,
      },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { username } = Route.useParams();
  const lookup = useServerFn(lookupHabboUser);

  const { data: habbo, isLoading } = useQuery({
    queryKey: ["habbo-user", username],
    queryFn: () => lookup({ data: { name: username, hotel: DEFAULT_HOTEL } }),
  });

  const { data: fan } = useQuery({
    queryKey: ["fan-profile", username],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("habbo_username_lower", username.toLowerCase())
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: fanBadges } = useQuery({
    queryKey: ["fan-badges", fan?.id],
    enabled: Boolean(fan?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_badges")
        .select("id, badges(name, description, icon)")
        .eq("user_id", fan!.id);
      if (error) throw error;
      return (data ?? []) as unknown as {
        id: string;
        badges: { name: string; description: string | null; icon: string | null } | null;
      }[];
    },
  });

  const { data: topics } = useQuery({
    queryKey: ["profile-topics", fan?.id],
    enabled: Boolean(fan?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("topics")
        .select("id, title, created_at")
        .eq("user_id", fan!.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });

  const user = habbo?.found ? habbo.user : null;

  return (
    <>
      <PixelPanel title={`Perfil de ${username}`} variant="gold" bodyClassName="space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Consultando o hotel...</p>
        ) : user ? (
          <div className="flex flex-wrap gap-4">
            <HabboAvatar
              username={user.name}
              figure={user.figureString}
              hotel={fan?.hotel ?? DEFAULT_HOTEL}
              className="h-36 w-auto"
            />
            <div className="min-w-0 space-y-1">
              <p className="font-pixel text-[0.8rem]">{user.name}</p>
              <p className="text-sm text-muted-foreground">“{user.motto || "sem missão"}”</p>
              <p className="text-xs text-muted-foreground">
                {user.online ? "🟢 online agora" : "⚪ offline"}
                {user.memberSince ? ` • no hotel desde ${formatDateTime(user.memberSince)}` : ""}
              </p>
              {fan && (
                <p className="font-pixel text-[0.55rem] text-secondary">
                  {fan.points} pontos no fã-site
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nick não encontrado no hotel, ou o perfil está oculto.
          </p>
        )}
      </PixelPanel>

      {user?.selectedBadges && user.selectedBadges.length > 0 && (
        <PixelPanel title="Emblemas no hotel">
          <div className="flex flex-wrap gap-2">
            {user.selectedBadges.map((badge) => (
              <span
                key={badge.code}
                title={badge.description}
                className="pixel-panel-sm px-2 py-1 text-xs"
              >
                🏅 {badge.name}
              </span>
            ))}
          </div>
        </PixelPanel>
      )}

      <PixelPanel title="Emblemas do fã-site">
        {fanBadges && fanBadges.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {fanBadges.map((item) => (
              <span
                key={item.id}
                title={item.badges?.description ?? ""}
                className="pixel-panel-sm bg-primary px-2 py-1 text-xs text-primary-foreground"
              >
                ⭐ {item.badges?.name}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nenhum emblema conquistado por aqui ainda.
          </p>
        )}
      </PixelPanel>

      <PixelPanel title="Últimos tópicos">
        {topics && topics.length > 0 ? (
          <ul className="space-y-1 text-sm">
            {topics.map((topic) => (
              <li key={topic.id}>
                <Link
                  to="/topico/$topicId"
                  params={{ topicId: topic.id }}
                  className="hover:underline"
                >
                  {topic.title}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nada publicado ainda.</p>
        )}
      </PixelPanel>
    </>
  );
}
