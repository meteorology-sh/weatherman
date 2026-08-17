// React
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Router
import { createBrowserRouter, RouterProvider } from "react-router";

// Store
import { Provider as StoreProvider } from "react-redux";
import { store } from "~/lib/store/store";

// Providers
import { FindingsProvider } from "~/lib/context/FindingsProvider";
import { DayProvider } from "~/lib/context/DayProvider";

// Components
import { App } from "./App";
import { Findings } from "./components/Findings";
import { Band } from "./components/band/Band";
import { Overlap } from "./components/overlap/Overlap";

// Styles
import "./index.css";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Findings /> },
      { path: "band", element: <Band /> },
      {
        path: "overlap",
        element: (
          <DayProvider>
            <Overlap />
          </DayProvider>
        ),
      },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StoreProvider store={store}>
      <FindingsProvider>
        <RouterProvider router={router} />
      </FindingsProvider>
    </StoreProvider>
  </StrictMode>
);
