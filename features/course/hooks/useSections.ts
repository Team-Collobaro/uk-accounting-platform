"use client"

import { useState, useRef, useEffect } from "react"
import type { Section, SectionProgress } from "@/types/course"

export function useSections(moduleId: string) {
  const [sections, setSections] = useState<Section[]>([])
  const [sectionsLoaded, setSectionsLoaded] = useState(false)
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0)
  const [sectionProgress, setSectionProgress] = useState<SectionProgress[]>([])
  const [sessionKP, setSessionKP] = useState<string[]>([])

  const secRef = useRef<Section | null>(null)
  const doneSecsRef = useRef<string[]>([])
  const didAutoResume = useRef(false)

  const currentSection = sections[currentSectionIdx] ?? null

  useEffect(() => {
    secRef.current = currentSection
  }, [currentSection])

  useEffect(() => {
    doneSecsRef.current = sectionProgress
      .filter((p) => p.status === "completed")
      .map((p) => p.section_id)
  }, [sectionProgress])

  useEffect(() => {
    fetch(`/api/sections?moduleId=${moduleId}`)
      .then((r) => r.json() as Promise<{ sections: Section[] }>)
      .then((d) => {
        if (d.sections?.length) setSections(d.sections)
        setSectionsLoaded(true)
      })
      .catch(() => setSectionsLoaded(true))
  }, [moduleId])

  useEffect(() => {
    fetch(`/api/notes?moduleId=${moduleId}`)
      .then((r) => r.json() as Promise<{ progress: SectionProgress[] }>)
      .then((d) => {
        if (d.progress) setSectionProgress(d.progress)
      })
      .catch(() => {})
  }, [moduleId])

  // Auto-resume: restore the exact section the user was on when they left,
  // falling back to last in-progress or first incomplete if no saved position
  useEffect(() => {
    if (didAutoResume.current) return
    if (!sectionsLoaded || sections.length === 0) return

    // Priority 1: restore exact section from localStorage
    try {
      const saved = localStorage.getItem(`last_section_${moduleId}`)
      if (saved) {
        const { sectionId } = JSON.parse(saved) as { sectionId: string }
        const savedIdx = sections.findIndex((s) => s.section_id === sectionId)
        if (savedIdx >= 0) {
          didAutoResume.current = true
          setCurrentSectionIdx(savedIdx)
          return
        }
      }
    } catch { /* ignore */ }

    // Priority 2: last in-progress or first incomplete (needs progress data)
    if (sectionProgress.length === 0) return
    didAutoResume.current = true

    const inProgressIdx = sections.reduce<number>((found, s, i) => {
      const p = sectionProgress.find((p) => p.section_id === s.section_id)
      return p && p.status !== "completed" ? i : found
    }, -1)
    if (inProgressIdx > 0) {
      setCurrentSectionIdx(inProgressIdx)
      return
    }
    const firstIncompleteIdx = sections.findIndex(
      (s) =>
        sectionProgress.find((p) => p.section_id === s.section_id)?.status !== "completed",
    )
    if (firstIncompleteIdx > 0) setCurrentSectionIdx(firstIncompleteIdx)
  }, [sectionsLoaded, sections, sectionProgress, moduleId])

  // Sync sessionKP into sectionProgress
  useEffect(() => {
    if (sessionKP.length && currentSection) {
      setSectionProgress((prev) => {
        const ex = prev.find((p) => p.section_id === currentSection.section_id)
        if (ex)
          return prev.map((p) =>
            p.section_id === currentSection.section_id
              ? { ...p, key_points: sessionKP }
              : p,
          )
        return [
          ...prev,
          {
            section_id: currentSection.section_id,
            section_title: currentSection.section_title,
            status: "in_progress",
            notes: "",
            key_points: sessionKP,
          },
        ]
      })
    }
  }, [sessionKP, currentSection])

  return {
    sections,
    setSections,
    sectionsLoaded,
    currentSectionIdx,
    setCurrentSectionIdx,
    sectionProgress,
    setSectionProgress,
    sessionKP,
    setSessionKP,
    currentSection,
    secRef,
    doneSecsRef,
  }
}
