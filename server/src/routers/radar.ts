// Express
import express, { Request, Response } from "express";

// Services
import { Mrms } from "../lib/services/mrms/radar";
import { EchoTops } from "../lib/services/mrms/echotop";
import { parseAt } from "../lib/services/shared/replay";
import { parseBox, parseFine } from "../lib/services/shared/grid";

export const radar = express.Router();

// Observed reflectivity right now. No hour parameter, for the same reason the
// cloud-top routes have none: this is a scene, not a forecast — there is only
// ever the mosaic that exists, and it carries its own valid time.
radar.get("/reflectivity", async (req: Request, res: Response) => {
  try {
    const frame = await Mrms.reflectivity(
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

radar.get("/reflectivity/stats", async (req: Request, res: Response) => {
  try {
    const at = parseAt(req.query.at);
    const stats = await Mrms.reflectivityStats(at);
    EchoTops.warm(at);
    res.send(stats);
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// Contiguous ≥20 dBZ regions as polygons. Same mosaic the reflectivity
// contours came from; a box is the window the map is looking at.
radar.get("/objects", async (req: Request, res: Response) => {
  try {
    res.send(
      await Mrms.objects(
        parseAt(req.query.at),
        parseBox(req.query),
        parseFine(req.query)
      )
    );
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

radar.get("/objects/cores", async (req: Request, res: Response) => {
  try {
    res.send(
      await Mrms.cores(
        parseAt(req.query.at),
        parseBox(req.query),
        parseFine(req.query)
      )
    );
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

radar.get("/objects/motion", async (req: Request, res: Response) => {
  try {
    res.send(
      await Mrms.motion(
        parseAt(req.query.at),
        parseBox(req.query),
        parseFine(req.query)
      )
    );
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

radar.get("/objects/flanks", async (req: Request, res: Response) => {
  try {
    res.send(
      await Mrms.flanks(
        parseAt(req.query.at),
        parseBox(req.query),
        parseFine(req.query)
      )
    );
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// The storm at a click: the object containing the point, or the nearest one.
radar.get("/objects/near", async (req: Request, res: Response) => {
  try {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      res.status(400).json({ error: "lat and lon are required numbers" });
      return;
    }
    res.send(await Mrms.objectNear(lat, lon, parseAt(req.query.at)));
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});
