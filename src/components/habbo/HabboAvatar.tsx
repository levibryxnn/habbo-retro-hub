import { avatarUrlByFigure, avatarUrlByName, type AvatarOptions } from "@/lib/habbo";
import { cn } from "@/lib/utils";

type Props = AvatarOptions & {
  username?: string;
  figure?: string | null;
  className?: string;
  alt?: string;
};

export function HabboAvatar({ username, figure, className, alt, ...options }: Props) {
  const src = figure
    ? avatarUrlByFigure(figure, options)
    : avatarUrlByName(username ?? "Habbo", options);

  return (
    <img
      src={src}
      alt={alt ?? `Avatar de ${username ?? "usuário"}`}
      loading="lazy"
      className={cn("select-none", className)}
    />
  );
}
