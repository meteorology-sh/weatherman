// React
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Components
import { App } from "./App.tsx";
import { LandingPage } from "./components/Landing.tsx";
import { Candidate } from "./components/Candidate.tsx";
import { Forecast } from "./components/Forecast.tsx";

// Router
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";

// Providers
import StoreProvider from "@/lib/context/StoreProvider.tsx";
import { ForecastProvider } from "@/lib/context/ForecastProvider.tsx";
import { CloudTopProvider } from "@/lib/context/CloudTopProvider.tsx";
import { PirepProvider } from "@/lib/context/PirepProvider.tsx";
import { RadarProvider } from "@/lib/context/RadarProvider.tsx";
import { SoundingProvider } from "@/lib/context/SoundingProvider.tsx";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { path: "/", element: <LandingPage /> },
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
      // Page-scoped: the PIREP pull is one cheap cached fetch, and the radar
      // scene goes stale in minutes, so unlike the seeding-band build there is
      // nothing worth warming from the landing page.
      {
        path: "/map/candidate",
        element: (
          <CloudTopProvider>
            <RadarProvider>
              <PirepProvider>
                <SoundingProvider>
                  <Candidate />
                </SoundingProvider>
              </PirepProvider>
            </RadarProvider>
          </CloudTopProvider>
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
