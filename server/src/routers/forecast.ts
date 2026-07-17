// Express
import express, { Request, Response } from "express";

// Services
import { Hrrr } from "../lib/services/forecast";

export const forecast = express.Router();

forecast.get("/meta", async (req: Request, res: Response) => {
  try {
    const meta = await Hrrr.meta();
    res.send(meta);
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

forecast.get("/clouds", async (req: Request, res: Response) => {
  try {
    const hour = Number(req.query.hour ?? 0);
    const frame = await Hrrr.clouds(hour);
    res.send(frame);
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

forecast.get("/precip", async (req: Request, res: Response) => {
  try {
    const hour = Number(req.query.hour ?? 0);
    const frame = await Hrrr.precip(hour);
    res.send(frame);
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});
