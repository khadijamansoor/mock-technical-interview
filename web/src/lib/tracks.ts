export type RoundType = {
  id: string;
  name: string;
};

export type Track = {
  id: string;
  name: string;
  description: string;
  category: "Technical" | "Non-engineering" | "Cross-cutting" | "General Engineering (Legacy)";
  roundTypes?: RoundType[];
};

export const tracks: Track[] = [
  // Legacy / Transitional Tracks
  // These are broad role categories from the original data model. 
  // They are retained here as transitional options until the new taxonomy tracks are fully seeded.
  {
    id: "fullstack",
    name: "Full Stack Engineering",
    description: "End-to-end application development, from UI to database.",
    category: "General Engineering (Legacy)",
  },
  {
    id: "frontend",
    name: "Frontend Engineering",
    description: "UI architecture, performance, and modern web frameworks.",
    category: "General Engineering (Legacy)",
  },
  {
    id: "backend",
    name: "Backend Engineering",
    description: "API design, scalability, and server-side logic.",
    category: "General Engineering (Legacy)",
  },

  // Technical Tracks
  {
    id: "coding_dsa",
    name: "Coding / DSA",
    description: "Data structures, algorithms, and complex problem solving.",
    category: "Technical",
  },
  {
    id: "system_design",
    name: "System Design (HLD)",
    description: "High-level architecture, scalability, and distributed systems.",
    category: "Technical",
  },
  {
    id: "lld",
    name: "Low-level Design / OOD",
    description: "Object-oriented design patterns and clean code principles.",
    category: "Technical",
  },
  {
    id: "sql",
    name: "SQL & Database Design",
    description: "Complex queries, schema design, and indexing.",
    category: "Technical",
  },
  {
    id: "ml",
    name: "ML / Data Science",
    description: "Machine learning engineering and statistics.",
    category: "Technical",
    roundTypes: [
      { id: "ml_coding", name: "ML Coding" },
      { id: "ml_system_design", name: "ML System Design" },
      { id: "stats", name: "Stats & Probability" }
    ]
  },
  {
    id: "devops",
    name: "DevOps / SRE",
    description: "Infrastructure, deployment pipelines, and reliability.",
    category: "Technical",
    roundTypes: [
      { id: "incident_response", name: "Incident Response" },
      { id: "infra_design", name: "Infra Design" }
    ]
  },
  {
    id: "data_engineering",
    name: "Data Engineering",
    description: "Data pipelines, ETL design, and data warehousing.",
    category: "Technical",
  },
  {
    id: "security",
    name: "Security / AppSec",
    description: "Application security, vulnerability assessment, and mitigation.",
    category: "Technical",
  },
  {
    id: "qa",
    name: "QA / Testing Strategy",
    description: "Test automation frameworks and quality assurance processes.",
    category: "Technical",
  },

  // Non-engineering, technical-adjacent
  {
    id: "pm",
    name: "Product Management",
    description: "Product strategy, execution, and metric analysis.",
    category: "Non-engineering",
    roundTypes: [
      { id: "product_sense", name: "Product Sense" },
      { id: "execution", name: "Execution / Metrics" },
      { id: "case_strategy", name: "Case Strategy" }
    ]
  },
  {
    id: "em",
    name: "Engineering Management",
    description: "Leadership, org design, and team dynamics.",
    category: "Non-engineering",
    roundTypes: [
      { id: "org_design", name: "Org Design" },
      { id: "conflict_resolution", name: "Conflict Resolution" }
    ]
  },
  {
    id: "data_analyst",
    name: "Data Analyst",
    description: "SQL and business case analysis.",
    category: "Non-engineering",
  },
  {
    id: "ux",
    name: "UX / Design",
    description: "Portfolio walkthrough and design critique.",
    category: "Non-engineering",
  },

  // Cross-cutting
  {
    id: "behavioral",
    name: "Behavioral / STAR",
    description: "Past experiences, teamwork, and cultural fit.",
    category: "Cross-cutting",
  },
  {
    id: "case_interview",
    name: "Case Interview",
    description: "Consulting-style structured problem solving.",
    category: "Cross-cutting",
  },
  {
    id: "salary_negotiation",
    name: "Salary Negotiation",
    description: "Offer evaluation, negotiation tactics, and communication.",
    category: "Cross-cutting",
  }
];
