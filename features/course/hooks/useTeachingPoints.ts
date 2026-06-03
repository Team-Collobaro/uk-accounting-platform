"use client"

import { useState, useRef, useEffect } from "react"
import type { Section, SectionProgress, TeachingPoint, TPhase } from "@/types/course"

interface UseTeachingPointsParams {
  moduleId: string
  currentSection: Section | null
  sectionProgress: SectionProgress[]
}

export function useTeachingPoints({
  moduleId,
  currentSection,
  sectionProgress,
}: UseTeachingPointsParams) {
  const [teachingPoints, setTeachingPoints] = useState<TeachingPoint[]>([])
  const [currentPtIdx, setCurrentPtIdx] = useState(0)
  const [tPhase, setTPhase] = useState<TPhase>("PRE_NOTES")

  const tpRef = useRef<TeachingPoint[]>([])
  const tpIdxRef = useRef(0)
  const tPhaseRef = useRef<TPhase>("PRE_NOTES")

  useEffect(() => {
    tpRef.current = teachingPoints
  }, [teachingPoints])
  useEffect(() => {
    tpIdxRef.current = currentPtIdx
  }, [currentPtIdx])
  useEffect(() => {
    tPhaseRef.current = tPhase
  }, [tPhase])

  useEffect(() => {
    if (!currentSection) return
    const sv = sectionProgress.find((p) => p.section_id === currentSection.section_id)
    if (sv?.teaching_points?.length) {
      void fetch(
        `/api/teaching-points?moduleId=${moduleId}&sectionId=${currentSection.section_id}`,
      )
        .then(
          (r) => r.json() as Promise<{ points: string[]; pointContents: string[] }>,
        )
        .then((d) => {
          const merged = (sv.teaching_points ?? []).map((p, i) => ({
            title: p.title,
            content: d.pointContents?.[i] ?? "",
            done: p.done,
          }))
          setTeachingPoints(merged)
          setCurrentPtIdx(sv.teaching_point_idx ?? 0)
          setTPhase((sv.t_phase as TPhase) ?? "PRE_NOTES")
        })
        .catch(() => {})
      return
    }
    void fetch(
      `/api/teaching-points?moduleId=${moduleId}&sectionId=${currentSection.section_id}`,
    )
      .then(
        (r) => r.json() as Promise<{ points: string[]; pointContents: string[] }>,
      )
      .then((d) => {
        if (d.points?.length) {
          setTeachingPoints(
            d.points.map((t, i) => ({
              title: t,
              content: d.pointContents?.[i] ?? "",
              done: false,
            })),
          )
          setCurrentPtIdx(0)
          setTPhase("PRE_NOTES")
        }
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSection?.section_id, moduleId, sectionProgress])

  return {
    teachingPoints,
    setTeachingPoints,
    currentPtIdx,
    setCurrentPtIdx,
    tPhase,
    setTPhase,
    tpRef,
    tpIdxRef,
    tPhaseRef,
  }
}
