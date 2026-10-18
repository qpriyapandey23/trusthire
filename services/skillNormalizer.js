/**
 * Skill Normalizer and Taxonomy Service — TrustHire
 *
 * Implements Stage 2 & 3 of the Candidate Verification Pipeline:
 * 1. Token Splitting (e.g., "React/Redux" -> "React.js", "Redux Toolkit")
 * 2. Canonical Normalization (aliases, casing, version suffixes)
 * 3. Categorization into 8 standardized technical domains:
 *    - Frontend, Backend, AI/ML, Database, DevOps & Cloud,
 *      Programming Languages, Core & Systems, Tools & Methodologies
 * 4. Deduplication
 * 5. Empirical Cross-Referencing against Projects & Proof Artifacts
 *    (assigns empirical confidence scores and explainable AI rationales)
 */

const SKILL_TAXONOMY = {
  // --- FRONTEND ---
  react: { canonical: 'React.js', category: 'Frontend' },
  'react.js': { canonical: 'React.js', category: 'Frontend' },
  reactjs: { canonical: 'React.js', category: 'Frontend' },
  next: { canonical: 'Next.js', category: 'Frontend' },
  'next.js': { canonical: 'Next.js', category: 'Frontend' },
  nextjs: { canonical: 'Next.js', category: 'Frontend' },
  vue: { canonical: 'Vue.js', category: 'Frontend' },
  'vue.js': { canonical: 'Vue.js', category: 'Frontend' },
  vuejs: { canonical: 'Vue.js', category: 'Frontend' },
  angular: { canonical: 'Angular', category: 'Frontend' },
  angularjs: { canonical: 'Angular', category: 'Frontend' },
  svelte: { canonical: 'Svelte', category: 'Frontend' },
  sveltekit: { canonical: 'Svelte', category: 'Frontend' },
  html: { canonical: 'HTML5', category: 'Frontend' },
  html5: { canonical: 'HTML5', category: 'Frontend' },
  css: { canonical: 'CSS3', category: 'Frontend' },
  css3: { canonical: 'CSS3', category: 'Frontend' },
  tailwind: { canonical: 'Tailwind CSS', category: 'Frontend' },
  tailwindcss: { canonical: 'Tailwind CSS', category: 'Frontend' },
  'tailwind css': { canonical: 'Tailwind CSS', category: 'Frontend' },
  bootstrap: { canonical: 'Bootstrap', category: 'Frontend' },
  sass: { canonical: 'Sass', category: 'Frontend' },
  scss: { canonical: 'Sass', category: 'Frontend' },
  redux: { canonical: 'Redux Toolkit', category: 'Frontend' },
  'redux toolkit': { canonical: 'Redux Toolkit', category: 'Frontend' },
  rtk: { canonical: 'Redux Toolkit', category: 'Frontend' },
  zustand: { canonical: 'Zustand', category: 'Frontend' },
  mobx: { canonical: 'MobX', category: 'Frontend' },
  'framer motion': { canonical: 'Framer Motion', category: 'Frontend' },
  vite: { canonical: 'Vite', category: 'Frontend' },
  webpack: { canonical: 'Webpack', category: 'Frontend' },

  // --- BACKEND ---
  node: { canonical: 'Node.js', category: 'Backend' },
  'node.js': { canonical: 'Node.js', category: 'Backend' },
  nodejs: { canonical: 'Node.js', category: 'Backend' },
  express: { canonical: 'Express.js', category: 'Backend' },
  'express.js': { canonical: 'Express.js', category: 'Backend' },
  expressjs: { canonical: 'Express.js', category: 'Backend' },
  nest: { canonical: 'NestJS', category: 'Backend' },
  'nest.js': { canonical: 'NestJS', category: 'Backend' },
  nestjs: { canonical: 'NestJS', category: 'Backend' },
  fastapi: { canonical: 'FastAPI', category: 'Backend' },
  'fast-api': { canonical: 'FastAPI', category: 'Backend' },
  flask: { canonical: 'Flask', category: 'Backend' },
  django: { canonical: 'Django', category: 'Backend' },
  spring: { canonical: 'Spring Boot', category: 'Backend' },
  'spring boot': { canonical: 'Spring Boot', category: 'Backend' },
  springboot: { canonical: 'Spring Boot', category: 'Backend' },
  'asp.net': { canonical: 'ASP.NET Core', category: 'Backend' },
  dotnet: { canonical: 'ASP.NET Core', category: 'Backend' },
  '.net': { canonical: 'ASP.NET Core', category: 'Backend' },
  graphql: { canonical: 'GraphQL', category: 'Backend' },
  apollo: { canonical: 'GraphQL', category: 'Backend' },
  'rest api': { canonical: 'REST APIs', category: 'Backend' },
  rest: { canonical: 'REST APIs', category: 'Backend' },
  restful: { canonical: 'REST APIs', category: 'Backend' },
  'restful apis': { canonical: 'REST APIs', category: 'Backend' },
  grpc: { canonical: 'gRPC', category: 'Backend' },
  websocket: { canonical: 'WebSockets', category: 'Backend' },
  websockets: { canonical: 'WebSockets', category: 'Backend' },
  'socket.io': { canonical: 'WebSockets', category: 'Backend' },
  microservices: { canonical: 'Microservices', category: 'Backend' },
  rabbitmq: { canonical: 'RabbitMQ', category: 'Backend' },
  kafka: { canonical: 'Apache Kafka', category: 'Backend' },

  // --- PROGRAMMING LANGUAGES ---
  javascript: { canonical: 'JavaScript', category: 'Programming Languages' },
  js: { canonical: 'JavaScript', category: 'Programming Languages' },
  es6: { canonical: 'JavaScript', category: 'Programming Languages' },
  typescript: { canonical: 'TypeScript', category: 'Programming Languages' },
  ts: { canonical: 'TypeScript', category: 'Programming Languages' },
  python: { canonical: 'Python', category: 'Programming Languages' },
  py: { canonical: 'Python', category: 'Programming Languages' },
  python3: { canonical: 'Python', category: 'Programming Languages' },
  java: { canonical: 'Java', category: 'Programming Languages' },
  jdk: { canonical: 'Java', category: 'Programming Languages' },
  c: { canonical: 'C', category: 'Core & Systems' },
  'c++': { canonical: 'C++', category: 'Core & Systems' },
  cpp: { canonical: 'C++', category: 'Core & Systems' },
  'c plus plus': { canonical: 'C++', category: 'Core & Systems' },
  'c#': { canonical: 'C#', category: 'Programming Languages' },
  csharp: { canonical: 'C#', category: 'Programming Languages' },
  go: { canonical: 'Go', category: 'Programming Languages' },
  golang: { canonical: 'Go', category: 'Programming Languages' },
  rust: { canonical: 'Rust', category: 'Core & Systems' },
  rustlang: { canonical: 'Rust', category: 'Core & Systems' },
  kotlin: { canonical: 'Kotlin', category: 'Programming Languages' },
  swift: { canonical: 'Swift', category: 'Programming Languages' },
  php: { canonical: 'PHP', category: 'Programming Languages' },
  ruby: { canonical: 'Ruby on Rails', category: 'Backend' },
  'ruby on rails': { canonical: 'Ruby on Rails', category: 'Backend' },
  r: { canonical: 'R', category: 'AI/ML' },
  sql: { canonical: 'SQL', category: 'Database' },

  // --- DATABASE ---
  mongodb: { canonical: 'MongoDB', category: 'Database' },
  mongo: { canonical: 'MongoDB', category: 'Database' },
  postgresql: { canonical: 'PostgreSQL', category: 'Database' },
  postgres: { canonical: 'PostgreSQL', category: 'Database' },
  psql: { canonical: 'PostgreSQL', category: 'Database' },
  mysql: { canonical: 'MySQL', category: 'Database' },
  redis: { canonical: 'Redis', category: 'Database' },
  sqlite: { canonical: 'SQLite', category: 'Database' },
  sqlite3: { canonical: 'SQLite', category: 'Database' },
  cassandra: { canonical: 'Cassandra', category: 'Database' },
  dynamodb: { canonical: 'DynamoDB', category: 'Database' },
  firebase: { canonical: 'Firebase', category: 'Database' },
  firestore: { canonical: 'Firebase', category: 'Database' },
  supabase: { canonical: 'Supabase', category: 'Database' },
  neo4j: { canonical: 'Neo4j', category: 'Database' },
  prisma: { canonical: 'Prisma ORM', category: 'Database' },
  mongoose: { canonical: 'Mongoose ODM', category: 'Database' },
  elasticsearch: { canonical: 'Elasticsearch', category: 'Database' },

  // --- DEVOPS & CLOUD ---
  docker: { canonical: 'Docker', category: 'DevOps & Cloud' },
  containerization: { canonical: 'Docker', category: 'DevOps & Cloud' },
  kubernetes: { canonical: 'Kubernetes', category: 'DevOps & Cloud' },
  k8s: { canonical: 'Kubernetes', category: 'DevOps & Cloud' },
  aws: { canonical: 'AWS', category: 'DevOps & Cloud' },
  'amazon web services': { canonical: 'AWS', category: 'DevOps & Cloud' },
  gcp: { canonical: 'GCP', category: 'DevOps & Cloud' },
  'google cloud': { canonical: 'GCP', category: 'DevOps & Cloud' },
  'google cloud platform': { canonical: 'GCP', category: 'DevOps & Cloud' },
  azure: { canonical: 'Azure', category: 'DevOps & Cloud' },
  'microsoft azure': { canonical: 'Azure', category: 'DevOps & Cloud' },
  terraform: { canonical: 'Terraform', category: 'DevOps & Cloud' },
  ansible: { canonical: 'Ansible', category: 'DevOps & Cloud' },
  'ci/cd': { canonical: 'CI/CD (GitHub Actions)', category: 'DevOps & Cloud' },
  cicd: { canonical: 'CI/CD (GitHub Actions)', category: 'DevOps & Cloud' },
  'github actions': { canonical: 'CI/CD (GitHub Actions)', category: 'DevOps & Cloud' },
  jenkins: { canonical: 'Jenkins', category: 'DevOps & Cloud' },
  nginx: { canonical: 'Nginx', category: 'DevOps & Cloud' },
  linux: { canonical: 'Linux & Shell', category: 'Core & Systems' },
  bash: { canonical: 'Linux & Shell', category: 'Core & Systems' },
  shell: { canonical: 'Linux & Shell', category: 'Core & Systems' },

  // --- AI / ML / DATA SCIENCE ---
  pytorch: { canonical: 'PyTorch', category: 'AI/ML' },
  torch: { canonical: 'PyTorch', category: 'AI/ML' },
  tensorflow: { canonical: 'TensorFlow', category: 'AI/ML' },
  tf: { canonical: 'TensorFlow', category: 'AI/ML' },
  keras: { canonical: 'Keras', category: 'AI/ML' },
  'scikit-learn': { canonical: 'Scikit-Learn', category: 'AI/ML' },
  sklearn: { canonical: 'Scikit-Learn', category: 'AI/ML' },
  pandas: { canonical: 'Pandas', category: 'AI/ML' },
  numpy: { canonical: 'NumPy', category: 'AI/ML' },
  scipy: { canonical: 'SciPy', category: 'AI/ML' },
  opencv: { canonical: 'Computer Vision (OpenCV)', category: 'AI/ML' },
  'computer vision': { canonical: 'Computer Vision (OpenCV)', category: 'AI/ML' },
  nlp: { canonical: 'NLP / spaCy', category: 'AI/ML' },
  'natural language processing': { canonical: 'NLP / spaCy', category: 'AI/ML' },
  spacy: { canonical: 'NLP / spaCy', category: 'AI/ML' },
  nltk: { canonical: 'NLTK', category: 'AI/ML' },
  huggingface: { canonical: 'HuggingFace Transformers', category: 'AI/ML' },
  transformers: { canonical: 'HuggingFace Transformers', category: 'AI/ML' },
  llm: { canonical: 'LLM & Generative AI', category: 'AI/ML' },
  'generative ai': { canonical: 'LLM & Generative AI', category: 'AI/ML' },
  genai: { canonical: 'LLM & Generative AI', category: 'AI/ML' },
  gemini: { canonical: 'Google Gemini API', category: 'AI/ML' },
  'google gemini': { canonical: 'Google Gemini API', category: 'AI/ML' },
  langchain: { canonical: 'LangChain', category: 'AI/ML' },
  rag: { canonical: 'RAG Architecture', category: 'AI/ML' },
  xgboost: { canonical: 'XGBoost', category: 'AI/ML' },
  matplotlib: { canonical: 'Data Visualization (Matplotlib)', category: 'AI/ML' },
  seaborn: { canonical: 'Data Visualization (Seaborn)', category: 'AI/ML' },

  // --- TOOLS & METHODOLOGIES ---
  git: { canonical: 'Git', category: 'Tools & Methodologies' },
  github: { canonical: 'GitHub', category: 'Tools & Methodologies' },
  gitlab: { canonical: 'GitLab', category: 'Tools & Methodologies' },
  postman: { canonical: 'Postman', category: 'Tools & Methodologies' },
  jest: { canonical: 'Jest', category: 'Tools & Methodologies' },
  cypress: { canonical: 'Cypress', category: 'Tools & Methodologies' },
  playwright: { canonical: 'Playwright', category: 'Tools & Methodologies' },
  figma: { canonical: 'Figma', category: 'Tools & Methodologies' },
  agile: { canonical: 'Agile / Scrum', category: 'Tools & Methodologies' },
  scrum: { canonical: 'Agile / Scrum', category: 'Tools & Methodologies' },
  jira: { canonical: 'Jira', category: 'Tools & Methodologies' },
};

