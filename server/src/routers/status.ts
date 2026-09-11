// Express
import express, { Request, Response } from "express";

// Services
import { Notices } from "../lib/services/shared/notices";

export const status = express.Router();

// Every source currently drawing something other than its own live feed. Empty
// when none is. Read from memory, so it never waits on a build.
status.get("/notices", (_req: Request, res: Response) => {
  res.send(Notices.list());
});
