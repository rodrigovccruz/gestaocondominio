import { Toaster } from "@/components/ui/sonner";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import Home from "./pages/Home";
import PublicDashboard from "./pages/PublicDashboard";

export default function App() {
  return (
    <ErrorBoundary>
      <Toaster position="top-center" />
      <Switch>
        <Route path={"/"} component={PublicDashboard} />
        <Route path={"/sindico"} component={Home} />
        <Route component={NotFound} />
      </Switch>
    </ErrorBoundary>
  );
}
