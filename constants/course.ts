export const PART_TITLES: Record<number, string> = {
  0: 'Front Matter',
  1: 'Foundations',
  2: 'Cloud Software Platforms',
  3: 'VAT',
  4: 'Payroll PAYE & CIS',
  5: 'Year-End Accounts',
  6: 'Corporation Tax',
  7: 'Self Assessment',
  8: 'Incorporation',
  9: 'Cessation',
  10: 'Structure Changes',
  11: 'Specialist Tax',
  12: 'Practice & Ethics',
  13: 'Appendices',
}

export function getPartNumber(moduleOrder: number): number {
  if (moduleOrder <= 7)  return 1
  if (moduleOrder <= 12) return 2
  if (moduleOrder <= 20) return 3
  if (moduleOrder <= 26) return 4
  if (moduleOrder <= 34) return 5
  if (moduleOrder <= 40) return 6
  if (moduleOrder <= 48) return 7
  if (moduleOrder <= 57) return 8
  if (moduleOrder <= 66) return 9
  if (moduleOrder <= 74) return 10
  if (moduleOrder <= 82) return 11
  return 12
}
