// Express
import express, { Request, Response } from "express";

// Services
import { Pireps } from "../lib/services/pirep";

export const pireps = express.Router();

// Icing reports over CONUS for the last 12 h. No hour parameter: unlike the
// HRRR routes this is an observation feed, so there is only ever "the reports
// that exist right now".
pireps.get("/icing", async (req: Request, res: Response) => {
  try {
    const frame = await Pireps.icing();
    res.send(frame);
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

pireps.get("/icing/stats", async (req: Request, res: Response) => {
  try {
    const stats = await Pireps.icingStats();
    res.send(stats);
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});
