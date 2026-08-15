// React
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Components
import { App } from "./App.tsx";
import { LandingPage } from "@/app/components/Landing";
import { About } from "@/app/components/about/About";
import { Candidate } from "@/app/components/candidate/Candidate";
import { Forecast } from "@/app/components/forecast/Forecast";
import { Replay } from "@/app/components/replay/Replay";

// Router
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";

// Providers
import StoreProvider from "@/lib/context/StoreProvider.tsx";
import { ForecastProvider } from "@/lib/context/ForecastProvider.tsx";
import { CloudBaseProvider } from "@/lib/context/CloudBaseProvider.tsx";
import { CloudTopProvider } from "@/lib/context/CloudTopProvider.tsx";
import { RadarProvider } from "@/lib/context/RadarProvider.tsx";
import { CandidatePointProvider } from "@/lib/context/CandidatePointProvider.tsx";
import { SeedabilityProvider } from "@/lib/context/SeedabilityProvider.tsx";
import { SoundingProvider } from "@/lib/context/SoundingProvider.tsx";
import { ReplayProvider } from "@/lib/context/ReplayProvider.tsx";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { path: "/", element: <LandingPage /> },
      // Not under /map: it draws no map, reads no store and needs no provider.
      // The server has no /about prefix for it to collide with.
      { path: "/about", element: <About /> },
      // Page routes live under /map so they cannot collide with a server
      // prefix — the dev proxy forwards every /forecast* request to Express,
      // so a page at /forecast would be swallowed by the API.
      {
        path: "/map/forecast",
        element: (
          <ForecastProvider>
            <Forecast />
          </ForecastProvider>
        ),
      },
      // Page-scoped: the provider warms all three sources for the chosen hour
      // before the map is allowed to draw any of them.
      {
        path: "/map/replay",
        element: (
          <ReplayProvider>
            <Replay />
          </ReplayProvider>
        ),
      },
      {
        path: "/map/candidate",
        element: (
          <CloudBaseProvider>
            <CloudTopProvider>
              <RadarProvider>
                <SoundingProvider>
                  <CandidatePointProvider>
                    <SeedabilityProvider>
                      <Candidate />
                    </SeedabilityProvider>
                  </CandidatePointProvider>
                </SoundingProvider>
              </RadarProvider>
            </CloudTopProvider>
          </CloudBaseProvider>
        ),
      },
    ],
  },
]);
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {" "}
    <StoreProvider>
      {" "}
      <RouterProvider router={router} />{" "}
    </StoreProvider>{" "}
  </StrictMode>
);
