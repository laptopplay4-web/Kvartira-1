import { Navigate } from 'react-router';
import { isYclientsLessonsEnabled } from '@/config/features';
import { AvailabilityYcPage } from '@/pages/lessons/AvailabilityYcPage';

/**
 * Teacher work schedule.
 * With VITE_LESSONS_SOURCE=yclients → YCLIENTS SoT UI.
 * Without YC → no schedule screen (redirect to lessons).
 */
export default function AvailabilityPage() {
  if (!isYclientsLessonsEnabled()) {
    return <Navigate to="/lessons" replace />;
  }
  return <AvailabilityYcPage />;
}
