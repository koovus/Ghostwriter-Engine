import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import NewBook from "@/pages/NewBook";
import BookDetail from "@/pages/BookDetail";
import { Book, PenTool } from "lucide-react";

const queryClient = new QueryClient();

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-background text-foreground font-sans selection:bg-primary/30 selection:text-primary">
      <header className="h-16 border-b border-border flex items-center px-8 sticky top-0 bg-background/95 backdrop-blur z-50 shadow-sm">
        <a href="/" className="flex items-center gap-2.5 text-primary transition-opacity hover:opacity-80">
          <PenTool className="w-5 h-5" />
          <span className="font-semibold text-lg tracking-tight">Writer Ron</span>
        </a>
      </header>
      <main className="flex-1 flex flex-col w-full max-w-[1600px] mx-auto relative">
        {children}
      </main>
    </div>
  );
}

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/books/new" component={NewBook} />
        <Route path="/books/:id" component={BookDetail} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
