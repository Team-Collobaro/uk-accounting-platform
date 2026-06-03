"use client"

import { useState, useRef, useEffect } from "react"

export function useModuleData(moduleId: string) {
  const [moduleTitle, setModuleTitle] = useState(moduleId.toUpperCase())
  const [partNumber, setPartNumber] = useState(1)
  const [partTitle, setPartTitle] = useState("")
  const [nextModule, setNextModule] = useState<string | null>(null)
  const [moduleAlreadyCompleted, setModuleAlreadyCompleted] = useState(false)

  const mTitleRef = useRef(moduleId.toUpperCase())
  const pNumRef = useRef(1)
  const pTitleRef = useRef("")

  useEffect(() => {
    mTitleRef.current = moduleTitle
  }, [moduleTitle])
  useEffect(() => {
    pNumRef.current = partNumber
  }, [partNumber])
  useEffect(() => {
    pTitleRef.current = partTitle
  }, [partTitle])

  useEffect(() => {
    const n = parseInt(moduleId.replace("m", ""), 10)
    if (n < 87) setNextModule(`m${String(n + 1).padStart(2, "0")}`)
    Promise.all([
      fetch(`/api/module-meta?moduleId=${moduleId}`).then(
        (r) =>
          r.json() as Promise<{
            module_title: string
            part_number: number
            part_title: string
          } | null>,
      ),
      fetch("/api/progress").then(
        (r) => r.json() as Promise<{ completedModules: string[] }>,
      ),
    ])
      .then(([m, pg]) => {
        if (m) {
          setModuleTitle(m.module_title ?? moduleId.toUpperCase())
          setPartNumber(m.part_number ?? 1)
          setPartTitle(m.part_title ?? "")
        }
        if (pg?.completedModules?.includes(moduleId)) setModuleAlreadyCompleted(true)
      })
      .catch(() => {})
  }, [moduleId])

  return {
    moduleTitle,
    setModuleTitle,
    partNumber,
    setPartNumber,
    partTitle,
    setPartTitle,
    nextModule,
    moduleAlreadyCompleted,
    setModuleAlreadyCompleted,
    mTitleRef,
    pNumRef,
    pTitleRef,
  }
}
