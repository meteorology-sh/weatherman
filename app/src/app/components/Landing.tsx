import { Link } from "react-router";

export const LandingPage = () => {
  return (
    <>
      <div className="w-full h-full bg-black flex flex-col items-center justify-center px-2">
        <div className="grid grid-cols-2">
          <div className="flex items-center justify-center">
            <img
              src={"clouds.png"}
              className="w-full pointer-events-none pr-8"
            />
          </div>
          <div className="flex items-center justify-center border-l pl-4">
            <div className="prose">
              <h1 className="mb-8">Weatherman</h1>
              <Link
                to={{
                  pathname: "/map/forecast",
                }}
              >
                <div className="btn w-1/2 mb-12">Launch</div>
              </Link>
              <br />
              <br />
              <small>Made in Texas</small>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
