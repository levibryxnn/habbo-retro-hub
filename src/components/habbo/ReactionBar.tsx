import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { REACTIONS } from "@/lib/habbo";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

type Props = {
  targetType: "topic" | "comment";
  targetId: string;
};

export function ReactionBar({ targetType, targetId }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["reactions", targetType, targetId];

  const { data } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("reactions")
        .select("reaction_type, user_id")
        .eq("target_type", targetType)
        .eq("target_id", targetId);
      if (error) throw error;
      return rows ?? [];
    },
  });

  const rows = data ?? [];

  const toggle = async (reactionType: string) => {
    if (!user) {
      toast.error("Valide seu nick para reagir.");
      return;
    }
    const mine = rows.some((r) => r.user_id === user.id && r.reaction_type === reactionType);
    if (mine) {
      await supabase
        .from("reactions")
        .delete()
        .eq("target_type", targetType)
        .eq("target_id", targetId)
        .eq("user_id", user.id)
        .eq("reaction_type", reactionType);
    } else {
      await supabase.from("reactions").insert({
        target_type: targetType,
        target_id: targetId,
        user_id: user.id,
        reaction_type: reactionType,
      });
    }
    queryClient.invalidateQueries({ queryKey });
  };

  return (
    <div className="flex flex-wrap gap-1">
      {REACTIONS.map((reaction) => {
        const count = rows.filter((r) => r.reaction_type === reaction.type).length;
        const mine = user
          ? rows.some((r) => r.user_id === user.id && r.reaction_type === reaction.type)
          : false;
        return (
          <button
            key={reaction.type}
            type="button"
            title={reaction.label}
            onClick={() => toggle(reaction.type)}
            className={cn(
              "rounded-sm border-2 border-border-strong px-2 py-1 text-xs transition-colors",
              mine ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-card",
            )}
          >
            <span aria-hidden>{reaction.icon}</span> {count}
          </button>
        );
      })}
    </div>
  );
}
