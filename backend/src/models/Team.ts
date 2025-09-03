import { getDatabase } from '../config/database';
import { Participant } from './Participant';

export interface Team {
  id?: number;
  teamNumber: number;
  poolId: string;
  members: (Participant & { assignedRole?: string })[];
  createdAt?: string;
}

export class TeamModel {
  static async create(team: Omit<Team, 'id' | 'createdAt'>): Promise<Team> {
    const db = getDatabase();
    
    // Start transaction
    await db.runAsync('BEGIN TRANSACTION');
    
    try {
      // Insert team
      const teamResult = await db.runAsync(
        'INSERT INTO teams (teamNumber, poolId) VALUES (?, ?)',
        [team.teamNumber, team.poolId]
      );
      
      const teamId = teamResult.lastID!;
      
      // Insert team members
      for (const member of team.members) {
        await db.runAsync(
          'INSERT INTO team_members (teamId, participantId, assignedRole) VALUES (?, ?, ?)',
          [teamId, member.id, member.assignedRole || null]
        );
      }
      
      await db.runAsync('COMMIT');
      
      return {
        id: teamId,
        teamNumber: team.teamNumber,
        poolId: team.poolId,
        members: team.members
      };
    } catch (error) {
      await db.runAsync('ROLLBACK');
      throw error;
    }
  }

  static async findByPoolId(poolId: string): Promise<Team[]> {
    const db = getDatabase();
    
    const teams = await db.allAsync(`
      SELECT t.id, t.teamNumber, t.poolId, t.createdAt,
             p.*, tm.assignedRole
      FROM teams t
      LEFT JOIN team_members tm ON t.id = tm.teamId
      LEFT JOIN participants p ON tm.participantId = p.id
      WHERE t.poolId = ?
      ORDER BY t.teamNumber, p.fullName
    `, [poolId]);
    
    // Group by team
    const teamMap = new Map<number, Team>();
    
    for (const row of teams) {
      if (!teamMap.has(row.id)) {
        teamMap.set(row.id, {
          id: row.id,
          teamNumber: row.teamNumber,
          poolId: row.poolId,
          members: [],
          createdAt: row.createdAt
        });
      }
      
      const team = teamMap.get(row.id)!;
      
      if (row.email) { // Only add if participant exists
        team.members.push({
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
          createdAt: row.createdAt,
          assignedRole: row.assignedRole
        });
      }
    }
    
    return Array.from(teamMap.values());
  }

  static async deleteByPoolId(poolId: string): Promise<number> {
    const db = getDatabase();
    
    await db.runAsync('BEGIN TRANSACTION');
    
    try {
      // Delete team members first
      await db.runAsync(`
        DELETE FROM team_members 
        WHERE teamId IN (SELECT id FROM teams WHERE poolId = ?)
      `, [poolId]);
      
      // Delete teams
      const result = await db.runAsync('DELETE FROM teams WHERE poolId = ?', [poolId]);
      
      await db.runAsync('COMMIT');
      
      return result.changes || 0;
    } catch (error) {
      await db.runAsync('ROLLBACK');
      throw error;
    }
  }
}