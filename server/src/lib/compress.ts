/**
 * gzip JSON responses when the client asks for it.
 *
 * Contour frames are the reason: a Texas cloud-cover window is hundreds of
 * kilobytes uncompressed, a country view more. Node's zlib, no extra package.
 * Bodies under 1 KB (healthcheck, errors, empty frames) stay plain.
 */

// Node
import { gzipSync } from "node:zlib";

// Express
import type { Request, Response, NextFunction } from "express";

const MIN_BYTES = 1024;

export function gzipJson(req: Request, res: Response, next: NextFunction) {
  const accept = String(req.headers["accept-encoding"] ?? "");
  if (!/\bgzip\b/i.test(accept)) return next();

  const send = res.send.bind(res);
  res.send = ((body?: unknown) => {
    if (body == null || res.getHeader("Content-Encoding")) {
      return send(body as never);
    }
    let buf: Buffer;
    if (Buffer.isBuffer(body)) {
      buf = body;
    } else if (typeof body === "string") {
      buf = Buffer.from(body);
    } else if (typeof body === "object") {
      buf = Buffer.from(JSON.stringify(body));
      if (!res.getHeader("Content-Type")) {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
      }
    } else {
      return send(body as never);
    }
    if (buf.length < MIN_BYTES) return send(buf);
    const gz = gzipSync(buf);
    res.setHeader("Content-Encoding", "gzip");
    return send(gz);
  }) as Response["send"];

  next();
}
