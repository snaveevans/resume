export interface Role {
  title: string;
  company: string;
  dates: string;
  location?: string;
  skills?: readonly string[];
}

export const roles: readonly Role[] = [
  { title: 'Staff Software Engineer', company: 'O.C. Tanner', dates: 'May 2025 – present', location: 'Salt Lake City, Utah · Hybrid', skills: ['PostgreSQL', 'Node.js', 'Technical Staff Management', 'Software Infrastructure'] },
  { title: 'Front End Architect', company: 'O.C. Tanner', dates: 'Jul 2022 – May 2025', location: 'Salt Lake City Metropolitan Area · Hybrid', skills: ['Front-End Development', 'User Experience (UX)', 'Web Architecture', 'Node.js', 'React.js', 'TypeScript', 'Docker Products'] },
  { title: 'Senior Software Engineer', company: 'O.C. Tanner', dates: 'Jun 2021 – Jul 2022', location: 'Salt Lake County, Utah' },
  { title: 'Software Engineer', company: '7 Oaks Group', dates: 'May 2018 – Dec 2021', location: 'Roy, Utah' },
  { title: 'Web Developer', company: 'Desert Mutual Benefits Administrators', dates: 'May 2015 – May 2018', location: 'Salt Lake City Metropolitan Area' },
  { title: 'Help Desk Tech', company: 'Desert Mutual Benefits Administrators', dates: 'May 2012 – May 2015' },
];
export const education = { degree: 'Bachelor of Applied Science (B.A.Sc.), Computer Science', school: 'Weber State University', dates: '2008 – 2015' } as const;
export const links = { github: 'https://github.com/snaveevans', linkedin: 'https://www.linkedin.com/in/tyler-evans-57392893', x: 'https://x.com/snaveevans116', plarea: 'https://www.plarea.dev' } as const;
export const plarea = { lead: 'We make small worlds to get lost in, and thoughtful tools to help bring new ones to life.', description: 'Plarea is a home for experiments with heart: games that reward a second thought and tools that put creative control in your hands.' } as const;
