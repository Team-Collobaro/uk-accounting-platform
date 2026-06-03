export interface ProgressData {
  completedModules: string[]
  overallPercentage: number
  avgQuizScore: number
  nextRecommendedModule: string
  certificates: Array<{
    id: string
    verification_code: string
    final_score: number
    completion_date: string
  }>
}