/**
 * Splits raw skill strings containing slashes, ampersands, or commas.
 * (e.g. "React/Redux" -> ["React", "Redux"])
 */
function splitCompoundTokens(rawString) {
  if (!rawString || typeof rawString !== 'string') return [];

  // Special-case tokens that legitimately contain slashes/pluses
  // 'C/C++' -> ['C', 'C++']
  // 'CI/CD' -> ['CI/CD']
  // 'C++' -> ['C++']
  let text = rawString.trim();

  // If text is CI/CD, keep intact
  if (/^ci\/cd$/i.test(text)) return ['CI/CD'];

  // Split on delimiters (commas, semicolons, pipe, and slash if not C/C++ or CI/CD)
  // Protect C/C++
  text = text.replace(/c\/c\+\+/gi, 'C, C++');

  const tokens = text
    .split(/[,;|•\n]+|\s+&\s+|\s+and\s+/i)
    .flatMap((t) => {
      const trimmed = t.trim();
      // Split on slash if neither CI/CD nor C/C++
      if (trimmed.includes('/') && !/^ci\/cd$/i.test(trimmed)) {
        return trimmed.split('/').map((sub) => sub.trim());
      }
      return trimmed;
    })
    .map((t) => t.trim().replace(/^[-•*▪]\s*/, ''))
    .filter((t) => t.length > 0 && !/^(skills?|technologies|tools|languages?)$/i.test(t));

  return tokens;
}

