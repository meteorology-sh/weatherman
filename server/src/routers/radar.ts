// Express
import express, { Request, Response } from "express";

// Services
import { Mrms } from "../lib/services/radar";
import { parseAt } from "../lib/services/replay";

export const radar = express.Router();

// Observed reflectivity right now. No hour parameter, for the same reason the
// cloud-top routes have none: this is a scene, not a forecast — there is only
// ever the mosaic that exists, and it carries its own valid time.
radar.get("/reflectivity", async (req: Request, res: Response) => {
  try {
    const frame = await Mrms.reflectivity(parseAt(req.query.at));
    res.send(frame);
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

radar.get("/reflectivity/stats", async (req: Request, res: Response) => {
  try {
    const stats = await Mrms.reflectivityStats(parseAt(req.query.at));
    res.send(stats);
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});
