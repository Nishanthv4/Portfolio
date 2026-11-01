import portfolioData from '../portfolio.json' with { type: 'json' };

/**
 * Builds a concise, high-density facts context string from portfolio.json.
 * Streamlined to fit comfortably in SmolLM2-360M's context window
 * and prevent hallucination.
 */
export function buildPortfolioContext() {
  const p = portfolioData.profile;
  const s = portfolioData.technicalSkills;
  
  const projectsList = portfolioData.projects.map(pr => {
    return `- ${pr.name} (${pr.category}): ${pr.brief} Tech: ${pr.technologies.join(', ')}. Status: ${pr.status}. Repo: ${pr.github || p.contact.github}`;
  }).join('\n');

  return `
VERIFIED FACTS:
- Name: ${p.name} | Education: ${p.education.degree} (${p.education.academicYear}) at ${p.education.institution}, ${p.education.location}.
- Career Interest: ${p.careerInterest} | Objective: ${p.careerObjective}
- Languages: ${s.programmingLanguages.join(', ')}
- Web: ${s.webDevelopment.join(', ')}
- Tools: ${s.developerTools.join(', ')}
- Cloud & DevOps: ${s.cloudAndDevOps.join(', ')}
- Demonstrated: ${s.proficiencyStages.confidentlyDemonstrating.join(', ')}
- Learning: ${s.proficiencyStages.learningAndExploring.join(', ')}
- Active Projects:
${projectsList}
- Contact: Email: ${p.contact.email} | GitHub: ${p.contact.github} | LinkedIn: ${p.contact.linkedin}
`.trim();
}

/**
 * Constructs the concise system prompt instructing SmolLM2 to act as Nishanth's portfolio assistant.
 * Concise instructions reduce time-to-first-token and prevent rambling.
 */
export function getSystemPrompt() {
  const context = buildPortfolioContext();
  return `You are Nishanth's personal portfolio assistant.
Answer visitor questions concisely (1-3 sentences) in clear, simple language using only the verified facts below.
Never invent experience, achievements, certifications, dates or skills.
If information is not in the portfolio, say that it is not available.

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
