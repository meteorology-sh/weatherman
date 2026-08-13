// Express
import express, { Request, Response } from "express";

// Services
import { Goes } from "../lib/services/cloudtop";

export const cloudtop = express.Router();

// Observed cloud tops right now. No hour parameter, for the same reason the
// radar routes have none: this is a scene, not a forecast — there is only ever
// the one the satellite just scanned, and it carries its own valid time.
cloudtop.get("/temperature", async (req: Request, res: Response) => {
  try {
    const frame = await Goes.temperature();
    res.send(frame);
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

cloudtop.get("/temperature/stats", async (req: Request, res: Response) => {
  try {
    const stats = await Goes.temperatureStats();
    res.send(stats);
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});
