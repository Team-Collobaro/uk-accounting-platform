import { supabaseAdmin } from './supabase-server'
import type { CourseChunk } from '@/types'

export async function getModuleIntro(moduleId: string, limit = 5): Promise<CourseChunk[]> {
  const { data, error } = await supabaseAdmin
    .from('course_chunks')
    .select('id, module_id, module_title, part_number, content, token_count')
    .eq('module_id', moduleId)
    .order('part_number')
    .limit(limit)
  if (error) throw error
  return (data ?? []).map(mapChunk)
}

export async function searchSimilar(
  query: string,
  moduleId: string | null,
  topK: number = 3
): Promise<CourseChunk[]> {
  const search = async (filterModule: string | null) => {
    let q = supabaseAdmin
      .from('course_chunks')
      .select('id, module_id, module_title, part_number, content, token_count')
      .textSearch('content', query, { type: 'websearch', config: 'english' })
      .limit(topK)

    if (filterModule) q = q.eq('module_id', filterModule)

    const { data, error } = await q
    if (error) throw error
    return (data ?? []).map(mapChunk)
  }

  const results = await search(moduleId)

  if (moduleId && results.length < 2) {
    return search(null)
  }

  return results
}

function mapChunk(c: Record<string, unknown>): CourseChunk {
  return {
    id: c.id as string,
    moduleId: c.module_id as string,
    moduleTitle: c.module_title as string,
    partNumber: c.part_number as number,
    sectionId: (c.section_id as string) ?? '',
    sectionTitle: (c.section_title as string) ?? '',
    sectionOrder: (c.section_order as number) ?? 0,
    content: c.content as string,
    tokenCount: c.token_count as number,
  }
}
