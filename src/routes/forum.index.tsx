import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PixelPanel } from "@/components/habbo/PixelPanel";
import { timeAgo } from "@/lib/habbo";

export const Route = createFileRoute("/forum/")({
  head: () => ({
    meta: [
      { title: "Fórum da comunidade — Bobba Fansite" },
      {
        name: "description",
        content:
          "Converse com a comunidade do Habbo Hotel: geral, eventos, dúvidas e anúncios oficiais.",
      },
      { property: "og:title", content: "Fórum do Habbo — Bobba Fansite" },
      {
        property: "og:description",
        content: "Categorias de discussão, tópicos fixados e reações temáticas do Habbo.",
      },
    ],
  }),
  component: ForumIndex,
});

function ForumIndex() {
  const { data: categories, isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("position", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: latest } = useQuery({
    queryKey: ["latest-topics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("topics")
        .select("id, title, created_at, profiles(habbo_username)")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data ?? []) as unknown as {
        id: string;
        title: string;
        created_at: string;
        profiles: { habbo_username: string } | null;
      }[];
    },
  });

  return (
    <>
      <PixelPanel title="Categorias do fórum" variant="gold" bodyClassName="space-y-2">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando categorias...</p>
        ) : (
          categories?.map((category) => (
            <Link
              key={category.id}
              to="/forum/$slug"
              params={{ slug: category.slug }}
              className="pixel-panel-sm flex items-center gap-3 p-3 hover:brightness-105"
            >
              <span
                className="inline-block size-6 rounded-sm border-2 border-border-strong"
                style={{ backgroundColor: category.color }}
              />
              <span className="min-w-0">
                <span className="font-pixel block text-[0.65rem]">{category.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {category.description}
                </span>
              </span>
              <span className="font-pixel ml-auto text-[0.5rem] text-muted-foreground">
                {category.kind === "news" ? "NOTÍCIAS" : "FÓRUM"}
              </span>
            </Link>
          ))
        )}
      </PixelPanel>

      <PixelPanel title="Tópicos recentes" bodyClassName="space-y-1">
        {latest && latest.length > 0 ? (
          latest.map((topic) => (
            <Link
              key={topic.id}
              to="/topico/$topicId"
              params={{ topicId: topic.id }}
              className="flex flex-wrap items-center gap-2 rounded-sm px-2 py-1 text-sm hover:bg-muted"
            >
              <span className="font-medium">{topic.title}</span>
              <span className="text-xs text-muted-foreground">
                por {topic.profiles?.habbo_username ?? "—"} • {timeAgo(topic.created_at)}
              </span>
            </Link>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum tópico ainda. Comece o primeiro!</p>
        )}
      </PixelPanel>
    </>
  );
}
