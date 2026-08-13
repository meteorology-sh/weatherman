// Express
import express, { Request, Response } from "express";

// Services
import { Hrrr } from "../lib/services/forecast";
import { parseAt } from "../lib/services/replay";

export const forecast = express.Router();

forecast.get("/meta", async (req: Request, res: Response) => {
  try {
    const meta = await Hrrr.meta(parseAt(req.query.at));
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
    const frame = await Hrrr.clouds(hour, parseAt(req.query.at));
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
    const frame = await Hrrr.precip(hour, parseAt(req.query.at));
    res.send(frame);
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// Supercooled liquid water. Served from /forecast because HRRR is the source,
// though the candidate map reads it at hour 0 — the analysis, i.e. "now".
// Both routes share one cached build, so whichever is asked for first pays.
forecast.get("/liquid", async (req: Request, res: Response) => {
  try {
    const hour = Number(req.query.hour ?? 0);
    const frame = await Hrrr.liquid(hour, parseAt(req.query.at));
    res.send(frame);
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

forecast.get("/liquid/stats", async (req: Request, res: Response) => {
  try {
    const hour = Number(req.query.hour ?? 0);
    const stats = await Hrrr.liquidStats(hour, parseAt(req.query.at));
    res.send(stats);
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// The profile over one point: the altitudes a drone is actually given. Reads
// the same model as the contours, so the readout and the map agree about where
// the band is — the whole reason it is not a second opinion from Open-Meteo.
forecast.get("/sounding", async (req: Request, res: Response) => {
  try {
    const hour = Number(req.query.hour ?? 0);
    const sounding = await Hrrr.sounding(
      Number(req.query.lat),
      Number(req.query.lon),
      hour,
      parseAt(req.query.at),
    );
    res.send(sounding);
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});
