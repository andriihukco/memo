'use client';

import { PageHeader } from '@/components/shell/page-header';
import { GoalsContent } from '@/components/features/goals/goals-content';

/** The Goals route: header with back, then the content. */
export default function GoalsPage() {
  return (
    <>
      <PageHeader title="Goals" back />
      <GoalsContent />
    </>
  );
}
