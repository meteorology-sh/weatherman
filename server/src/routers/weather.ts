// Express
import express, { Request, Response } from "express";

// Services
import { Forecast } from "../lib/services/weather";

export const weather = express.Router();

weather.get("/cloud-cover", async (req: Request, res: Response) => {
  try {
    const points = await Forecast.cloudCover();
    res.send(points);
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});
