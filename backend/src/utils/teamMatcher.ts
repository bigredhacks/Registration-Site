import { Participant } from '../types/participant';

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
    const firstTimeHackers = participants.filter(p => p.hacker_type === 'FirstTimeHacker');
    const veteranHackers = participants.filter(p => p.hacker_type === 'VeteranHacker');

    const teams: Participant[][] = [];
    const usedParticipantIds = new Set<string>();

    // Form teams with first-time hackers first (with hardware grouping)
    const firstTimeTeams = this.formTeamsForGroupWithHardwarePriority(firstTimeHackers, teamSize);
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

    // Form mixed teams with remaining participants (with hardware grouping)
    const mixedTeams = this.formTeamsForGroupWithHardwarePriority(allRemaining, teamSize);
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


  private static formTeamsForGroupWithHardwarePriority(participants: Participant[], teamSize: number): Participant[][] {
    const teams: Participant[][] = [];
    let availableParticipants = [...participants];

    // Separate hardware-oriented and non-hardware participants
    const hardwareParticipants = availableParticipants.filter(p => this.isHardwareOriented(p));
    const nonHardwareParticipants = availableParticipants.filter(p => !this.isHardwareOriented(p));

    // First, try to form teams with multiple hardware people when possible
    while (hardwareParticipants.length >= 3 && availableParticipants.length >= teamSize) {
      const team = this.formHardwareFocusedTeam(availableParticipants, teamSize);
      if (team.length >= teamSize) {
        teams.push(team);

        // Remove team members from all available lists
        team.forEach(member => {
          const hardwareIndex = hardwareParticipants.findIndex(p => p.id === member.id);
          if (hardwareIndex !== -1) hardwareParticipants.splice(hardwareIndex, 1);

          const nonHardwareIndex = nonHardwareParticipants.findIndex(p => p.id === member.id);
          if (nonHardwareIndex !== -1) nonHardwareParticipants.splice(nonHardwareIndex, 1);

          const availableIndex = availableParticipants.findIndex(p => p.id === member.id);
          if (availableIndex !== -1) availableParticipants.splice(availableIndex, 1);
        });
      } else {
        break;
      }
    }

    // Form remaining teams normally
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

  private static isHardwareOriented(participant: Participant): boolean {
    // Consider someone hardware-oriented if they have:
    // - High hardware preference (4 or 5)
    // - OR intermediate/advanced hardware experience
    // - OR hardware skills
    const hasHighHardwarePreference = participant.hardware_preference >= 4;
    const hasHardwareExperience = ['Intermediate', 'Advanced'].includes(participant.hardware_experience);
    const hasHardwareSkills = participant.hardware_skills && participant.hardware_skills.length > 0;

    return hasHighHardwarePreference || hasHardwareExperience || hasHardwareSkills;
  }

  private static formHardwareFocusedTeam(participants: Participant[], teamSize: number): Participant[] {
    const team: Participant[] = [];
    const hardwareParticipants = participants.filter(p => this.isHardwareOriented(p));

    // Try to include at least 3 hardware people if available
    const hardwareToAdd = Math.min(hardwareParticipants.length, Math.max(3, Math.floor(teamSize / 2)));

    // Sort hardware participants by preference and experience
    const sortedHardware = hardwareParticipants.sort((a, b) => {
      const aScore = a.hardware_preference + this.getRoleExperience(a, 'hardware');
      const bScore = b.hardware_preference + this.getRoleExperience(b, 'hardware');
      return bScore - aScore;
    });

    // Add hardware participants
    for (let i = 0; i < hardwareToAdd && i < sortedHardware.length; i++) {
      team.push(sortedHardware[i]);
    }

    // Fill remaining spots with optimal assignments
    let remainingParticipants = participants.filter(p => !team.some(member => member.id === p.id));
    const assignedRoles = new Set<Role>(['hardware']); // Hardware role is prioritized

    // Add other roles as needed
    for (const role of ['frontend', 'backend', 'design']) {
      if (team.length >= teamSize) break;

      const bestCandidate = this.findBestCandidateForRole(remainingParticipants, role as Role, assignedRoles);
      if (bestCandidate) {
        team.push(bestCandidate.participant);
        assignedRoles.add(role as Role);
        remainingParticipants = remainingParticipants.filter(p => p.id !== bestCandidate.participant.id);
      }
    }

    // Fill any remaining spots
    while (team.length < teamSize && remainingParticipants.length > 0) {
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

      if (!bestCandidate || this.isBetterAssignment(assignment, bestCandidate)) {
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
      case 'frontend': return participant.frontend_preference;
      case 'backend': return participant.backend_preference;
      case 'design': return participant.design_preference;
      case 'hardware': return participant.hardware_preference;
      default: return participant.any_role_preference;
    }
  }

  private static getRoleExperience(participant: Participant, role: Role): number {
    let experience: ExperienceLevel;

    switch (role) {
      case 'frontend': experience = participant.frontend_experience; break;
      case 'backend': experience = participant.backend_experience; break;
      case 'design': experience = participant.design_experience; break;
      case 'hardware': experience = participant.hardware_experience; break;
      default: experience = 'Beginner';
    }

    return this.EXPERIENCE_SCORES[experience];
  }

  private static isBetterAssignment(a: RoleAssignment, b: RoleAssignment): boolean {
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
    let totalScore = participant.any_role_preference;

    for (const role of this.ROLES) {
      if (!assignedRoles.has(role)) {
        totalScore += this.getRolePreference(participant, role);
      }
    }

    return totalScore;
  }
}
