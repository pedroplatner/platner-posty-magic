import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { Toaster } from "@/components/ui/sonner";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Platner.IG — Agendamento de Posts Instagram" },
      { name: "description", content: "Dashboard premium para agendamento de posts no Instagram." },
      { property: "og:title", content: "Platner.IG — Agendamento de Posts Instagram" },
      { name: "twitter:title", content: "Platner.IG — Agendamento de Posts Instagram" },
      { property: "og:description", content: "Dashboard premium para agendamento de posts no Instagram." },
      { name: "twitter:description", content: "Dashboard premium para agendamento de posts no Instagram." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/1bc62716-296b-47e5-9cbf-b6a81d094ffe/id-preview-c0cae804--458e81e5-1c2c-47dd-a239-f730a73df420.lovable.app-1778799316590.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/1bc62716-296b-47e5-9cbf-b6a81d094ffe/id-preview-c0cae804--458e81e5-1c2c-47dd-a239-f730a73df420.lovable.app-1778799316590.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen flex w-full bg-background text-foreground">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AppHeader />
          <main className="flex-1 p-8 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
      <Toaster theme="dark" position="top-right" />
    </QueryClientProvider>
  );
}
