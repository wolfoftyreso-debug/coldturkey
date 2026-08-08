import { StyleSheet } from 'react-native';

/**
 * The same visual system as the web client, expressed as React Native styles.
 *
 * Kept as one shared stylesheet rather than per-screen styles so the two clients
 * cannot drift apart — a warm accent on the web and a different one on the phone
 * would read as two products.
 */
export const colors = {
  bg: '#0b0d0f',
  surface: '#14181b',
  surfaceRaised: '#1b2126',
  border: '#262f36',
  borderStrong: '#38434c',
  text: '#eceff1',
  textDim: '#a4aeb6',
  textFaint: '#6d7880',
  accent: '#e8794a',
  accentSoft: 'rgba(232,121,74,0.16)',
  amber: '#f2b950',
  teal: '#4fa88b',
  danger: '#e5484d',
  dangerSoft: 'rgba(229,72,77,0.16)',
} as const;

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 20,
    paddingBottom: 60,
    gap: 12,
  },
  wordmark: {
    color: colors.textFaint,
    fontSize: 12,
    letterSpacing: 2.4,
    fontWeight: '700',
    marginBottom: 18,
  },
  h1: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.6,
    marginBottom: 4,
  },
  h2: {
    color: colors.textFaint,
    fontSize: 12,
    letterSpacing: 1.8,
    fontWeight: '700',
    marginTop: 22,
    marginBottom: 8,
  },
  h3: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  body: {
    color: colors.textDim,
    fontSize: 15,
    lineHeight: 22,
  },
  lede: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 25,
  },
  muted: {
    color: colors.textFaint,
    fontSize: 13,
    lineHeight: 19,
  },
  // The day counter — the number people open the app to look at.
  dayCount: {
    color: colors.text,
    fontSize: 62,
    fontWeight: '800',
    letterSpacing: -2.4,
    lineHeight: 66,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  cardAccent: {
    borderColor: 'rgba(232,121,74,0.4)',
    backgroundColor: colors.surface,
  },
  cardWarning: {
    borderColor: 'rgba(229,72,77,0.45)',
    backgroundColor: colors.surface,
  },
  // Big, text-only, unmissable. An icon is one more thing to decode when you
  // are barely holding on.
  action: {
    minHeight: 74,
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
  },
  actionPrimary: {
    minHeight: 92,
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  actionDanger: {
    borderColor: 'rgba(229,72,77,0.5)',
  },
  actionText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  actionTextPrimary: {
    color: '#17100c',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  actionTextDanger: {
    color: '#ffb9bb',
  },
  button: {
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  buttonPrimary: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  buttonText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 15,
  },
  buttonTextPrimary: {
    color: '#17100c',
  },
  chip: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  chipText: {
    color: colors.textDim,
    fontSize: 15,
  },
  chipTextSelected: {
    color: colors.text,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.bg,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
  },
  label: {
    color: colors.textFaint,
    fontSize: 12,
    letterSpacing: 1,
    fontWeight: '700',
    marginBottom: 6,
  },
  mantra: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 26,
    borderLeftWidth: 2,
    borderLeftColor: colors.accent,
    paddingLeft: 14,
    marginVertical: 16,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  stat: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
  },
  statValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    color: colors.textFaint,
    fontSize: 11,
    letterSpacing: 1,
    fontWeight: '700',
    marginTop: 2,
  },
  bubble: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 13,
    maxWidth: '88%',
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: colors.surfaceRaised,
  },
  bubbleAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
  },
  bubbleEmergency: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  step: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stepNumber: {
    color: colors.textFaint,
    fontSize: 12,
    fontWeight: '700',
    width: 22,
    textAlign: 'center',
  },
  errorBanner: {
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: 'rgba(229,72,77,0.4)',
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    color: '#ffb9bb',
    fontSize: 14,
  },
});
