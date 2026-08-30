// Store
import { useAppSelector } from "@/lib/store/hooks";

// Components
import { CloudHere } from "./CloudHere";
import { Convective } from "./Convective";
import { Sounding } from "./Sounding";
import { StormHere } from "./StormHere";

/**
 * Everything the panel says about one clicked cell, and nothing at all until
 * one is clicked.
 *
 * The three readouts answer the same click — what the cloud there is made of,
 * the altitudes to fly between, and what the model diagnoses over it — so they
 * appear together. Before a click there is no such cell: a heading over a
 * column of dashes describes the centre of the country, which nobody asked
 * about. The instructions above say the map is clickable; this section says
 * nothing until it is.
 *
 * The column is still fetched over that default point. That build is the
 * national profile grid every later click is answered from, so warming it on
 * arrival is the difference between a first click costing ~30 s and costing
 * milliseconds — but warming is not drawing.
 *
 * It returns a fragment rather than a wrapper, so the three sit directly in the
 * panel's divided column and are ruled off from each other like every other
 * section.
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
