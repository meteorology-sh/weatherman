// Router
import { Outlet } from "react-router";

// Components
import { Navigation } from "./layout/Navigation";

export const App = () => (
  <div className="h-full flex flex-col bg-black">
    <Navigation />
    <div className="flex-1 overflow-hidden">
      <Outlet />
    </div>
  </div>
);
