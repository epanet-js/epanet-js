import * as Sentry from '@sentry/nextjs'

export const captureError = (error: Error) => {
  Sentry.captureException(error)
}

export const captureWarning = (message: string) => {
  Sentry.captureMessage(message, 'warning')
}
