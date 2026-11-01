import portfolioData from '../portfolio.json';

/**
 * Builds a compact, high-density facts context string from portfolio.json.
 * This ensures the 0.5B model stays well within its context window
 * and never hallucinates facts.
 */
export function buildPortfolioContext() {
  const p = portfolioData.profile;
  const s = portfolioData.technicalSkills;
  
  const projectsList = portfolioData.projects.map(pr => {
    return `- ${pr.name} (${pr.category}): ${pr.brief} Problem solved: ${pr.problemSolved} Technologies: ${pr.technologies.join(', ')}. Status: ${pr.status}. Contribution: ${pr.contribution || 'Core design and implementation'}.`;
  }).join('\n');

  return `
VERIFIED PORTFOLIO FACTS FOR NISHANTH V:
- Name: ${p.name}
- Headline: ${p.headline}
- Current Education: ${p.education.degree} (${p.education.academicYear}) at ${p.education.institution}, ${p.education.location}.
- Career Objective: ${p.careerObjective}
- Career Interests: ${p.careerInterest}
- Programming Languages: ${s.programmingLanguages.join(', ')}
- Web Technologies: ${s.webDevelopment.join(', ')}
- Developer Tools: ${s.developerTools.join(', ')}
- Cloud & DevOps: ${s.cloudAndDevOps.join(', ')}
- Proficiency Classification:
  * Confidently Demonstrating: ${s.proficiencyStages.confidentlyDemonstrating.join(', ')}
  * Practiced in Projects: ${s.proficiencyStages.practicedThroughProjects.join(', ')}
  * Actively Learning: ${s.proficiencyStages.learningAndExploring.join(', ')}
- Projects:
${projectsList}
- Soft Skills: ${portfolioData.softSkills.join(', ')}
- Certifications & Achievements: ${portfolioData.certificationsAndAchievements.status}
- Experience: ${portfolioData.experience.academicExperience} ${portfolioData.experience.internshipStatus}
- Extracurriculars: ${portfolioData.experience.extracurricular}
- Contact Details:
  * Email: ${p.contact.email}
  * LinkedIn: ${p.contact.linkedin}
  * GitHub: ${p.contact.github}
  * X (Twitter): ${p.contact.twitter}
  * Location: ${p.location}
`.trim();
}

/**
 * Constructs the system prompt instructing the model to act as Nishanth's portfolio assistant.
 */
export function getSystemPrompt() {
  const context = buildPortfolioContext();
  return `You are Nishanth's portfolio assistant. Answer visitor questions using only the supplied portfolio information. Be friendly, concise and professional. Explain projects and technologies in simple language. Never invent personal information, achievements, skills, dates or experience. If the answer is not available in the portfolio context, say that the information is not currently available and suggest contacting Nishanth.

${context}`;
}

/**
 * Suggested questions displayed in the chat interface.
 */
export const suggestedQuestions = [
  "What projects has Nishanth built?",
  "What are his core technical skills?",
  "Tell me about StudyMate",
  "What is his interest in Cloud Engineering?",
  "How can I contact Nishanth?"
];

