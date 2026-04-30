import { LocalFriendBottleHero } from '@/components/LocalFriendBottleHero';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type AlumaIntroCardProps = {
  showVideo?: boolean;
  kicker?: string;
  eyebrow?: string;
  headline: string;
  /** Real signal line under headline (message in a bottle), no sender. */
  quotedMessage?: string;
  subline: string;
  ctaLabel: string;
  onCta: () => void;
  busy?: boolean;
  hideCta?: boolean;
};

/**
 * ALUMA hotel card — bottle step + gift step only (sender only in app notifications).
 */
export function AlumaIntroCard({
  showVideo,
  kicker,
  eyebrow,
  headline,
  quotedMessage,
  subline,
  ctaLabel,
  onCta,
  busy,
  hideCta,
}: AlumaIntroCardProps) {
  return (
    <View style={styles.card} accessibilityRole="summary">
      {showVideo ? (
        <View style={styles.videoWrap}>
          <LocalFriendBottleHero height={260} />
        </View>
      ) : null}
      <View style={styles.copy}>
        {kicker ? (
          <Text style={styles.kicker} accessibilityRole="text">
            {kicker}
          </Text>
        ) : null}
        {eyebrow ? (
          <Text style={styles.eyebrow} accessibilityRole="text">
            {eyebrow}
          </Text>
        ) : null}
        <Text style={styles.headline} accessibilityRole="header">
          {headline}
        </Text>
        {quotedMessage ? (
          <Text style={styles.quoted} accessibilityRole="text">
            “{quotedMessage}”
          </Text>
        ) : null}
        {subline ? <Text style={styles.subline}>{subline}</Text> : null}
      </View>
      {hideCta ? null : (
        <Pressable
          onPress={onCta}
          disabled={busy}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed, busy && styles.ctaDisabled]}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
        >
          <Text style={styles.ctaText}>{busy ? 'Opening…' : ctaLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 22,
    paddingVertical: 22,
    paddingHorizontal: 22,
    backgroundColor: 'rgba(18, 16, 14, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(216, 185, 138, 0.35)',
  },
  videoWrap: {
    width: '100%',
    marginBottom: 16,
    borderRadius: 18,
    overflow: 'hidden',
  },
  copy: {
    marginBottom: 20,
  },
  kicker: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(248, 244, 238, 0.82)',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.4,
    color: '#D8B98A',
    textAlign: 'center',
    marginBottom: 8,
  },
  headline: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    color: '#F8F4EE',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  quoted: {
    fontSize: 17,
    lineHeight: 26,
    fontWeight: '600',
    fontStyle: 'italic',
    color: 'rgba(248, 244, 238, 0.92)',
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  subline: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    color: 'rgba(248, 244, 238, 0.78)',
    textAlign: 'center',
  },
  cta: {
    alignSelf: 'stretch',
    paddingVertical: 17,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: '#C7A26A',
    borderWidth: 1,
    borderColor: 'rgba(255, 248, 236, 0.35)',
    alignItems: 'center',
  },
  ctaPressed: {
    opacity: 0.92,
  },
  ctaDisabled: {
    opacity: 0.55,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111111',
    letterSpacing: 0.3,
  },
});
