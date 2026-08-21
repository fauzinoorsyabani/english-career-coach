import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import Career from "@/pages/Career";
import Home from "@/pages/Home";
import NotFound from "@/pages/NotFound";
import Practice from "@/pages/Practice";
import Progress from "@/pages/Progress";
import Settings from "@/pages/Settings";
import Tutor from "@/pages/Tutor";
import { Route, Switch } from "wouter";
import DashboardLayout from "./components/DashboardLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

function Workspace({ children }: { children: React.ReactNode }) { return <DashboardLayout>{children}</DashboardLayout>; }

function Router() {
  return <Switch>
    <Route path="/"><Workspace><Home /></Workspace></Route>
    <Route path="/tutor"><Workspace><Tutor /></Workspace></Route>
    <Route path="/practice"><Workspace><Practice /></Workspace></Route>
    <Route path="/career"><Workspace><Career /></Workspace></Route>
    <Route path="/progress"><Workspace><Progress /></Workspace></Route>
    <Route path="/settings"><Workspace><Settings /></Workspace></Route>
    <Route component={NotFound} />
  </Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
