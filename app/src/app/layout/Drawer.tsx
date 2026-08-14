import { Link } from "react-router";

export const Drawer = () => {
  return (
    <>
      <div className="menu bg-black min-h-full w-80 m-0 p-0">
        <div className="navbar bg-black shadow-sm">
          <label htmlFor="nav-drawer" className="px-4 cursor-pointer">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="size-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            </svg>
          </label>
          <div className="prose px-4">
            <h4>Weatherman</h4>
          </div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="size-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 15a4.5 4.5 0 0 0 4.5 4.5H18a3.75 3.75 0 0 0 1.332-7.257 3 3 0 0 0-3.758-3.848 5.25 5.25 0 0 0-10.233 2.33A4.502 4.502 0 0 0 2.25 15Z"
            />
          </svg>
        </div>
        <div className="p-8 flex flex-col justify-center">
          <Link
            to={{
              pathname: "/",
            }}
          >
            <button className="btn btn-sm w-full">Home</button>
          </Link>
          <br />
          <Link
            to={{
              pathname: "/map/forecast",
            }}
          >
            <button className="btn btn-sm w-full">Forecast</button>
          </Link>
          <br />
          <Link
            to={{
              pathname: "/map/candidate",
            }}
          >
            <button className="btn btn-sm w-full">Candidates</button>
          </Link>
          <br />
          <Link
            to={{
              pathname: "/map/replay",
            }}
          >
            <button className="btn btn-sm w-full">Replay</button>
          </Link>
          <br />
          <Link
            to={{
              pathname: "/about",
            }}
          >
            <button className="btn btn-sm w-full">About the layers</button>
          </Link>
        </div>
      </div>
    </>
  );
};