/**
 * Normalizes a single skill token to canonical form and category.
 */
function normalizeSingleSkill(skillToken) {
  if (!skillToken) return null;

  const clean = skillToken
    .trim()
    .replace(/[()]/g, '')
    .replace(/\s+/g, ' ');

  const lookupKey = clean.toLowerCase();

  // Direct lookup
  if (SKILL_TAXONOMY[lookupKey]) {
    return {
      name: SKILL_TAXONOMY[lookupKey].canonical,
      category: SKILL_TAXONOMY[lookupKey].category,
    };
  }

  // Prefix/Suffix pattern matching
  // Remove version numbers (e.g. Python 3.10 -> Python)
  const noVersion = lookupKey.replace(/\s*v?[0-9]+(\.[0-9]+)*$/, '').trim();
  if (SKILL_TAXONOMY[noVersion]) {
    return {
      name: SKILL_TAXONOMY[noVersion].canonical,
      category: SKILL_TAXONOMY[noVersion].category,
    };
  }

  // Heuristic Category Fallbacks
  let category = 'General';
  if (/react|vue|angular|front|css|html|tailwind|ui|ux/i.test(lookupKey)) {
    category = 'Frontend';
  } else if (/node|express|api|back|spring|django|flask|server/i.test(lookupKey)) {
    category = 'Backend';
  } else if (/ai|ml|learning|model|data|nlp|vision|tensor|torch/i.test(lookupKey)) {
    category = 'AI/ML';
  } else if (/sql|db|data|mongo|postgres|redis|storage/i.test(lookupKey)) {
    category = 'Database';
  } else if (/cloud|aws|docker|kube|devops|deploy|ci|cd/i.test(lookupKey)) {
    category = 'DevOps & Cloud';
  } else if (/lang|java|python|c\+\+|rust|golang|script/i.test(lookupKey)) {
    category = 'Programming Languages';
  }

  // Capitalize neatly
  const formattedName = clean
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  return {
    name: formattedName,
    category,
  };
}

