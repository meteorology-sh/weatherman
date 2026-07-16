// React Router
import { Outlet } from "react-router";

// Components
import { Navigation } from "./layout/Navigation";

// Providers
import { WeatherProvider } from "@/lib/context/WeatherProvider";

// Styles
import "./index.css";

export const App = () => {
  return (
    <div className="h-[calc(100vh-4rem)] w-screen">
      <Navigation />
      <WeatherProvider>
        <Outlet />
      </WeatherProvider>
    </div>
  );
};
