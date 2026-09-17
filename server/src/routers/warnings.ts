// Express
import express, { Request, Response } from "express";

// Services
import { Warnings } from "../lib/services/nws/warnings";
import { parseAt } from "../lib/services/shared/replay";
import { parseBox } from "../lib/services/shared/grid";

export const warnings = express.Router();

// Severe thunderstorm, tornado and flash flood warnings in force, as
// polygons. Like the
// radar scene there is no hour: a warning is in force at a minute or it is not.
warnings.get("/severe", async (req: Request, res: Response) => {
  try {
    res.send(
      await Warnings.warnings(parseAt(req.query.at), parseBox(req.query))
    );
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

warnings.get("/severe/stats", async (req: Request, res: Response) => {
  try {
    res.send(await Warnings.stats(parseAt(req.query.at)));
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});
