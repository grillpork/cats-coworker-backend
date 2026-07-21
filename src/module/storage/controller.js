import { db } from "../../config/db.js";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { r2Client, R2_BUCKET_NAME } from "../../middleware/r2.js";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";

export const getStorageStats = async (req, res) => {
  try {
    // 1. Get database size from PostgreSQL
    let dbSizeBytes = 0;
    try {
      const dbSizeResult = await db.execute(sql`SELECT pg_database_size(current_database())`);
      dbSizeBytes = parseInt(dbSizeResult.rows[0]?.pg_database_size || "0", 10);
    } catch (dbErr) {
      console.error("DB size query failed:", dbErr);
    }

    // 2. Get local uploads folder size
    let localSizeBytes = 0;
    const uploadDir = "uploads/";
    const localFiles = [];
    if (fs.existsSync(uploadDir)) {
      const files = fs.readdirSync(uploadDir);
      for (const file of files) {
        const stats = fs.statSync(path.join(uploadDir, file));
        if (stats.isFile()) {
          localSizeBytes += stats.size;
          localFiles.push({
            name: file,
            sizeBytes: stats.size,
            sizePretty: (stats.size / 1024).toFixed(2) + " KB",
            createdAt: stats.mtime
          });
        }
      }
    }

    // 3. Get Cloudflare R2 size
    let r2SizeBytes = 0;
    let r2FilesCount = 0;
    const r2Objects = [];
    let r2Configured = false;

    if (R2_BUCKET_NAME && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY) {
      r2Configured = true;
      try {
        const command = new ListObjectsV2Command({
          Bucket: R2_BUCKET_NAME,
        });
        const response = await r2Client.send(command);
        const contents = response.Contents || [];
        r2FilesCount = contents.length;
        for (const item of contents) {
          r2SizeBytes += item.Size;
          r2Objects.push({
            key: item.Key,
            sizeBytes: item.Size,
            sizePretty: (item.Size / 1024).toFixed(2) + " KB",
            lastModified: item.LastModified
          });
        }
      } catch (r2Err) {
        console.error("R2 size query failed:", r2Err);
      }
    }

    res.json({
      db: {
        sizeBytes: dbSizeBytes,
        sizePretty: (dbSizeBytes / 1024 / 1024).toFixed(2) + " MB"
      },
      local: {
        sizeBytes: localSizeBytes,
        sizePretty: (localSizeBytes / 1024 / 1024).toFixed(2) + " MB",
        files: localFiles
      },
      r2: {
        configured: r2Configured,
        bucketName: R2_BUCKET_NAME || "Not Configured",
        sizeBytes: r2SizeBytes,
        sizePretty: (r2SizeBytes / 1024 / 1024).toFixed(2) + " MB",
        filesCount: r2FilesCount,
        files: r2Objects
      }
    });
  } catch (error) {
    console.error("Get Storage Stats Error:", error);
    res.status(500).json({ error: error.message });
  }
};
