import { getDatabase } from '../config/database';

export interface Participant {
  id?: number;
  email: string;
  fullName: string;
  netId: string;
  frontendExperience: 'Beginner' | 'Intermediate' | 'Advanced';
  backendExperience: 'Beginner' | 'Intermediate' | 'Advanced';
  designExperience: 'Beginner' | 'Intermediate' | 'Advanced';
  hardwareExperience: 'Beginner' | 'Intermediate' | 'Advanced';
  frontendPreference: number; // 1-5
  backendPreference: number; // 1-5
  designPreference: number; // 1-5
  hardwarePreference: number; // 1-5
  anyRolePreference: number; // 1-5
  frontendSkills: string[];
  backendSkills: string[];
  designSkills: string[];
  hardwareSkills: string[];
  hackerType: 'FirstTimeHacker' | 'VeteranHacker';
  poolId?: string;
  createdAt?: string;
}

export class ParticipantModel {
  static async create(participant: Participant): Promise<Participant> {
    const db = getDatabase();
    
    try {
      const result = await db.runAsync(
        `INSERT INTO participants (
          email, fullName, netId, frontendExperience, backendExperience, 
          designExperience, hardwareExperience, frontendPreference, 
          backendPreference, designPreference, hardwarePreference, 
          anyRolePreference, frontendSkills, backendSkills, designSkills, 
          hardwareSkills, hackerType, poolId
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          participant.email,
          participant.fullName,
          participant.netId,
          participant.frontendExperience,
          participant.backendExperience,
          participant.designExperience,
          participant.hardwareExperience,
          participant.frontendPreference,
          participant.backendPreference,
          participant.designPreference,
          participant.hardwarePreference,
          participant.anyRolePreference,
          JSON.stringify(participant.frontendSkills),
          JSON.stringify(participant.backendSkills),
          JSON.stringify(participant.designSkills),
          JSON.stringify(participant.hardwareSkills),
          participant.hackerType,
          participant.poolId || 'default'
        ]
      );
      
      if (!result) {
        throw new Error('Database insert failed - no result returned');
      }
      
      const insertedId = result.lastID;
      if (!insertedId) {
        throw new Error('Database insert failed - no ID returned');
      }
      
      return { ...participant, id: insertedId };
    } catch (error) {
      console.error('Database insert error:', error);
      throw error;
    }
  }

  static async findAll(poolId: string = 'default'): Promise<Participant[]> {
    const db = getDatabase();
    const rows = await db.allAsync('SELECT * FROM participants WHERE poolId = ? ORDER BY createdAt DESC', [poolId]);
    
    return rows.map(this.mapRowToParticipant);
  }

  static async findById(id: number): Promise<Participant | null> {
    const db = getDatabase();
    const row = await db.getAsync('SELECT * FROM participants WHERE id = ?', [id]);
    
    return row ? this.mapRowToParticipant(row) : null;
  }

  static async deleteById(id: number): Promise<boolean> {
    const db = getDatabase();
    const result = await db.runAsync('DELETE FROM participants WHERE id = ?', [id]);
    
    return result.changes! > 0;
  }

  static async deleteByPoolId(poolId: string): Promise<number> {
    const db = getDatabase();
    const result = await db.runAsync('DELETE FROM participants WHERE poolId = ?', [poolId]);
    
    return result.changes || 0;
  }

  private static mapRowToParticipant(row: any): Participant {
    return {
      id: row.id,
      email: row.email,
      fullName: row.fullName,
      netId: row.netId,
      frontendExperience: row.frontendExperience,
      backendExperience: row.backendExperience,
      designExperience: row.designExperience,
      hardwareExperience: row.hardwareExperience,
      frontendPreference: row.frontendPreference,
      backendPreference: row.backendPreference,
      designPreference: row.designPreference,
      hardwarePreference: row.hardwarePreference,
      anyRolePreference: row.anyRolePreference,
      frontendSkills: JSON.parse(row.frontendSkills || '[]'),
      backendSkills: JSON.parse(row.backendSkills || '[]'),
      designSkills: JSON.parse(row.designSkills || '[]'),
      hardwareSkills: JSON.parse(row.hardwareSkills || '[]'),
      hackerType: row.hackerType,
      poolId: row.poolId,
      createdAt: row.createdAt
    };
  }
}