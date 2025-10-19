import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import db from "@/lib/db";
import fs from "fs";
import path from "path";
import Busboy from "busboy";
import { Readable } from "stream";

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  let fileId: number | null = null;
  let tempFilePath: string | null = null;

  return new Promise(async (resolve) => {
    try {
      const uploadDir = "/shared-files";
      await fs.promises.mkdir(uploadDir, { recursive: true });

      const contentType = req.headers.get("content-type") || "";
      const busboy = Busboy({ headers: { "content-type": contentType } });

      let fileName = "";
      let fileSize = 0;
      let mimeType = "";

      busboy.on("file", async (fieldname, file, info) => {
        fileName = info.filename;
        mimeType = info.mimeType || "application/octet-stream";

        try {
          // 1️⃣ Create placeholder DB entry
          const [insertResult]: any = await db.query(
            `INSERT INTO files (name, size, mime_type, path, user_id) VALUES (?, ?, ?, '', ?)`,
            [fileName, 0, mimeType, userId]
          );

          fileId = insertResult.insertId;

          // 🔒 Sanitize extension
          const ext = path.extname(fileName).toLowerCase().replace(/[^a-z0-9.]/g, "");
          const safeExt = ext.startsWith(".") ? ext : "";
          const safeFileName = `${fileId}${safeExt}`;
          const filePath = path.join(uploadDir, safeFileName);
          tempFilePath = filePath;

          // 2️⃣ Stream directly to disk (true streaming!)
          const writeStream = fs.createWriteStream(filePath);
          
          file.on("data", (chunk) => {
            fileSize += chunk.length;
          });

          file.pipe(writeStream);

          writeStream.on("finish", async () => {
            // Check size limit after upload
            if (fileSize > 1024 * 1024 * 1024) {
              await fs.promises.unlink(filePath);
              await db.query(`DELETE FROM files WHERE id = ?`, [fileId]);
              resolve(
                NextResponse.json(
                  { error: "File size exceeds 1 GB limit" },
                  { status: 400 }
                )
              );
              return;
            }

            // 3️⃣ Update with real path and size
            await db.query(
              `UPDATE files SET path = ?, size = ? WHERE id = ? AND user_id = ?`,
              [filePath, fileSize, fileId, userId]
            );

            console.log(
              `✅ User ${userId} uploaded ${fileName} as ${filePath} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`
            );

            resolve(
              NextResponse.json({
                success: true,
                id: fileId,
                path: filePath,
              })
            );
          });

          writeStream.on("error", (err) => {
            console.error("❌ Write stream error:", err);
            resolve(
              NextResponse.json(
                { error: "Failed to write file" },
                { status: 500 }
              )
            );
          });
        } catch (err: any) {
          console.error("❌ Upload error:", err);
          resolve(
            NextResponse.json(
              { error: err.message || "Upload failed" },
              { status: 500 }
            )
          );
        }
      });

      busboy.on("error", async (err) => {
        console.error("❌ Busboy error:", err);
        
        // Cleanup
        if (tempFilePath) {
          try {
            await fs.promises.unlink(tempFilePath);
          } catch {}
        }
        if (fileId) {
          try {
            await db.query(`DELETE FROM files WHERE id = ?`, [fileId]);
          } catch {}
        }

        resolve(
          NextResponse.json(
            { error: "Upload parsing failed" },
            { status: 500 }
          )
        );
      });

      // Convert Request body to Node.js stream
      const reader = req.body?.getReader();
      if (!reader) {
        resolve(
          NextResponse.json({ error: "No request body" }, { status: 400 })
        );
        return;
      }

      const stream = new Readable({
        async read() {
          const { done, value } = await reader.read();
          if (done) {
            this.push(null);
          } else {
            this.push(Buffer.from(value));
          }
        },
      });

      stream.pipe(busboy);
    } catch (err: any) {
      console.error("❌ Setup error:", err);
      resolve(
        NextResponse.json(
          { error: err.message || "Internal server error" },
          { status: 500 }
        )
      );
    }
  });
}