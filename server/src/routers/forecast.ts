// Express
import express, { Request, Response } from "express";

// Services
import { Hrrr } from "../lib/services/hrrr/forecast";
import { isBriefingField } from "../lib/services/hrrr/briefing";
import {
  OutsideDomain,
  parseBox,
  parseFine,
  parseFlag,
} from "../lib/services/shared/grid";
import { parseAt } from "../lib/services/shared/replay";

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
    const frame = await Hrrr.clouds(
      hour,
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

forecast.get("/precip", async (req: Request, res: Response) => {
  try {
    const hour = Number(req.query.hour ?? 0);
    const frame = await Hrrr.precip(
      hour,
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

// Supercooled liquid water. Served from /forecast because HRRR is the source,
// though the candidate map reads it at hour 0 — the analysis, i.e. "now".
// Both routes share one cached build, so whichever is asked for first pays.
forecast.get("/liquid", async (req: Request, res: Response) => {
  try {
    const hour = Number(req.query.hour ?? 0);
    const frame = await Hrrr.liquid(
      hour,
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

// Cloud base — the variable Texas operations select on, and the end of the
// cloud the app has never read. Served from /forecast because HRRR is the
// source; the
// candidate map reads it at hour 0, like the liquid-water layer. Both routes
// share one cached build of every wrfsfc diagnostic, so whichever is asked for
// first pays and the point readout is then free.
forecast.get("/cloudbase", async (req: Request, res: Response) => {
  try {
    const hour = Number(req.query.hour ?? 0);
    const frame = await Hrrr.cloudBase(
      hour,
      parseAt(req.query.at),
      parseBox(req.query),
      parseFine(req.query),
      parseFlag(req.query.window)
    );
    res.send(frame);
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

forecast.get("/briefing/:field", async (req: Request, res: Response) => {
  try {
    const field = String(req.params.field ?? "");
    if (!isBriefingField(field)) {
      res.status(404).json({ error: `No briefing field ${field}` });
      return;
    }
    const hour = Number(req.query.hour ?? 0);
    const frame = await Hrrr.briefing(
      field,
      hour,
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

// The gate on its own: 1 where the base is in the window and nothing
// elsewhere, which is what the evaluation harness scores. The map asks
// `/cloudbase?window=1` instead, because it wants the height ramp trimmed
// rather than a single pass/fail fill.
forecast.get("/cloudbase/window", async (req: Request, res: Response) => {
  try {
    const hour = Number(req.query.hour ?? 0);
    const frame = await Hrrr.cloudBaseWindow(
      hour,
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

forecast.get("/cloudbase/stats", async (req: Request, res: Response) => {
  try {
    const hour = Number(req.query.hour ?? 0);
    const stats = await Hrrr.cloudBaseStats(hour, parseAt(req.query.at));
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
// The edge of the model itself. No hour and no `at`: the Lambert grid is the
// same shape for every run, so this is one polygon that never moves. The map
// draws it as the line clicks are answered inside.
forecast.get("/domain", async (_req: Request, res: Response) => {
  try {
    res.send(await Hrrr.domain());
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

forecast.get("/sounding", async (req: Request, res: Response) => {
  try {
    const hour = Number(req.query.hour ?? 0);
    const sounding = await Hrrr.sounding(
      Number(req.query.lat),
      Number(req.query.lon),
      hour,
      parseAt(req.query.at)
    );
    res.send(sounding);
  } catch (error) {
    // Same as the candidate point: a click off the edge of the model is a fair
    // question answered "not here", not a failure.
    if (error instanceof OutsideDomain) {
      res.status(404).json({ error: error.message });
      return;
    }
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});
