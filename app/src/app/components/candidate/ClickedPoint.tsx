// Store
import { useAppSelector } from "@/lib/store/hooks";

// Components
import { CloudHere } from "./CloudHere";
import { Convective } from "./Convective";
import { Sounding } from "./Sounding";
import { StormHere } from "./StormHere";

/**
 * FLY on the clicked cell, the storm, and the column numbers.
 */
export const ClickedPoint = () => {
  const clicked = useAppSelector((state) => state.sounding.clicked);

  if (!clicked) return null;

  return (
    <>
      <CloudHere />
      <StormHere />
      <Sounding />
      <Convective />
    </>
  );
};
