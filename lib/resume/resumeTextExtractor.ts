/**
 * Utility to extract plain text from User resume parsedData
 */

interface ParsedResumeData {
  summary?: string;
  workHistory?: Array<{
    title?: string;
    company?: string;
    responsibilities?: string[];
    achievements?: string[];
  }>;
  education?: Array<{
    institution?: string;
    field?: { type?: string; course?: string };
    output?: string;
  }>;
  skills?: Array<{
    field?: string;
    tools?: Array<{ name?: string }>;
  }>;
  projects?: Array<{
    title?: string;
    description?: string;
    technologies?: string[];
  }>;
  certifications?: Array<{
    title?: string;
    issuer?: string;
  }>;
  languages?: Array<{
    name?: string;
    proficiency?: string;
  }>;
  awards?: Array<{
    title?: string;
    description?: string;
  }>;
}

/**
 * Extracts plain text content from resume.parsedData for AI/search purposes
 */
export function extractResumeText(parsedData: any): string {
  if (!parsedData) return '';

  const sections: string[] = [];

  // Summary
  if (parsedData.summary) {
    sections.push(`SUMMARY:\n${parsedData.summary}`);
  }

  // Work History
  if (parsedData.workHistory?.length) {
    sections.push('WORK EXPERIENCE:');
    parsedData.workHistory.forEach((work: any) => {
      const lines = [];
      if (work.title) lines.push(work.title);
      if (work.company) lines.push(`at ${work.company}`);
      if (work.responsibilities?.length) {
        lines.push('Responsibilities:');
        work.responsibilities.forEach((r: string) => lines.push(`- ${r}`));
      }
      if (work.achievements?.length) {
        lines.push('Achievements:');
        work.achievements.forEach((a: string) => lines.push(`- ${a}`));
      }
      sections.push(lines.join('\n'));
    });
  }

  // Education
  if (parsedData.education?.length) {
    sections.push('EDUCATION:');
    parsedData.education.forEach((edu: any) => {
      const lines = [];
      if (edu.field?.course) lines.push(edu.field.course);
      if (edu.field?.type) lines.push(edu.field.type);
      if (edu.institution) lines.push(`at ${edu.institution}`);
      if (edu.output) lines.push(edu.output);
      sections.push(lines.join('\n'));
    });
  }

  // Skills
  if (parsedData.skills?.length) {
    sections.push('SKILLS:');
    parsedData.skills.forEach((skill: any) => {
      const lines = [];
      if (skill.field) lines.push(skill.field);
      if (skill.tools?.length) {
        const toolNames = skill.tools.map((t: any) => t.name).filter(Boolean);
        if (toolNames.length) lines.push(toolNames.join(', '));
      }
      sections.push(lines.join(': '));
    });
  }

  // Projects
  if (parsedData.projects?.length) {
    sections.push('PROJECTS:');
    parsedData.projects.forEach((project: any) => {
      const lines = [];
      if (project.title) lines.push(project.title);
      if (project.description) lines.push(project.description);
      if (project.technologies?.length) {
        lines.push(`Technologies: ${project.technologies.join(', ')}`);
      }
      sections.push(lines.join('\n'));
    });
  }

  // Certifications
  if (parsedData.certifications?.length) {
    sections.push('CERTIFICATIONS:');
    parsedData.certifications.forEach((cert: any) => {
      if (cert.title) {
        const line = cert.issuer ? `${cert.title} - ${cert.issuer}` : cert.title;
        sections.push(line);
      }
    });
  }

  // Languages
  if (parsedData.languages?.length) {
    sections.push('LANGUAGES:');
    const langs = parsedData.languages
      .map((lang: any) => lang.name && lang.proficiency ? `${lang.name} (${lang.proficiency})` : lang.name)
      .filter(Boolean);
    sections.push(langs.join(', '));
  }

  // Awards
  if (parsedData.awards?.length) {
    sections.push('AWARDS:');
    parsedData.awards.forEach((award: any) => {
      const lines = [];
      if (award.title) lines.push(award.title);
      if (award.description) lines.push(award.description);
      sections.push(lines.join('\n'));
    });
  }

  return sections.join('\n\n');
}

/**
 * Extracts skills array from resume (combining parsedData skills and top-level skills)
 */
export function extractSkills(user: any): string[] {
  const skills = new Set<string>();

  // From top-level skills array
  if (user.skills?.length) {
    user.skills.forEach((skill: string) => skills.add(skill));
  }

  // From resume.extractedSkills
  if (user.resume?.extractedSkills?.length) {
    user.resume.extractedSkills.forEach((skill: any) => {
      if (skill.name) skills.add(skill.name);
    });
  }

  // From resume.parsedData.skills
  if (user.resume?.parsedData?.skills?.length) {
    user.resume.parsedData.skills.forEach((skill: any) => {
      if (skill.field) skills.add(skill.field);
      if (skill.tools?.length) {
        skill.tools.forEach((tool: any) => {
          if (tool.name) skills.add(tool.name);
        });
      }
    });
  }

  return Array.from(skills);
}
