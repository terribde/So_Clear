import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  API_ERROR_CODES,
  ME_PATHS,
  type OwnReviewDTO,
} from '@soclear/contracts';
import { ReviewEditModal } from './ReviewEditModal';
import { ApiRequestError } from '../features/api/client';

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  toast: vi.fn(),
  refresh: vi.fn(),
  onClose: vi.fn(),
  onUpdated: vi.fn(),
}));

vi.mock('../features/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../features/api/client')>();
  return { ...actual, apiRequest: mocks.request };
});

vi.mock('../components/Toast', () => ({
  useToast: () => mocks.toast,
}));

vi.mock('../features/auth/AuthProvider', () => ({
  useAuth: () => ({
    session: { authenticated: true, csrfToken: 'csrf-test' },
    refresh: mocks.refresh,
  }),
}));

const meta = { generatedAt: '2026-10-18T00:00:00.000Z', synthetic: true };

const baseReview: OwnReviewDTO = {
  id: 'rv-test',
  status: 'pending',
  teacher: { id: 't-linwangshu', name: '林望舒' },
  course: { id: 'c-stat', name: '概率论与数理统计' },
  term: { id: 't-2026-1', label: '2026–2027 第一学期', isCurrent: true },
  revision: 2,
  version: 3,
  scores: { clarity: 4, organization: 3, feedback: 4, assessmentTransparency: 5 },
  descriptive: { difficulty: 3, workload: 2, attendance: '偶尔点名' },
  comment: '初稿说明',
  submittedAt: '2026-10-01T00:00:00.000Z',
  publishedAt: null,
  updatedAt: '2026-10-01T00:00:00.000Z',
  moderationReason: null,
  actions: { canEdit: true, canWithdraw: true },
};

function makeReview(overrides: Partial<OwnReviewDTO>): OwnReviewDTO {
  return { ...baseReview, ...overrides };
}

function renderModal(review: OwnReviewDTO) {
  return render(
    <ReviewEditModal
      open
      onClose={mocks.onClose}
      review={review}
      onUpdated={mocks.onUpdated}
    />,
  );
}

beforeEach(() => {
  mocks.request.mockReset();
  mocks.toast.mockReset();
  mocks.refresh.mockReset();
  mocks.onClose.mockReset();
  mocks.onUpdated.mockReset();
});

describe('ReviewEditModal revision states', () => {
  it('explains pending, rejected, published and hidden revisions without skipping review', () => {
    const { rerender } = renderModal(makeReview({ status: 'pending' }));

    expect(screen.getByText('EDIT / 待审评价')).toBeTruthy();
    expect(screen.getByRole('button', { name: '保存修订' })).toBeTruthy();
    expect(screen.getByText(/修改会生成新的待审修订/)).toBeTruthy();

    rerender(
      <ReviewEditModal
        open
        onClose={mocks.onClose}
        review={makeReview({ status: 'rejected', moderationReason: 'insufficient_detail' })}
        onUpdated={mocks.onUpdated}
      />,
    );
    expect(screen.getByText('REVISE / 驳回评价')).toBeTruthy();
    expect(screen.getByRole('button', { name: '重新送审' })).toBeTruthy();
    expect(screen.getByText(/保存后会生成新的待审修订并重新进入审核队列/)).toBeTruthy();

    rerender(
      <ReviewEditModal
        open
        onClose={mocks.onClose}
        review={makeReview({
          status: 'published',
          publishedAt: '2026-10-02T00:00:00.000Z',
        })}
        onUpdated={mocks.onUpdated}
      />,
    );
    expect(screen.getByText('REVISE / 已公开评价')).toBeTruthy();
    expect(screen.getByRole('button', { name: '重新送审' })).toBeTruthy();
    expect(screen.getByText(/当前公开版本会立即下架/)).toBeTruthy();

    rerender(
      <ReviewEditModal
        open
        onClose={mocks.onClose}
        review={makeReview({ status: 'hidden', moderationReason: 'other' })}
        onUpdated={mocks.onUpdated}
      />,
    );
    expect(screen.getByText('REVISE / 已隐藏评价')).toBeTruthy();
    expect(screen.getByRole('button', { name: '重新送审' })).toBeTruthy();
    expect(screen.getAllByText(/审核通过前内容仍不会公开/).length).toBeGreaterThan(0);
  });
});

describe('ReviewEditModal submission', () => {
  it('submits a new pending revision with expected version and shows success', async () => {
    mocks.request.mockResolvedValue({
      data: makeReview({ revision: 3, version: 4, comment: '修订后的说明' }),
      meta,
    });
    renderModal(makeReview({ status: 'pending' }));

    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[4]!);
    const comment = screen.getByLabelText(/文字说明/);
    fireEvent.change(comment, { target: { value: '修订后的说明' } });
    fireEvent.click(screen.getByRole('button', { name: '保存修订' }));

    await waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(1));
    expect(mocks.request).toHaveBeenCalledWith(
      ME_PATHS.reviewUpdate('rv-test'),
      expect.objectContaining({
        method: 'PATCH',
        credentials: 'include',
        csrfToken: 'csrf-test',
        body: {
          expectedVersion: 3,
          scores: {
            clarity: 5,
            organization: 3,
            feedback: 4,
            assessmentTransparency: 5,
          },
          difficulty: 3,
          workload: 2,
          attendance: '偶尔点名',
          comment: '修订后的说明',
        },
      }),
    );

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.stringContaining('待审评价已更新为修订 v3'),
        'success',
      );
      expect(mocks.onUpdated).toHaveBeenCalled();
      expect(mocks.onClose).toHaveBeenCalled();
    });
  });

  it('shows a controlled error when the review is no longer editable', async () => {
    mocks.request.mockRejectedValue(
      new ApiRequestError(409, API_ERROR_CODES.reviewNotEditable, '该评价已锁定。'),
    );
    renderModal(makeReview({ status: 'pending' }));

    fireEvent.click(screen.getByRole('button', { name: '保存修订' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('当前状态不允许修订');
    expect(mocks.onUpdated).toHaveBeenCalled();
    expect(mocks.onClose).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();
  });
});
