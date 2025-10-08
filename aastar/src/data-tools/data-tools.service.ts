import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as fs from "fs";
import * as path from "path";
import * as tar from "tar";
import * as zlib from "zlib";

@Injectable()
export class DataToolsService {
  private readonly dataDir: string;
  private readonly correctPassword: string;

  constructor(private configService: ConfigService) {
    this.dataDir = path.join(process.cwd(), "data");
    this.correctPassword = this.configService.get<string>("DATA_TOOLS_PASSWORD") || "admin123456";
  }

  private verifyPassword(password: string): void {
    if (password !== this.correctPassword) {
      throw new UnauthorizedException("Invalid password");
    }
  }

  async exportData(password: string): Promise<Buffer> {
    this.verifyPassword(password);

    // Check if data directory exists
    if (!fs.existsSync(this.dataDir)) {
      throw new Error("Data directory not found");
    }

    // Create temporary tar.gz file
    const tempDir = path.join(process.cwd(), "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const timestamp = Date.now();
    const tarPath = path.join(tempDir, `data-${timestamp}.tar`);
    const gzPath = path.join(tempDir, `data-${timestamp}.tar.gz`);

    try {
      // Create tar archive
      await tar.create(
        {
          file: tarPath,
          cwd: path.dirname(this.dataDir),
        },
        [path.basename(this.dataDir)]
      );

      // Compress with gzip
      const input = fs.createReadStream(tarPath);
      const output = fs.createWriteStream(gzPath);
      const gzip = zlib.createGzip();

      await new Promise<void>((resolve, reject) => {
        input
          .pipe(gzip)
          .pipe(output)
          .on("finish", () => resolve())
          .on("error", reject);
      });

      // Read the compressed file
      const buffer = fs.readFileSync(gzPath);

      // Clean up temporary files
      fs.unlinkSync(tarPath);
      fs.unlinkSync(gzPath);

      return buffer;
    } catch (error) {
      // Clean up on error
      if (fs.existsSync(tarPath)) fs.unlinkSync(tarPath);
      if (fs.existsSync(gzPath)) fs.unlinkSync(gzPath);
      throw error;
    }
  }

  /**
   * Copy directory recursively (cross-device compatible)
   * Use copy instead of rename to avoid EXDEV errors on cloud platforms
   */
  private copyDirSync(src: string, dest: string): void {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        this.copyDirSync(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  async importData(password: string, base64Data: string): Promise<void> {
    this.verifyPassword(password);

    const tempDir = path.join(process.cwd(), "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const timestamp = Date.now();
    const gzPath = path.join(tempDir, `import-${timestamp}.tar.gz`);
    const tarPath = path.join(tempDir, `import-${timestamp}.tar`);

    try {
      // Decode base64 data
      const buffer = Buffer.from(base64Data, "base64");
      fs.writeFileSync(gzPath, buffer);

      // Decompress
      const input = fs.createReadStream(gzPath);
      const output = fs.createWriteStream(tarPath);
      const gunzip = zlib.createGunzip();

      await new Promise<void>((resolve, reject) => {
        input
          .pipe(gunzip)
          .pipe(output)
          .on("finish", () => resolve())
          .on("error", reject);
      });

      // Backup existing data (use copy instead of rename for cross-device compatibility)
      const backupDir = path.join(tempDir, `data-backup-${timestamp}`);
      if (fs.existsSync(this.dataDir)) {
        this.copyDirSync(this.dataDir, backupDir);
      }

      try {
        // Remove old data directory after backup
        if (fs.existsSync(this.dataDir)) {
          fs.rmSync(this.dataDir, { recursive: true, force: true });
        }

        // Extract tar archive
        await tar.extract({
          file: tarPath,
          cwd: path.dirname(this.dataDir),
        });

        // Verify extraction was successful
        if (!fs.existsSync(this.dataDir)) {
          throw new Error("Data extraction failed");
        }

        // Remove backup if successful
        if (fs.existsSync(backupDir)) {
          fs.rmSync(backupDir, { recursive: true, force: true });
        }
      } catch (error) {
        // Restore backup on error
        if (fs.existsSync(backupDir)) {
          if (fs.existsSync(this.dataDir)) {
            fs.rmSync(this.dataDir, { recursive: true, force: true });
          }
          this.copyDirSync(backupDir, this.dataDir);
          fs.rmSync(backupDir, { recursive: true, force: true });
        }
        throw error;
      }

      // Clean up temporary files
      fs.unlinkSync(gzPath);
      fs.unlinkSync(tarPath);
    } catch (error) {
      // Clean up on error
      if (fs.existsSync(gzPath)) fs.unlinkSync(gzPath);
      if (fs.existsSync(tarPath)) fs.unlinkSync(tarPath);
      throw error;
    }
  }
}