/**
 * Stage 3: Cross-references extracted skills against candidate projects
 * to assign empirical confidence scores and explainable AI rationales.
 *
 * @param {Array<string|Object>} rawSkills - Array of extracted skills
 * @param {Array<Object>} projects - Extracted candidate projects
 * @returns {Array<Object>} Itemized badges with verifiedStatus, rationale, and confidenceScore
 */
function normalizeAndCategorizeSkills(rawSkills = [], projects = []) {
  // 1. Tokenize, split, and normalize
  const tokens = [];
  (Array.isArray(rawSkills) ? rawSkills : []).forEach((item) => {
    if (typeof item === 'string') {
      const split = splitCompoundTokens(item);
      tokens.push(...split);
    } else if (typeof item === 'object' && item !== null) {
      if (item.name) {
        const split = splitCompoundTokens(item.name);
        tokens.push(...split);
      }
    }
  });

  // 2. Canonical lookup and deduplication
  const canonicalMap = new Map();

  for (const token of tokens) {
    const normalized = normalizeSingleSkill(token);
    if (!normalized || !normalized.name) continue;

    const lowerName = normalized.name.toLowerCase();
    if (!canonicalMap.has(lowerName)) {
      canonicalMap.set(lowerName, {
        name: normalized.name,
        category: normalized.category,
      });
    }
  }

  // 3. Empirical cross-referencing against projects
  const result = [];

  canonicalMap.forEach((skill) => {
    const skillLower = skill.name.toLowerCase();

    // Check if skill appears in project tech stacks or descriptions
    let matchingProject = null;
    let hasGitHub = false;
    let hasLiveDemo = false;

    // Safe boundary regex matching to avoid single-letter collisions (e.g. 'c' or 'r')
    const escaped = skillLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const boundaryRegex = new RegExp(`(?:^|[^a-zA-Z0-9+#])${escaped}(?:$|[^a-zA-Z0-9+#])`, 'i');

    for (const proj of projects || []) {
      const techStackStr = Array.isArray(proj.techStack)
        ? proj.techStack.join(' ')
        : String(proj.techStack || '');
      const descStr = String(proj.description || '');
      const titleStr = String(proj.title || '');

      const isMentioned =
        boundaryRegex.test(techStackStr) ||
        boundaryRegex.test(descStr) ||
        boundaryRegex.test(titleStr);

      if (isMentioned) {
        matchingProject = proj;
        hasGitHub = Boolean(proj.githubUrl && proj.githubUrl.includes('github.com'));
        hasLiveDemo = Boolean(proj.liveDemoUrl && proj.liveDemoUrl.startsWith('http'));
        break;
      }
    }

    // Determine status, rationale, and confidence score
    let verifiedStatus = 'Pending';
    let rationale = '';
    let confidenceScore = 35;

    if (matchingProject) {
      if (hasGitHub && hasLiveDemo) {
        confidenceScore = 85;
        rationale = `Corroborated by project "${matchingProject.title}" with connected GitHub repository and live deployment proof.`;
      } else if (hasGitHub) {
        confidenceScore = 75;
        rationale = `Corroborated by project "${matchingProject.title}" with GitHub code artifact. Awaiting commit velocity audit.`;
      } else if (hasLiveDemo) {
        confidenceScore = 65;
        rationale = `Associated with live deployed application for project "${matchingProject.title}". Awaiting repository audit.`;
      } else {
        confidenceScore = 55;
        rationale = `Claimed in technical project "${matchingProject.title}". Digital proof repository link is currently unlinked.`;
      }
    } else {
      confidenceScore = 40;
      rationale =
        'Self-declared in resume skills section; awaiting GitHub code inspection and commit language breakdown.';
    }

    result.push({
      name: skill.name,
      category: skill.category,
      verifiedStatus,
      rationale,
      confidenceScore,
    });
  });

  // Sort by category, then by confidence score descending
  return result.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return b.confidenceScore - a.confidenceScore;
  });
}

module.exports = {
  SKILL_TAXONOMY,
  splitCompoundTokens,
  normalizeSingleSkill,
  normalizeAndCategorizeSkills,
};
