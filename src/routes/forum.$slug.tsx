import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PixelPanel } from "@/components/habbo/PixelPanel";
import { PixelButton } from "@/components/habbo/PixelButton";
import { HabboAvatar } from "@/components/habbo/HabboAvatar";
import { timeAgo } from "@/lib/habbo";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/forum/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `Categoria ${params.slug} — Fórum do Bobba Fansite` },
      {
        name: "description",
        content: `Tópicos da categoria ${params.slug} no fórum do fã-site do Habbo Hotel.`,
      },
      { property: "og:title", content: `Fórum — ${params.slug}` },
      {
        property: "og:description",
        content: `Discussões da comunidade do Habbo na categoria ${params.slug}.`,
      },
    ],
  }),
  component: CategoryPage,
});

type TopicRow = {
  id: string;
  title: string;
  content: string;
  status: string;
  views: number;
  created_at: string;
  profiles: { habbo_username: string; hotel: string; avatar_look: string | null } | null;
};

function CategoryPage() {
  const { slug } = Route.useParams();
  const { user, profile, isStaff } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ title: "", content: "" });

  const { data: category } = useQuery({
    queryKey: ["category", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: topics } = useQuery({
    queryKey: ["topics", slug],
    enabled: Boolean(category?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("topics")
        .select("id, title, content, status, views, created_at, profiles(habbo_username, hotel, avatar_look)")
        .eq("category_id", category!.id)
        .order("status", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as TopicRow[];
    },
  });

  const canPost = Boolean(user && profile) && (category?.kind !== "news" || isStaff);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !category) return;
    if (!form.title.trim() || !form.content.trim()) {
      toast.error("Preencha título e conteúdo.");
      return;
    }
    const { error } = await supabase.from("topics").insert({
      user_id: user.id,
      category_id: category.id,
      title: form.title.trim(),
      content: form.content.trim(),
    });
    if (error) {
      toast.error("Não foi possível publicar.");
      return;
    }
    setForm({ title: "", content: "" });
    queryClient.invalidateQueries({ queryKey: ["topics", slug] });
    queryClient.invalidateQueries({ queryKey: ["news-feed"] });
    toast.success("Tópico publicado!");
  };

  return (
    <>
      <PixelPanel
        title={category?.name ?? "Categoria"}
        variant="gold"
        bodyClassName="space-y-2"
        actions={
          <Link to="/forum" className="font-pixel text-[0.55rem] underline">
            voltar
          </Link>
        }
      >
        <p className="text-sm text-muted-foreground">{category?.description}</p>
      </PixelPanel>

      <PixelPanel title="Tópicos" bodyClassName="space-y-2">
        {topics && topics.length > 0 ? (
          topics.map((topic) => (
            <article key={topic.id} className="pixel-panel-sm flex gap-3 p-3">
              <HabboAvatar
                username={topic.profiles?.habbo_username ?? "Habbo"}
                figure={topic.profiles?.avatar_look ?? null}
                hotel={topic.profiles?.hotel ?? "com.br"}
                headOnly
                size="m"
                className="h-12 w-auto"
              />
              <div className="min-w-0 flex-1">
                <Link
                  to="/topico/$topicId"
                  params={{ topicId: topic.id }}
                  className="font-pixel text-[0.65rem] hover:text-secondary"
                >
                  {topic.status === "pinned" ? "📌 " : ""}
                  {topic.status === "locked" ? "🔒 " : ""}
                  {topic.title}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  por {topic.profiles?.habbo_username ?? "—"} • {timeAgo(topic.created_at)} •{" "}
                  {topic.views} visualizações
                </p>
                <p className="mt-1 line-clamp-2 text-sm">{topic.content}</p>
              </div>
            </article>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum tópico nesta categoria ainda.</p>
        )}
      </PixelPanel>

      {canPost ? (
        <PixelPanel title="Novo tópico">
          <form onSubmit={create} className="space-y-2">
            <input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="Título do tópico"
              className="w-full rounded-sm border-2 border-border-strong bg-input px-3 py-2 text-sm"
            />
            <textarea
              value={form.content}
              onChange={(event) => setForm({ ...form, content: event.target.value })}
              placeholder="Escreva aqui..."
              rows={5}
              className="w-full rounded-sm border-2 border-border-strong bg-input px-3 py-2 text-sm"
            />
            <PixelButton type="submit">Publicar</PixelButton>
          </form>
        </PixelPanel>
      ) : (
        <PixelPanel title="Quer participar?">
          <p className="text-sm text-muted-foreground">
            {category?.kind === "news"
              ? "Só a equipe do fã-site publica nesta área."
              : "Valide seu nick para abrir tópicos."}
          </p>
        </PixelPanel>
      )}
    </>
  );
}
