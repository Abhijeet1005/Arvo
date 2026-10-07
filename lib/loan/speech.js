// Expressive voice models (v4, v3) can carry delivery cues in the agent's text,
// such as [softly] or [sighs]. They steer the voice; they are not for people to
// read, so they are removed before text reaches a screen.
//
// Pure module: used by the browser call hook.
export function stripAudioTags(text) {
  return String(text ?? '')
    .replace(/\s*\[[^[\]\n]{1,40}\]\s*/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}
