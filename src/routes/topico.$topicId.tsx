import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PixelPanel } from "@/components/habbo/PixelPanel";
import { PixelButton } from "@/components/habbo/PixelButton";
import { HabboAvatar } from "@/components/habbo/HabboAvatar";
import { ReactionBar } from "@/components/habbo/ReactionBar";
import { timeAgo } from "@/lib/habbo";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/topico/$topicId")({
  head: () => ({
    meta: [
      { title: "Tópico do fórum — Bobba Fansite" },
      {
        name: "description",
        content: "Leia o tópico, comente e reaja com os ícones temáticos do Habbo Hotel.",
      },
      { property: "og:title", content: "Tópico do fórum — Bobba Fansite" },
      {
        property: "og:description",
        content: "Discussão da comunidade do Habbo Hotel no fã-site.",
      },
    ],
  }),
  component: TopicPage,
});

type Author = { habbo_username: string; hotel: string; avatar_look: string | null } | null;

function TopicPage() {
  const { topicId } = Route.useParams();
  const { user, isStaff } = useAuth();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: "", content: "" });

  const { data: topic, isLoading } = useQuery({
    queryKey: ["topic", topicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("topics")
        .select("*, categories(name, slug), profiles(habbo_username, hotel, avatar_look)")
        .eq("id", topicId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as
        | {
            id: string;
            user_id: string;
            title: string;
            content: string;
            status: string;
            views: number;
            created_at: string;
            categories: { name: string; slug: string } | null;
            profiles: Author;
          }
        | null;
    },
  });

  const { data: comments } = useQuery({
    queryKey: ["comments", topicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("id, user_id, content, created_at, profiles(habbo_username, hotel, avatar_look)")
        .eq("topic_id", topicId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as {
        id: string;
        user_id: string;
        content: string;
        created_at: string;
        profiles: Author;
      }[];
    },
  });

  useEffect(() => {
    if (!topic) return;
    supabase
      .from("topics")
      .update({ views: topic.views + 1 })
      .eq("id", topic.id)
      .then(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic?.id]);

  const canManageTopic = Boolean(user && topic && (topic.user_id === user.id || isStaff));
  const locked = topic?.status === "locked";

  const sendComment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !comment.trim()) return;
    const { error } = await supabase
      .from("comments")
      .insert({ topic_id: topicId, user_id: user.id, content: comment.trim() });
    if (error) {
      toast.error("Não foi possível comentar.");
      return;
    }
    setComment("");
    queryClient.invalidateQueries({ queryKey: ["comments", topicId] });
  };

  const saveTopic = async () => {
    const { error } = await supabase
      .from("topics")
      .update({ title: draft.title, content: draft.content, updated_at: new Date().toISOString() })
      .eq("id", topicId);
    if (error) {
      toast.error("Não foi possível salvar.");
      return;
    }
    setEditing(false);
    queryClient.invalidateQueries({ queryKey: ["topic", topicId] });
    toast.success("Tópico atualizado.");
  };

  const removeTopic = async () => {
    const { error } = await supabase.from("topics").delete().eq("id", topicId);
    if (error) {
      toast.error("Não foi possível apagar.");
      return;
    }
    toast.success("Tópico apagado.");
    window.location.href = "/forum";
  };

  const removeComment = async (id: string) => {
    const { error } = await supabase.from("comments").delete().eq("id", id);
    if (error) {
      toast.error("Não foi possível apagar o comentário.");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["comments", topicId] });
  };

  const toggleStatus = async (status: "open" | "pinned" | "locked") => {
    const { error } = await supabase.from("topics").update({ status }).eq("id", topicId);
    if (error) {
      toast.error("Ação não permitida.");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["topic", topicId] });
  };

  if (isLoading) {
    return <PixelPanel title="Carregando">…</PixelPanel>;
  }

  if (!topic) {
    return (
      <PixelPanel title="Tópico não encontrado">
        <Link to="/forum" className="text-sm underline">
          Voltar ao fórum
        </Link>
      </PixelPanel>
    );
  }

  return (
    <>
      <PixelPanel
        variant="gold"
        title={topic.title}
        actions={
          topic.categories ? (
            <Link
              to="/forum/$slug"
              params={{ slug: topic.categories.slug }}
              className="font-pixel text-[0.55rem] underline"
            >
              {topic.categories.name}
            </Link>
          ) : null
        }
        bodyClassName="space-y-3"
      >
        <div className="flex gap-3">
          <div className="text-center">
            <HabboAvatar
              username={topic.profiles?.habbo_username ?? "Habbo"}
              figure={topic.profiles?.avatar_look ?? null}
              hotel={topic.profiles?.hotel ?? "com.br"}
              className="h-28 w-auto"
            />
            <p className="font-pixel mt-1 text-[0.55rem]">
              {topic.profiles?.habbo_username ?? "—"}
            </p>
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-xs text-muted-foreground">
              {timeAgo(topic.created_at)} • {topic.views} visualizações
            </p>
            {editing ? (
              <div className="space-y-2">
                <input
                  value={draft.title}
                  onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                  className="w-full rounded-sm border-2 border-border-strong bg-input px-3 py-2 text-sm"
                />
                <textarea
                  value={draft.content}
                  rows={6}
                  onChange={(event) => setDraft({ ...draft, content: event.target.value })}
                  className="w-full rounded-sm border-2 border-border-strong bg-input px-3 py-2 text-sm"
                />
                <div className="flex gap-2">
                  <PixelButton variant="success" size="sm" onClick={saveTopic}>
                    Salvar
                  </PixelButton>
                  <PixelButton variant="grey" size="sm" onClick={() => setEditing(false)}>
                    Cancelar
                  </PixelButton>
                </div>
              </div>
            ) : (
              <p className="whitespace-pre-wrap text-sm">{topic.content}</p>
            )}
            <ReactionBar targetType="topic" targetId={topic.id} />
            {canManageTopic && !editing && (
              <div className="flex flex-wrap gap-2">
                <PixelButton
                  variant="grey"
                  size="sm"
                  onClick={() => {
                    setDraft({ title: topic.title, content: topic.content });
                    setEditing(true);
                  }}
                >
                  Editar
                </PixelButton>
                <PixelButton variant="danger" size="sm" onClick={removeTopic}>
                  Apagar
                </PixelButton>
                {isStaff && (
                  <>
                    <PixelButton
                      variant="blue"
                      size="sm"
                      onClick={() => toggleStatus(topic.status === "pinned" ? "open" : "pinned")}
                    >
                      {topic.status === "pinned" ? "Desfixar" : "Fixar"}
                    </PixelButton>
                    <PixelButton
                      variant="blue"
                      size="sm"
                      onClick={() => toggleStatus(topic.status === "locked" ? "open" : "locked")}
                    >
                      {topic.status === "locked" ? "Destrancar" : "Trancar"}
                    </PixelButton>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </PixelPanel>

      <PixelPanel title={`Comentários (${comments?.length ?? 0})`} bodyClassName="space-y-2">
        {comments && comments.length > 0 ? (
          comments.map((item) => (
            <article key={item.id} className="pixel-panel-sm flex gap-3 p-2">
              <HabboAvatar
                username={item.profiles?.habbo_username ?? "Habbo"}
                figure={item.profiles?.avatar_look ?? null}
                hotel={item.profiles?.hotel ?? "com.br"}
                headOnly
                size="s"
                className="h-10 w-auto"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">
                  {item.profiles?.habbo_username ?? "—"} • {timeAgo(item.created_at)}
                </p>
                <p className="whitespace-pre-wrap text-sm">{item.content}</p>
                <div className="mt-1 flex items-center gap-2">
                  <ReactionBar targetType="comment" targetId={item.id} />
                  {user && (item.user_id === user.id || isStaff) && (
                    <button
                      onClick={() => removeComment(item.id)}
                      className="text-xs text-destructive underline"
                    >
                      apagar
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Ninguém comentou ainda.</p>
        )}

        {locked ? (
          <p className="text-sm text-muted-foreground">🔒 Tópico trancado pela moderação.</p>
        ) : user ? (
          <form onSubmit={sendComment} className="space-y-2 pt-2">
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={3}
              placeholder="Escreva um comentário..."
              className="w-full rounded-sm border-2 border-border-strong bg-input px-3 py-2 text-sm"
            />
            <PixelButton type="submit">Comentar</PixelButton>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">Valide seu nick para comentar.</p>
        )}
      </PixelPanel>
    </>
  );
}
