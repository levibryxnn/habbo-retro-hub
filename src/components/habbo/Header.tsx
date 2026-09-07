import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { HabboAvatar } from "./HabboAvatar";
import { PixelButton } from "./PixelButton";

export function Header() {
  const navigate = useNavigate();
  const { profile, user, signOut } = useAuth();
  const [term, setTerm] = useState("");

  const search = (event: React.FormEvent) => {
    event.preventDefault();
    const nick = term.trim();
    if (!nick) return;
    navigate({ to: "/nick/$username", params: { username: nick } });
    setTerm("");
  };

  return (
    <header className="sky-gradient border-b-2 border-border-strong">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center">
        <Link to="/" className="flex items-center gap-3">
          <span className="pixel-panel-sm bg-primary px-2 py-1 font-pixel text-[0.85rem] text-primary-foreground">
            BOBBA
          </span>
          <span className="font-pixel text-[0.85rem] text-secondary-foreground text-shadow-pixel">
            FANSITE
          </span>
        </Link>

        <form onSubmit={search} className="flex flex-1 items-center gap-2 md:mx-6">
          <input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Buscar nick no hotel..."
            aria-label="Buscar nick do Habbo"
            className="w-full rounded-sm border-2 border-border-strong bg-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <PixelButton type="submit" variant="gold" size="sm">
            Buscar
          </PixelButton>
        </form>

        {user && profile ? (
          <div className="flex items-center gap-2">
            <Link
              to="/nick/$username"
              params={{ username: profile.habbo_username }}
              className="pixel-panel-sm flex items-center gap-2 px-2 py-1"
            >
              <HabboAvatar
                username={profile.habbo_username}
                figure={profile.avatar_look}
                headOnly
                size="s"
                hotel={profile.hotel}
                className="h-8 w-auto"
              />
              <span className="font-pixel text-[0.6rem]">{profile.habbo_username}</span>
            </Link>
            <PixelButton variant="grey" size="sm" onClick={() => signOut()}>
              Sair
            </PixelButton>
          </div>
        ) : (
          <Link to="/entrar">
            <PixelButton variant="gold" size="sm">
              Entrar com nick
            </PixelButton>
          </Link>
        )}
      </div>

      <nav className="border-t-2 border-border-strong bg-card">
        <ul className="mx-auto flex max-w-6xl flex-wrap gap-1 px-2 py-1">
          {[
            { to: "/", label: "Início" },
            { to: "/forum", label: "Fórum" },
            { to: "/eventos", label: "Eventos" },
            { to: "/entrar", label: "Validação" },
          ].map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                activeOptions={{ exact: item.to === "/" }}
                activeProps={{ className: "bg-secondary text-secondary-foreground" }}
                className="font-pixel inline-block rounded-sm px-3 py-2 text-[0.6rem] hover:bg-muted"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
