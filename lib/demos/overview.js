// What the console shows for demos: each demo with its links and call counts.
import { listShareLinks } from '@/lib/loan/shareLinks';
import { listCalls } from '@/lib/loan/calls';
import { listDemos, getDemo } from './store';
import { operatorView } from './model';
import { demoLinkView } from './links';

function view(demo, links, calls) {
  const mine = calls.filter((c) => c.demoId === demo.id);
  return {
    ...operatorView(demo),
    links: links.filter((l) => l.demoId === demo.id).map(demoLinkView),
    callCount: mine.length,
    lastCallAt: mine.reduce((latest, c) => (c.startedAt && c.startedAt > latest ? c.startedAt : latest), '') || null,
  };
}

export async function demoViews() {
  const [demos, links, calls] = await Promise.all([listDemos(), listShareLinks(), listCalls()]);
  return demos.map((d) => view(d, links, calls));
}

export async function demoViewById(id) {
  const demo = await getDemo(id);
  if (!demo) return null;
  const [links, calls] = await Promise.all([listShareLinks(), listCalls()]);
  return view(demo, links, calls);
}
