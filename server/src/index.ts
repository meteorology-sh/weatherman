// Express
import express, { Request, Response } from "express";

// Middleware
import cors from "cors";

// Routers
import { forecast } from "./routers/forecast";
import { pireps } from "./routers/pirep";
import { radar } from "./routers/radar";

// Types
import { Express } from "express";

const app: Express = express();
const host = "0.0.0.0";
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use("/forecast", forecast);
app.use("/pireps", pireps);
app.use("/radar", radar);

app.get("/healthcheck", (req: Request, res: Response) => {
  res.send("Hello, world!");
});

app.listen(port, () => {
  console.log(`Server is running on ${host}:${port}`);
});
