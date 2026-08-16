import express from "express";
import { pipeline } from "stream/promises";
import { createReadStream } from "fs";
import { unlink } from "fs/promises";
import { randomUUID } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const app = express();
app.use(express.json());

const SERVICE_TOKEN = process.env.SERVICE_TOKEN;

app.get("/health", (req, res) => res.json({ ok: true }));

app.post("/cut", async (req, res) => {
  if (SERVICE_TOKEN && req.get("x-api-key") !== SERVICE_TOKEN) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const { sourceUrl, start, end } = req.body || {};
  if (!sourceUrl || start === undefined || end === undefined) {
    return res.status(400).json({ error: "sourceUrl, start, and end are required" });
  }

  const duration = Number(end) - Number(start);
  if (!(duration > 0)) {
    return res.status(400).json({ error: "end must be greater than start" });
  }

  const id = randomUUID();
  const outputPath = `/tmp/out-${id}.mp4`;

  try {
    await execFileAsync("ffmpeg", [
      "-y",
      "-loglevel", "error",
      "-ss", String(start),
      "-i", sourceUrl,
      "-t", String(duration),
      "-c:v", "libx264",
      "-c:a", "aac",
      "-movflags", "+faststart",
      outputPath,
    ]);

    res.setHeader("Content-Type", "video/mp4");
    await pipeline(createReadStream(outputPath), res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  } finally {
    unlink(outputPath).catch(() => {});
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`ffmpeg service listening on ${port}`));