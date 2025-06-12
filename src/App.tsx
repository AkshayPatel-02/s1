import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Web3Provider, useWeb3 } from "@/contexts/Web3Context";
import { useEffect, useState } from "react";
import Header from "@/components/Header";
import Home from "./pages/Home";
import PublicPolls from "./pages/PublicPolls";
import PrivatePolls from "./pages/PrivatePolls";
import CreatePoll from "./pages/CreatePoll";
import PollDetails from "./pages/PollDetails";
import UserDashboard from "./pages/UserDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import NotFound from "./pages/NotFound";
import TestPage from "./pages/TestPage";
import FAQ from "./pages/FAQ";

const queryClient = new QueryClient();

// Protected route component that checks if user is a relayer
const ProtectedAdminRoute = () => {
  const { state, isRelayer } = useWeb3();
  const [isUserRelayer, setIsUserRelayer] = useState<boolean | null>(null);
  const location = useLocation();

  useEffect(() => {
    const checkRelayerStatus = async () => {
      if (state.account) {
        const relayerStatus = await isRelayer(state.account);
        setIsUserRelayer(relayerStatus);
      } else {
        setIsUserRelayer(false);
      }
    };

    checkRelayerStatus();
  }, [state.account, state.isConnected, isRelayer]);

  // Show loading state while checking
  if (isUserRelayer === null) {
    return <div className="flex items-center justify-center h-screen">Checking access...</div>;
  }

  // If user is a relayer, render the AdminDashboard component
  // Otherwise, redirect to the home page
  return isUserRelayer ? <AdminDashboard /> : <Navigate to="/" state={{ from: location }} replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Web3Provider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <div className="min-h-screen bg-gradient-bg flex flex-col">
            <Header />
            <main className="flex-grow">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/polls" element={<PublicPolls />} />
                <Route path="/private-polls" element={<PrivatePolls />} />
                <Route path="/create" element={<CreatePoll />} />
                <Route path="/poll/:id" element={<PollDetails />} />
                <Route path="/dashboard" element={<UserDashboard />} />
                <Route path="/admin" element={<ProtectedAdminRoute />} />
                <Route path="/faq" element={<FAQ />} />
                <Route path="/test" element={<TestPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </Web3Provider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
