import sqlite3 from 'sqlite3';
import { promisify } from 'util';

interface Database extends sqlite3.Database {
  runAsync: (sql: string, params?: any[]) => Promise<sqlite3.RunResult>;
  getAsync: (sql: string, params?: any[]) => Promise<any>;
  allAsync: (sql: string, params?: any[]) => Promise<any[]>;
}

let db: Database | null = null;

export const getDatabase = (): Database => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
};

export const initDatabase = async (dbPath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const database = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
        return;
      }
      
      // Add promisified methods
      (database as any).runAsync = function(sql: string, params?: any[]): Promise<sqlite3.RunResult> {
        return new Promise((resolve, reject) => {
          database.run(sql, params || [], function(this: sqlite3.RunResult, err: Error | null) {
            if (err) reject(err);
            else resolve(this);
          });
        });
      };
      (database as any).getAsync = promisify(database.get).bind(database);
      (database as any).allAsync = promisify(database.all).bind(database);
      
      db = database as Database;
      console.log(`✅ SQLite connected: ${dbPath}`);
      resolve();
    });
  });
};

export const createTables = async (): Promise<void> => {
  const database = getDatabase();
  
  await database.runAsync(`
    CREATE TABLE IF NOT EXISTS participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      fullName TEXT NOT NULL,
      netId TEXT NOT NULL,
      frontendExperience TEXT CHECK(frontendExperience IN ('Beginner', 'Intermediate', 'Advanced')) NOT NULL,
      backendExperience TEXT CHECK(backendExperience IN ('Beginner', 'Intermediate', 'Advanced')) NOT NULL,
      designExperience TEXT CHECK(designExperience IN ('Beginner', 'Intermediate', 'Advanced')) NOT NULL,
      hardwareExperience TEXT CHECK(hardwareExperience IN ('Beginner', 'Intermediate', 'Advanced')) NOT NULL,
      frontendPreference INTEGER CHECK(frontendPreference >= 1 AND frontendPreference <= 5) NOT NULL,
      backendPreference INTEGER CHECK(backendPreference >= 1 AND backendPreference <= 5) NOT NULL,
      designPreference INTEGER CHECK(designPreference >= 1 AND designPreference <= 5) NOT NULL,
      hardwarePreference INTEGER CHECK(hardwarePreference >= 1 AND hardwarePreference <= 5) NOT NULL,
      anyRolePreference INTEGER CHECK(anyRolePreference >= 1 AND anyRolePreference <= 5) NOT NULL,
      frontendSkills TEXT,
      backendSkills TEXT,
      designSkills TEXT,
      hardwareSkills TEXT,
      hackerType TEXT CHECK(hackerType IN ('FirstTimeHacker', 'VeteranHacker')) NOT NULL,
      poolId TEXT DEFAULT 'default',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await database.runAsync(`
    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teamNumber INTEGER NOT NULL,
      poolId TEXT NOT NULL DEFAULT 'default',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await database.runAsync(`
    CREATE TABLE IF NOT EXISTS team_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teamId INTEGER NOT NULL,
      participantId INTEGER NOT NULL,
      assignedRole TEXT,
      FOREIGN KEY (teamId) REFERENCES teams (id),
      FOREIGN KEY (participantId) REFERENCES participants (id)
    )
  `);

  console.log('✅ Database tables created successfully');
};