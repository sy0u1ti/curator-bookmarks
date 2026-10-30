export type ActionStatus = 'idle' | 'pending' | 'success' | 'error'

export interface ActionFeedback {
  readonly status: ActionStatus
  readonly updatedAt: number
}

export const IDLE_ACTION_FEEDBACK: ActionFeedback = { status: 'idle', updatedAt: 0 }
export const ACTION_FEEDBACK_DURATION_MS = 2400

export function actionFeedback(status: ActionStatus): ActionFeedback {
  return { status, updatedAt: Date.now() }
}

export function getActionFeedbackStatus(feedback: ActionFeedback, now = Date.now()): ActionStatus {
  if ((feedback.status === 'success' || feedback.status === 'error') &&
      now - feedback.updatedAt >= ACTION_FEEDBACK_DURATION_MS) {
    return 'idle'
  }
  return feedback.status
}
