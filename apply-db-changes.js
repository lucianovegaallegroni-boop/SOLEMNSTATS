const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

const sql = `
-- 1. Crear la tabla de ligas
CREATE TABLE IF NOT EXISTS leagues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    points_participation NUMERIC(10, 2) DEFAULT 0,
    points_1st NUMERIC(10, 2) DEFAULT 0,
    points_2nd NUMERIC(10, 2) DEFAULT 0,
    points_3rd NUMERIC(10, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Asegurar que las columnas de puntos sean decimales en ligas existentes
DO $$ 
BEGIN 
    ALTER TABLE leagues ALTER COLUMN points_participation TYPE NUMERIC(10, 2);
    ALTER TABLE leagues ALTER COLUMN points_1st TYPE NUMERIC(10, 2);
    ALTER TABLE leagues ALTER COLUMN points_2nd TYPE NUMERIC(10, 2);
    ALTER TABLE leagues ALTER COLUMN points_3rd TYPE NUMERIC(10, 2);
END $$;

-- 3. Asegurar que los puntos en league_results sean decimales
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='league_results') THEN
        ALTER TABLE league_results ALTER COLUMN points TYPE NUMERIC(10, 2);
    END IF;
END $$;

-- 4. Actualizar la tabla de torneos de liga
-- Primero verificamos si la columna existe antes de añadirla
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='league_tournaments' AND column_name='league_id') THEN
        ALTER TABLE league_tournaments ADD COLUMN league_id UUID REFERENCES leagues(id);
    END IF;
END $$;

-- 5. Actualizar la vista de clasificación (Standings)
CREATE OR REPLACE VIEW league_standings AS
SELECT 
    lr.player_name,
    lt.league_id,
    SUM(lr.points) as total_points,
    COUNT(lt.id) as tournaments_played,
    MAX(lt.date) as last_active
FROM league_results lr
JOIN league_tournaments lt ON lr.tournament_id = lt.id
GROUP BY lr.player_name, lt.league_id;
`;

async function apply() {
  try {
    await client.connect();
    console.log('Connected to database');
    await client.query(sql);
    console.log('SQL applied successfully');
  } catch (err) {
    console.error('Error applying SQL:', err);
  } finally {
    await client.end();
  }
}

apply();
