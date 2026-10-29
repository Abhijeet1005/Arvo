// Runs once when the server starts: starts the autopilot's clock, so it keeps
// working after a restart without anyone opening the dashboard. (Its mode
// still decides whether a tick does anything.)
//
// The check must wrap the import directly: Next compiles this file for the
// edge runtime too, and only drops the import there when it sits inside this
// exact condition.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startAutopilot } = await import('./lib/autopilot/scheduler');
    startAutopilot();
  }
}
