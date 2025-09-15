import { Participant } from '../models/Participant';

type Role = 'frontend' | 'backend' | 'design' | 'hardware';
type ExperienceLevel = 'Beginner' | 'Intermediate' | 'Advanced';

interface RoleAssignment {
  participant: Participant;
  role: Role;
  preferenceScore: number;
  experienceScore: number;
}

export class TeamMatcher {
  private static readonly ROLES: Role[] = ['frontend', 'backend', 'design', 'hardware'];
  private static readonly EXPERIENCE_SCORES = {
    'Beginner': 1,
    'Intermediate': 2,
    'Advanced': 3
  };

  static formTeams(participants: Participant[], teamSize: number = 4, poolId: string = 'default'): Participant[][] {
    if (participants.length < teamSize) {
      throw new Error('Not enough participants to form teams of the requested size');
    }

    // Separate by hacker type
    const firstTimeHackers = participants.filter(p => p.hackerType === 'FirstTimeHacker');
    const veteranHackers = participants.filter(p => p.hackerType === 'VeteranHacker');

    const teams: Participant[][] = [];
    const usedParticipantIds = new Set<number>();

    // Form teams with first-time hackers first
    const firstTimeTeams = this.formTeamsForGroup(firstTimeHackers, teamSize);
    teams.push(...firstTimeTeams);

    // Track used participants from first-time teams
    firstTimeTeams.forEach(team => {
      team.forEach(participant => {
        usedParticipantIds.add(participant.id!);
      });
    });

    // Get remaining participants (unused first-timers + all veterans)
    const remainingFirstTime = firstTimeHackers.filter(p => !usedParticipantIds.has(p.id!));
    const allRemaining = [...remainingFirstTime, ...veteranHackers];

    // Form mixed teams with remaining participants
    const mixedTeams = this.formTeamsForGroup(allRemaining, teamSize);
    teams.push(...mixedTeams);

    // Track used participants from mixed teams
    mixedTeams.forEach(team => {
      team.forEach(participant => {
        usedParticipantIds.add(participant.id!);
      });
    });

    // Only add remaining participants if they form a meaningful team (at least 2 people)
    // and avoid duplicates by checking against usedParticipantIds
    const remainingParticipants = allRemaining.filter(p => !usedParticipantIds.has(p.id!));
    if (remainingParticipants.length >= 2) {
      teams.push(remainingParticipants);
    }

    return teams;
  }

  private static formTeamsForGroup(participants: Participant[], teamSize: number): Participant[][] {
    const teams: Participant[][] = [];
    let availableParticipants = [...participants];

    while (availableParticipants.length >= teamSize) {
      const team = this.formOptimalTeam(availableParticipants, teamSize);
      teams.push(team);
      
      // Remove team members from available participants
      availableParticipants = availableParticipants.filter(
        p => !team.some(member => member.id === p.id)
      );
    }

    return teams;
  }

  private static formOptimalTeam(participants: Participant[], teamSize: number): Participant[] {
    const team: Participant[] = [];
    const assignedRoles = new Set<Role>();
    let remainingParticipants = [...participants];

    // Phase 1: Assign participants to their most preferred roles
    for (const role of this.ROLES) {
      if (assignedRoles.has(role) || team.length >= teamSize) continue;

      const bestCandidate = this.findBestCandidateForRole(remainingParticipants, role, assignedRoles);
      
      if (bestCandidate) {
        team.push(bestCandidate.participant);
        assignedRoles.add(role);
        remainingParticipants = remainingParticipants.filter(p => p.id !== bestCandidate.participant.id);
      }
    }

    // Phase 2: Fill remaining spots with best overall matches
    while (team.length < teamSize && remainingParticipants.length > 0) {
      // Find participant with highest preference for any unassigned role
      let bestMatch: { participant: Participant; score: number } | null = null;

      for (const participant of remainingParticipants) {
        const score = this.calculateOverallScore(participant, assignedRoles);
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { participant, score };
        }
      }

      if (bestMatch) {
        team.push(bestMatch.participant);
        remainingParticipants = remainingParticipants.filter(p => p.id !== bestMatch!.participant.id);
      } else {
        break;
      }
    }

    return team;
  }

  private static findBestCandidateForRole(
    participants: Participant[], 
    role: Role, 
    assignedRoles: Set<Role>
  ): RoleAssignment | null {
    let bestCandidate: RoleAssignment | null = null;

    for (const participant of participants) {
      const assignment = this.evaluateParticipantForRole(participant, role);
      
      if (!bestCandidate || this.isBeautiferAssignment(assignment, bestCandidate)) {
        bestCandidate = assignment;
      }
    }

    return bestCandidate;
  }

  private static evaluateParticipantForRole(participant: Participant, role: Role): RoleAssignment {
    const preferenceScore = this.getRolePreference(participant, role);
    const experienceScore = this.getRoleExperience(participant, role);

    return {
      participant,
      role,
      preferenceScore,
      experienceScore
    };
  }

  private static getRolePreference(participant: Participant, role: Role): number {
    switch (role) {
      case 'frontend': return participant.frontendPreference;
      case 'backend': return participant.backendPreference;
      case 'design': return participant.designPreference;
      case 'hardware': return participant.hardwarePreference;
      default: return participant.anyRolePreference;
    }
  }

  private static getRoleExperience(participant: Participant, role: Role): number {
    let experience: ExperienceLevel;
    
    switch (role) {
      case 'frontend': experience = participant.frontendExperience; break;
      case 'backend': experience = participant.backendExperience; break;
      case 'design': experience = participant.designExperience; break;
      case 'hardware': experience = participant.hardwareExperience; break;
      default: experience = 'Beginner';
    }

    return this.EXPERIENCE_SCORES[experience];
  }

  private static isBeautiferAssignment(a: RoleAssignment, b: RoleAssignment): boolean {
    // Prioritize by preference first (higher is better)
    if (a.preferenceScore !== b.preferenceScore) {
      return a.preferenceScore > b.preferenceScore;
    }
    
    // Then by experience level (closer to intermediate is often better for team balance)
    const aExperienceDiff = Math.abs(a.experienceScore - 2); // 2 = Intermediate
    const bExperienceDiff = Math.abs(b.experienceScore - 2);
    
    return aExperienceDiff < bExperienceDiff;
  }

  private static calculateOverallScore(participant: Participant, assignedRoles: Set<Role>): number {
    // Calculate score based on preference for unassigned roles and anyRole preference
    let totalScore = participant.anyRolePreference;
    
    for (const role of this.ROLES) {
      if (!assignedRoles.has(role)) {
        totalScore += this.getRolePreference(participant, role);
      }
    }
    
    return totalScore;
  }
}