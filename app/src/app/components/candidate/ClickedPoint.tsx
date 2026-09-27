// Store
import { useAppSelector } from "@/lib/store/hooks";

// Components
import { Cloud } from "./Cloud";
import { Environment } from "./Environment";
import { FlyHere } from "./FlyHere";
import { StormHere } from "./StormHere";

/**
 * FLY on the clicked cell, then the storm, the cloud, and the air around it.
 */
export const ClickedPoint = () => {
  const clicked = useAppSelector((state) => state.sounding.clicked);

  if (!clicked) return null;

  return (
    <>
      <FlyHere />
      <StormHere />
      <Cloud />
      <Environment />
    </>
  );
};
