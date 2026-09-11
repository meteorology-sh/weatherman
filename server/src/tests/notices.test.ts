// Node
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

// Express
import express from "express";

// Routers
import { status } from "../routers/status";

// Services
import {
  LOOKS_WRONG,
  NoticeBoard,
  Notices,
  REQUEST_FAILED,
  watch,
} from "../lib/services/shared/notices";

const SOURCE = "MRMS echo top";

const wrong = { detail: LOOKS_WRONG, delayMinutes: 4 };

describe("NoticeBoard", () => {
  // A service reports on every rebuild. If each report restarted the clock, a
  // notice closed in the panel would come back five minutes later.
  it("keeps when a problem began while it goes on", () => {
    const board = new NoticeBoard();
    board.report(SOURCE, wrong, new Date("2026-09-11T01:18:00.000Z"));
    board.report(
      SOURCE,
      { ...wrong, delayMinutes: 6 },
      new Date("2026-09-11T01:23:00.000Z")
    );

    const [notice] = board.list();
    assert.equal(notice.since, "2026-09-11T01:18:00.000Z");
    assert.equal(notice.id, `${SOURCE}@2026-09-11T01:18:00.000Z`);
    assert.equal(notice.delayMinutes, 6);
  });

  it("starts a new notice when the problem changes", () => {
    const board = new NoticeBoard();
    board.report(SOURCE, wrong, new Date("2026-09-11T01:18:00.000Z"));
    board.report(
      SOURCE,
      { detail: REQUEST_FAILED, delayMinutes: null },
      new Date("2026-09-11T01:23:00.000Z")
    );

    const [notice] = board.list();
    assert.equal(notice.since, "2026-09-11T01:23:00.000Z");
    assert.equal(notice.detail, REQUEST_FAILED);
  });

  it("holds one notice per source", () => {
    const board = new NoticeBoard();
    board.report(SOURCE, wrong);
    board.report(SOURCE, wrong);
    board.report("GOES-East cloud top", wrong);

    assert.equal(board.list().length, 2);
  });

  it("takes a source off once it answers well", () => {
    const board = new NoticeBoard();
    board.report(SOURCE, wrong);
    board.clear(SOURCE);

    assert.deepEqual(board.list(), []);
  });
});

describe("watch", () => {
  it("reports a failed request and still fails", async () => {
    const board = new NoticeBoard();

    await assert.rejects(
      watch(SOURCE, Promise.reject(new Error("503")), undefined, board),
      /503/
    );

    assert.equal(board.list()[0].detail, REQUEST_FAILED);
  });

  it("reports an answer that looks wrong and still returns it", async () => {
    const board = new NoticeBoard();

    const answer = await watch(
      SOURCE,
      Promise.resolve([]),
      (cells) => cells.length === 0,
      board
    );

    assert.deepEqual(answer, []);
    assert.equal(board.list()[0].detail, LOOKS_WRONG);
  });

  it("takes the source off when the answer is good", async () => {
    const board = new NoticeBoard();
    board.report(SOURCE, wrong);

    await watch(SOURCE, Promise.resolve([1]), (cells) => !cells.length, board);

    assert.deepEqual(board.list(), []);
  });
});

describe("status router", () => {
  let server: Server;
  let origin: string;

  before(async () => {
    const app = express();
    app.use("/status", status);
    await new Promise<void>((resolve, reject) => {
      server = app.listen(0, "127.0.0.1", (error) =>
        error ? reject(error) : resolve()
      );
    });
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(() => {
    Notices.clear(SOURCE);
    server.close();
  });

  it("answers an empty list while every source is fine", async () => {
    const res = await fetch(`${origin}/status/notices`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), []);
  });

  it("lists what the services have reported", async () => {
    Notices.report(SOURCE, wrong, new Date("2026-09-11T01:18:00.000Z"));

    const res = await fetch(`${origin}/status/notices`);
    const body = await res.json();
    assert.equal(body.length, 1);
    assert.equal(body[0].source, SOURCE);
    assert.equal(body[0].detail, LOOKS_WRONG);
    assert.equal(body[0].delayMinutes, 4);
  });
});
