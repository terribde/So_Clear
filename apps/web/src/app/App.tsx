import { Suspense, lazy, type ComponentType } from 'react';
import { Route, Routes } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';
import { SiteLayout } from './SiteLayout';
import { ScrollToTop } from './ScrollToTop';
import { HomePage } from '../pages/HomePage';

const TeachersPage = lazy(async () => ({ default: (await import('../pages/TeachersPage')).TeachersPage }));
const TeacherDetailPage = lazy(async () => ({
  default: (await import('../pages/TeacherDetailPage')).TeacherDetailPage,
}));
const ComparePage = lazy(async () => ({ default: (await import('../pages/ComparePage')).ComparePage }));
const CoursesPage = lazy(async () => ({ default: (await import('../pages/CoursesPage')).CoursesPage }));
const SectionDetailPage = lazy(async () => ({
  default: (await import('../pages/SectionDetailPage')).SectionDetailPage,
}));
const GuidePage = lazy(async () => ({ default: (await import('../pages/GuidePage')).GuidePage }));
const AccountPage = lazy(async () => ({ default: (await import('../pages/AccountPage')).AccountPage }));
const AssistantPage = lazy(async () => ({
  default: (await import('../pages/AssistantPage')).AssistantPage,
}));
const AdminPage = lazy(async () => ({ default: (await import('../pages/AdminPage')).AdminPage }));
const NotFoundPage = lazy(async () => ({ default: (await import('../pages/NotFoundPage')).NotFoundPage }));

function PageFallback() {
  return (
    <div className="flex min-h-[55vh] items-center justify-center" role="status" aria-live="polite">
      <LoaderCircle className="size-5 animate-spin text-jade-600" />
      <span className="sr-only">页面加载中</span>
    </div>
  );
}

function LazyPage({ page: Page }: { page: ComponentType }) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Page />
    </Suspense>
  );
}

export function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<SiteLayout />}>
          <Route index element={<HomePage />} />
          <Route path="/teachers" element={<LazyPage page={TeachersPage} />} />
          <Route path="/teachers/:teacherId" element={<LazyPage page={TeacherDetailPage} />} />
          <Route path="/compare" element={<LazyPage page={ComparePage} />} />
          <Route path="/courses" element={<LazyPage page={CoursesPage} />} />
          <Route path="/sections/:sectionId" element={<LazyPage page={SectionDetailPage} />} />
          <Route path="/guide" element={<LazyPage page={GuidePage} />} />
          <Route path="/me" element={<LazyPage page={AccountPage} />} />
          <Route path="/assistant" element={<LazyPage page={AssistantPage} />} />
          <Route path="*" element={<LazyPage page={NotFoundPage} />} />
        </Route>
        <Route path="/admin" element={<LazyPage page={AdminPage} />} />
        <Route path="/admin/*" element={<LazyPage page={AdminPage} />} />
      </Routes>
    </>
  );
}
