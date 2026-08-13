// React Router
import { Outlet } from "react-router";

// Components
import { Navigation } from "./layout/Navigation";

// Providers
import { CandidateProvider } from "@/lib/context/CandidateProvider";

// Styles
import "./index.css";

export const App = () => {
  return (
    <div className="h-[calc(100vh-4rem)] w-screen">
      <Navigation />
      {/* App-wide so the server starts building the seeding-band frame the
          moment the operator lands, not when they open the map. */}
      <CandidateProvider>
        <Outlet />
      </CandidateProvider>
    </div>
  );
};
