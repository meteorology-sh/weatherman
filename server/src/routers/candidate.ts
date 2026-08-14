// Express
import express, { Request, Response } from "express";

// Services
import { Seedability } from "../lib/services/candidate/field";
import { parseAt } from "../lib/services/shared/replay";

export const candidate = express.Router();

// The join of every layer, as one field. No `hour` parameter on either route:
// the join leans on an observed cloud top and a satellite cannot forecast, so
// it exists at the analysis hour only. `at` replays the whole join at a past
// hour instead. Both routes share one cached build, so whichever is asked for
// first pays.
candidate.get("/field", async (req: Request, res: Response) => {
  try {
    const frame = await Seedability.field(parseAt(req.query.at));
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
