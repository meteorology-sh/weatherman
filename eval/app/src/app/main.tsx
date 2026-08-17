// React
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Router
import { createBrowserRouter, RouterProvider } from "react-router";

// Store
import { Provider as StoreProvider } from "react-redux";
import { store } from "~/lib/store/store";

// Providers
import { RegionsProvider } from "~/lib/context/RegionsProvider";
import { FindingsProvider } from "~/lib/context/FindingsProvider";
import { DayProvider } from "~/lib/context/DayProvider";

// Components
import { App } from "./App";
import { Regions } from "./components/Regions";
import { Findings } from "./components/Findings";
import { Band } from "./components/band/Band";
import { Overlap } from "./components/overlap/Overlap";

// Styles
import "./index.css";

/**
 * Routes are region-major: `/wtwma/flares`, not `/flares?region=wtwma`.
 *
 * The programme selects the whole dataset — a different season, a different
 * flight record, different soundings — so a page for one is a different page,
 * not a filtered view of a shared one. It also makes a finding linkable: a url
 * carries which operator's numbers it is showing.
 *
 * `FindingsProvider` wraps the region's routes rather than the app, so it reads
 * the region from the url and remounts when that changes.
 */
const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Regions /> },
      {
        path: ":region",
        element: (
          <FindingsProvider>
            <DayProvider>
              <Findings />
            </DayProvider>
          </FindingsProvider>
        ),
      },
      {
        path: ":region/band",
        element: (
          <FindingsProvider>
            <Band />
          </FindingsProvider>
        ),
      },
      {
        path: ":region/flares",
        element: (
          <FindingsProvider>
            <DayProvider>
              <Overlap />
            </DayProvider>
          </FindingsProvider>
        ),
      },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StoreProvider store={store}>
      <RegionsProvider>
        <RouterProvider router={router} />
      </RegionsProvider>
    </StoreProvider>
  </StrictMode>
);
