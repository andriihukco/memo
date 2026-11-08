import { redirect } from 'next/navigation';

/** The graph moved into Trends. Old links and bot buttons land on its segment. */
export default function GraphPage() {
  redirect('/miniapp/insights?view=graph');
}
