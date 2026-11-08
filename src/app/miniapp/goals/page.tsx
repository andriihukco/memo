import { redirect } from 'next/navigation';

/** Goals live in Trends. Old links land on its segment. */
export default function GoalsPage() {
  redirect('/miniapp/insights?view=goals');
}
