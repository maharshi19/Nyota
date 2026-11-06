import { PillarType, TeamMember, UserSession } from '../types';

type PillarAccess = Pick<TeamMember, 'dashboardAccess' | 'communityCareAccess'> & {
  accessLevel?: UserSession['accessLevel'];
};

const ALL_PILLARS: PillarType[] = ['mco', 'clinical', 'community'];

export function getAllowedPillars(user: PillarAccess): PillarType[] {
  if (user.accessLevel === 'admin' || user.accessLevel === 'supervisor') {
    return ALL_PILLARS;
  }

  const allowedPillars: PillarType[] = user.dashboardAccess
    ? [user.dashboardAccess]
    : ['mco', 'clinical'];

  if (user.communityCareAccess && !allowedPillars.includes('community')) {
    allowedPillars.push('community');
  }

  return allowedPillars;
}
