import data from "@/data/portfolioConfig.json";

export type Project = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  status: string;
  badge: string;
  techStack: string[];
  features: string[];
  githubUrl: string;
  stats?: string[];
  image?: string;
  imageAlt?: string;
  // Extra screens shown on the project page, under the description.
  gallery?: { src: string; caption: string }[];
};

export type Achievement = (typeof data.achievements)[number];

export const personal = data.personalInfo;
export const achievements: Achievement[] = data.achievements;
export const skillGroups: { name: string; items: string[] }[] = data.skillGroups;
export const now: string[] = data.now;

const projects = data.projects as Project[];

// Gallery order: strongest work first, client covers spread out between the rest.
const WORK_ORDER = [
  "blackonyx",
  "floodline",
  "codeguard",
  "audiolens",
  "etherwave",
  "client-erp",
  "starbell",
  "fotocode",
  "client-payments",
  "client-pricing",
];

export const works: Project[] = WORK_ORDER.map((id) => projects.find((p) => p.id === id)).filter(
  (p): p is Project => Boolean(p)
);

export function projectById(id: string) {
  return projects.find((p) => p.id === id);
}
