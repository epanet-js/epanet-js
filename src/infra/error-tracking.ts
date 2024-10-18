import * as Sentry from '@sentry/nextjs'

export const captureError = (error: Error) => {
  Sentry.captureException(error)
}

export const captureWarning = (message: string) => {
  Sentry.captureMessage(message, 'warning')
}

export const addToErrorLog = (breadcrumbs: Sentry.Breadcrumb) => {
    Sentry.addBreadcrumb(breadcrumbs)
}

export const ErrorBoundary = Sentry.ErrorBoundary
