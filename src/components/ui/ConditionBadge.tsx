import type { ProductCondition, DeviceGrade } from '../../types'
import { CONDITION_LABELS, DEVICE_GRADE_LABELS } from '../../config/labels'
import { Badge } from './Badge'

interface ConditionBadgeProps {
  condition: ProductCondition
  grade?: DeviceGrade
  showNew?: boolean
}

export function ConditionBadge({ condition, grade, showNew = false }: ConditionBadgeProps) {
  if (condition === 'used') {
    const gradeLabel = grade ? ` · ${DEVICE_GRADE_LABELS[grade]}` : ''
    return (
      <Badge tone="info">
        {CONDITION_LABELS.used}{gradeLabel}
      </Badge>
    )
  }
  if (showNew) {
    return <Badge tone="neutral">{CONDITION_LABELS.new}</Badge>
  }
  return null
}