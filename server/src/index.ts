// Express
import express, { Request, Response } from "express";

// Middleware
import cors from "cors";
import { gzipJson } from "./lib/compress";

// Routers
import { candidate } from "./routers/candidate";
import { cloudtop } from "./routers/cloudtop";
import { forecast } from "./routers/forecast";
import { radar } from "./routers/radar";
import { status } from "./routers/status";

// Types
import { Express } from "express";

const app: Express = express();
const host = "0.0.0.0";
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(gzipJson);
app.use("/candidate", candidate);
app.use("/cloudtop", cloudtop);
app.use("/forecast", forecast);
app.use("/radar", radar);
app.use("/status", status);

app.get("/healthcheck", (_req: Request, res: Response) => {
  res.send("Hello, world!");
});

app.listen(port, () => {
  console.log(`Server is running on ${host}:${port}`);
});
