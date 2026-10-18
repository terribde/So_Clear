import { Route, Routes } from 'react-router-dom';
import { SiteLayout } from './SiteLayout';
import { ScrollToTop } from './ScrollToTop';
import { HomePage } from '../pages/HomePage';
import { TeachersPage } from '../pages/TeachersPage';
import { TeacherDetailPage } from '../pages/TeacherDetailPage';
import { CoursesPage } from '../pages/CoursesPage';
import { GuidePage } from '../pages/GuidePage';
import { AccountPage } from '../pages/AccountPage';
import { AssistantPage } from '../pages/AssistantPage';
import { AdminPage } from '../pages/AdminPage';
import { NotFoundPage } from '../pages/NotFoundPage';

export function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<SiteLayout />}>
          <Route index element={<HomePage />} />
          <Route path="/teachers" element={<TeachersPage />} />
          <Route path="/teachers/:teacherId" element={<TeacherDetailPage />} />
          <Route path="/courses" element={<CoursesPage />} />
          <Route path="/guide" element={<GuidePage />} />
          <Route path="/me" element={<AccountPage />} />
          <Route path="/assistant" element={<AssistantPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/*" element={<AdminPage />} />
      </Routes>
    </>
  );
}
