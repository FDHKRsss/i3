import pg from "pg";

const { Pool } = pg;

export interface ReportRow {
  id: string;
  created_at: Date;
  lat: number | null;
  lon: number | null;
  audio_path: string;
  image_path: string | null;
  geo_desc: string | null;
}

const connectionString =
  process.env.DATABASE_URL ??
  "postgres://civil42:civil42@db:5432/civil42";

const pool = new Pool({
  connectionString,
  max: 10,
  connectionTimeoutMillis: 5000,
});

export async function ping(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

export async function insertReport(input: {
  lat: number | null;
  lon: number | null;
  audioPath: string;
  imagePath: string | null;
  geoDesc: string;
}): Promise<ReportRow> {
  const result = await pool.query(
    `INSERT INTO reports (lat, lon, audio_path, image_path, geo_desc)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, created_at, lat, lon, audio_path, image_path, geo_desc`,
    [input.lat, input.lon, input.audioPath, input.imagePath, input.geoDesc]
  );
  return result.rows[0] as ReportRow;
}

export async function listReports(limit: number): Promise<ReportRow[]> {
  const result = await pool.query(
    `SELECT id, created_at, lat, lon, audio_path, image_path, geo_desc
     FROM reports
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}
