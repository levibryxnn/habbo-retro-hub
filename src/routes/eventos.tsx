import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PixelPanel } from "@/components/habbo/PixelPanel";
import { PixelButton } from "@/components/habbo/PixelButton";
import { HabboAvatar } from "@/components/habbo/HabboAvatar";
import { formatDateTime } from "@/lib/habbo";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/eventos")({
  head: () => ({
    meta: [
      { title: "Eventos no hotel — Bobba Fansite" },
      {
        name: "description",
        content: "Agenda de eventos do Habbo Hotel organizada por horário, sala e organizador.",
      },
      { property: "og:title", content: "Agenda de eventos do Habbo" },
      {
        property: "og:description",
        content: "Veja e divulgue eventos acontecendo agora dentro do hotel.",
      },
    ],
  }),
  component: EventsPage,
});

type EventRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  room: string | null;
  host_nick: string | null;
  starts_at: string;
};

function EventsPage() {
  const { user, profile, isStaff } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ title: "", description: "", room: "", startsAt: "" });

  const { data: events, isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as EventRow[];
    },
  });

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !profile) return;
    if (!form.title.trim() || !form.startsAt) {
      toast.error("Informe o nome e o horário do evento.");
      return;
    }
    const { error } = await supabase.from("events").insert({
      user_id: user.id,
      title: form.title.trim(),
      description: form.description.trim() || null,
      room: form.room.trim() || null,
      host_nick: profile.habbo_username,
      starts_at: new Date(form.startsAt).toISOString(),
    });
    if (error) {
      toast.error("Não foi possível criar o evento.");
      return;
    }
    setForm({ title: "", description: "", room: "", startsAt: "" });
    queryClient.invalidateQueries({ queryKey: ["events"] });
    queryClient.invalidateQueries({ queryKey: ["events-preview"] });
    toast.success("Evento publicado!");
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) {
      toast.error("Não foi possível apagar.");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["events"] });
    toast.success("Evento removido.");
  };

  const now = Date.now();

  return (
    <>
      <PixelPanel title="Eventos no hotel" variant="gold" bodyClassName="space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando eventos...</p>
        ) : events && events.length > 0 ? (
          events.map((event) => {
            const live =
              new Date(event.starts_at).getTime() <= now &&
              now - new Date(event.starts_at).getTime() < 2 * 3600_000;
            return (
              <article key={event.id} className="pixel-panel-sm flex gap-3 p-3">
                <HabboAvatar
                  username={event.host_nick ?? "Habbo"}
                  headOnly
                  size="m"
                  className="h-14 w-auto"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[0.7rem]">{event.title}</h3>
                    {live && (
                      <span className="font-pixel rounded-sm border-2 border-border-strong bg-success px-2 py-0.5 text-[0.5rem] text-success-foreground">
                        AO VIVO
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDateTime(event.starts_at)}
                    {event.room ? ` • sala ${event.room}` : ""}
                    {event.host_nick ? ` • por ${event.host_nick}` : ""}
                  </p>
                  {event.description && <p className="mt-2 text-sm">{event.description}</p>}
                  {user && (event.user_id === user.id || isStaff) && (
                    <div className="mt-2">
                      <PixelButton variant="danger" size="sm" onClick={() => remove(event.id)}>
                        Apagar
                      </PixelButton>
                    </div>
                  )}
                </div>
              </article>
            );
          })
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum evento cadastrado ainda.</p>
        )}
      </PixelPanel>

      {user && profile ? (
        <PixelPanel title="Divulgar um evento" bodyClassName="space-y-2">
          <form onSubmit={create} className="space-y-2">
            <input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="Nome do evento"
              className="w-full rounded-sm border-2 border-border-strong bg-input px-3 py-2 text-sm"
            />
            <div className="flex flex-wrap gap-2">
              <input
                value={form.room}
                onChange={(event) => setForm({ ...form, room: event.target.value })}
                placeholder="Sala no hotel"
                className="flex-1 rounded-sm border-2 border-border-strong bg-input px-3 py-2 text-sm"
              />
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(event) => setForm({ ...form, startsAt: event.target.value })}
                className="rounded-sm border-2 border-border-strong bg-input px-3 py-2 text-sm"
              />
            </div>
            <textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="Descrição, prêmios, regras..."
              rows={3}
              className="w-full rounded-sm border-2 border-border-strong bg-input px-3 py-2 text-sm"
            />
            <PixelButton type="submit">Publicar evento</PixelButton>
          </form>
        </PixelPanel>
      ) : (
        <PixelPanel title="Quer divulgar?">
          <p className="text-sm text-muted-foreground">
            Valide seu nick para publicar eventos na agenda.
          </p>
        </PixelPanel>
      )}
    </>
  );
}
