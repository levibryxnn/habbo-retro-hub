import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Header } from "@/components/habbo/Header";
import { Sidebar } from "@/components/habbo/Sidebar";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="pixel-panel max-w-md p-6 text-center">
        <h1 className="text-3xl">404</h1>
        <h2 className="mt-4 text-sm">Quarto não encontrado</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Essa página saiu do hotel ou nunca existiu.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="font-pixel inline-flex rounded-sm border-2 border-border-strong bg-primary px-3 py-2 text-[0.65rem] text-primary-foreground"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="pixel-panel max-w-md p-6 text-center">
        <h1 className="text-sm">Deu ruim no hotel</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Algo falhou por aqui. Tente recarregar a página.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="font-pixel rounded-sm border-2 border-border-strong bg-primary px-3 py-2 text-[0.65rem] text-primary-foreground"
          >
            Tentar de novo
          </button>
          <a
            href="/"
            className="font-pixel rounded-sm border-2 border-border-strong bg-muted px-3 py-2 text-[0.65rem]"
          >
            Início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Bobba Fansite — Fã-site do Habbo Hotel" },
      {
        name: "description",
        content:
          "Fã-site do Habbo Hotel com rádio ao vivo, fórum, notícias, eventos e validação de nick pela missão.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Ubuntu:wght@400;500;700&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen flex-col">
        <Header />
        <div className="mx-auto grid w-full max-w-6xl flex-1 gap-4 px-4 py-6 lg:grid-cols-[1fr_300px]">
          <main className="min-w-0 space-y-4">
            <Outlet />
          </main>
          <Sidebar />
        </div>
        <footer className="border-t-2 border-border-strong bg-card">
          <div className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted-foreground">
            Bobba Fansite é um fã-site independente. Habbo e Habbo Hotel são marcas da Sulake
            Corporation Oy.
          </div>
        </footer>
      </div>
      <Toaster />
    </QueryClientProvider>
  );
}
