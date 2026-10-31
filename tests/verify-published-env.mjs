export function publishedVerificationEnv(parent, port) {
  return { ...parent, VERIFY_PUBLISHED_CHILD: '1', VERIFY_PORT_BASE: String(port), VERIFY_GATE: parent.VERIFY_GATE || 'final', RESUME_TEST_EMPTY: '0', RESUME_TEST_FIXTURES: '0' };
}
