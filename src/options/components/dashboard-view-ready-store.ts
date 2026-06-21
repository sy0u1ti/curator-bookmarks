type DashboardViewReadyListener = () => void

const dashboardViewReadyListeners = new Set<DashboardViewReadyListener>()

export function notifyDashboardViewReady(): void {
  dashboardViewReadyListeners.forEach((listener) => listener())
}

export function subscribeToDashboardViewReady(listener: DashboardViewReadyListener): () => void {
  dashboardViewReadyListeners.add(listener)
  return () => {
    dashboardViewReadyListeners.delete(listener)
  }
}
