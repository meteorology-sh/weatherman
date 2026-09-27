// Express
import express, { Request, Response } from "express";

// Services
import { Seedability } from "../lib/services/candidate/field";
import { Storms } from "../lib/services/candidate/storm";
import {
  OutsideDomain,
  parseBox,
  parseFine,
  parseFlag,
} from "../lib/services/shared/grid";
import { parseAt } from "../lib/services/shared/replay";

export const candidate = express.Router();

// The join of every layer, as one field. No `hour` parameter on either route:
// the join leans on an observed cloud top and a satellite cannot forecast, so
// it exists at the analysis hour only. `at` replays the whole join at a past
// hour instead. Both routes share one cached build, so whichever is asked for
// first pays.
candidate.get("/field", async (req: Request, res: Response) => {
  try {
    const frame = await Seedability.field(
      parseAt(req.query.at),
      parseBox(req.query),
      parseFine(req.query)
    );
    res.send(frame);
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// The outline around the part of that field the satellite still sees liquid at
// the top of. Same cached build, traced a second time — it annotates the field
// and never subsets it, so both are drawn and neither is a filter on the other.
candidate.get("/field/confirmed", async (req: Request, res: Response) => {
  try {
    const frame = await Seedability.confirmedField(
      parseAt(req.query.at),
      parseBox(req.query),
      parseFine(req.query)
    );
    res.send(frame);
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

candidate.get("/field/stats", async (req: Request, res: Response) => {
  try {
    const stats = await Seedability.fieldStats(parseAt(req.query.at));
    res.send(stats);
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// The Texas join as a fill: base in the window, 18 dBZ echo top past
// freezing nearby, rain nearby. Same cached build as /point, so a click
// on this fill and FLY cannot disagree.
candidate.get("/target", async (req: Request, res: Response) => {
  try {
    const frame = await Seedability.targetField(
      parseAt(req.query.at),
      parseBox(req.query),
      parseFine(req.query),
      // `round` takes the corners off the cell staircase. The map asks for it;
      // eval leaves it off so a distance is measured against the cell edge
      // rather than against a smoother.
      parseFlag(req.query.round)
    );
    res.send(frame);
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// How much of the asked ground looks like a Texas target. A box is optional
// — absent means the whole domain — and is how eval measures selectivity
// without painting geometry.
candidate.get("/target/stats", async (req: Request, res: Response) => {
  try {
    const stats = await Seedability.targetStats(
      parseAt(req.query.at),
      req.query.west === undefined ? undefined : parseBox(req.query)
    );
    res.send(stats);
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// Cloud base as one fill: HRRR's own base where it has one, the CCL where it
// does not, under a measured echo top and below 18,000 ft MSL. It lives here
// rather than on /forecast/cloudbase because the echo top is an observation and
// an observation cannot be forecast — same reason /field has no `hour`.
candidate.get("/cloudbase", async (req: Request, res: Response) => {
  try {
    const frame = await Seedability.baseField(
      parseAt(req.query.at),
      parseBox(req.query),
      parseFine(req.query)
    );
    res.send(frame);
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// How much ground the cloud-base layer draws, and how much of it rests on the
// CCL rather than on HRRR's own diagnosis. A box is optional.
candidate.get("/cloudbase/stats", async (req: Request, res: Response) => {
  try {
    const stats = await Seedability.baseStats(
      parseAt(req.query.at),
      req.query.west === undefined ? undefined : parseBox(req.query)
    );
    res.send(stats);
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// The same join, read over the 3 km cell a click landed in. It comes off the
// cached build the map is drawing, so the panel and the picture cannot disagree
// about a cell.
candidate.get("/point", async (req: Request, res: Response) => {
  try {
    const point = await Seedability.point(
      Number(req.query.lat),
      Number(req.query.lon),
      parseAt(req.query.at)
    );
    res.send(point);
  } catch (error) {
    // A click off the edge of the model is a fair question with the answer "not
    // here", so it is a 404 rather than a 500. The map draws that edge and the
    // panel says nothing when a click lands outside it; both need to be able to
    // tell this apart from a source being down.
    if (error instanceof OutsideDomain) {
      res.status(404).json({ error: error.message });
      return;
    }
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// The radar storm at a click, with modeled liquid and the observed cloud-top
// change over that storm. Null when no 20 dBZ echo sits within about 40 km.
candidate.get("/storm", async (req: Request, res: Response) => {
  try {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      res.status(400).json({ error: "lat and lon are required numbers" });
      return;
    }
    res.json(
      await Storms.reading(
        lat,
        lon,
        parseAt(req.query.at),
        parseFine(req.query)
      )
    );
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});
