import { Navigate, useParams } from 'react-router-dom'

/** The add/edit form lives in a side sheet; old /employees/new and /employees/:id/edit URLs open it. */
export function EmployeeForm() {
  const { id } = useParams()
  return <Navigate to={id ? `/employees/${id}?edit=1` : '/employees?sheet=new'} replace />
}
