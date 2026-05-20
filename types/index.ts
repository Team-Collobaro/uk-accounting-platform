export interface Student {
  id: string
  name: string
  email: string
  enrolledCourses: string[]
  completedModules: string[]
  weakTopics: string[]
  avgQuizScore: number
  totalTokensUsed: number
  createdAt: Date
}

export interface Module {
  id: string
  title: string
  partNumber: number
  partTitle: string
  content: string
  order: number
  totalChunks?: number
}

export interface CourseChunk {
  id: string
  moduleId: string
  moduleTitle: string
  partNumber: number
  sectionId: string      // e.g. "1.1", "1.2", "1.2.1"
  sectionTitle: string   // e.g. "Why compliance is the centre of gravity"
  sectionOrder: number   // sort order within module
  content: string
  tokenCount: number
  embedding?: number[]
}

export interface CourseSection {
  sectionId: string
  sectionTitle: string
  sectionOrder: number
  moduleId: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  tokenCount?: number
}

export interface TutorSession {
  id: string
  studentId: string
  moduleId: string
  messages: ChatMessage[]
  totalTokens: number
  totalCostUsd: number
  createdAt: string
  updatedAt: string
}

export interface QuizQuestion {
  id: string
  question: string
  options: string[]
  correct: string
  explanation: string
  topic: string
}

export interface QuizResult {
  id: string
  moduleId: string
  studentId: string
  score: number
  total: number
  percentage: number
  passed: boolean
  weakAreas: string[]
  completedAt: string
}

export interface Certificate {
  id: string
  studentId: string
  studentName: string
  courseTitle: string
  completionDate: string
  verificationCode: string
  verificationUrl: string
  finalScore: number
  isValid: boolean
}

export interface ModuleProgress {
  moduleId: string
  studentId: string
  status: 'not_started' | 'in_progress' | 'completed'
  quizScore?: number
  completedAt?: string
}

export interface Employer {
  id: string
  companyName: string
  email: string
  plan: 'starter' | 'growth' | 'enterprise'
  seats: number
  usedSeats: number
  stripeCustomerId?: string
  teamMembers: TeamMember[]
  createdAt: string
}

export interface TeamMember {
  id: string
  name: string
  email: string
  enrolledAt: string
  completedModules: number
  avgScore: number
  certificateEarned: boolean
}

export interface ProgressAnalysis {
  recommendation: 'proceed' | 'review' | 'exam'
  reason: string
  suggestedModule?: string
  weakTopics: string[]
  overallProgress: number
}

export interface CostReport {
  studentId: string
  totalInputTokens: number
  totalOutputTokens: number
  totalCostUsd: number
  sessionCount: number
  avgCostPerSession: number
}
