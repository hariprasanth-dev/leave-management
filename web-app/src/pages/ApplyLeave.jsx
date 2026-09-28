import { Navigate } from 'react-router-dom'

/** Applying lives inside My Leaves; keep /apply working for old links and bookmarks. */
export function ApplyLeave() {
  return <Navigate to="/leaves?apply=1" replace />
}
