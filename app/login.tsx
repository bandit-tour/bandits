import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  InteractionManager,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function Login() {
  
  /** Session restore finished (success or failure). Avoid infinite spinner when user is null. */
  const [sessionReady, setSessionReady] = useState(false);
  const [authInitError, setAuthInitError] = useState<string | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignIn, setIsSignIn] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [googleButtonScale] = useState(new Animated.Value(1));
  const router = useRouter();

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      try {
        WebBrowser.maybeCompleteAuthSession();
      } catch (e) {
        console.warn('[Login] maybeCompleteAuthSession failed', e);
      }
    });
    return () => task.cancel();
  }, []);

  const withTimeout = async <T,>(promise: Promise<T>, label: string, ms = 20000): Promise<T> => {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(`${label} timed out after ${ms}ms`));
      }, ms);
    });
    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  };

  /** Strict validation — never start loading until these pass. */
  const validateSignInFields = (emailRaw: string, passwordRaw: string): { ok: true } | { ok: false; reason: string; message: string } => {
    const e = emailRaw.trim();
    const p = passwordRaw.trim();
    if (!e) return { ok: false, reason: 'empty email', message: 'Please enter your email.' };
    if (!p) return { ok: false, reason: 'empty password', message: 'Please enter your password.' };
    return { ok: true };
  };

  const validateSignUpFields = (emailRaw: string, passwordRaw: string): { ok: true } | { ok: false; reason: string; message: string } => {
    const e = emailRaw.trim();
    const p = passwordRaw.trim();
    if (!e) return { ok: false, reason: 'empty email', message: 'Please enter your email.' };
    if (!p) return { ok: false, reason: 'empty password', message: 'Please enter your password.' };
    if (p.length < 6) return { ok: false, reason: 'password too short', message: 'Password must be at least 6 characters.' };
    return { ok: true };
  };

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setAuthInitError(
        'App configuration error: Supabase URL or anon key is missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env and restart the dev server.',
      );
      setUser(null);
      setSessionReady(true);
      return;
    }

    let cancelled = false;

    const restoreSession = async () => {
      try {
        const { data: { session }, error: sessionError } = await withTimeout(
          supabase.auth.getSession(),
          'Session restore (getSession)',
          15000,
        );
        if (cancelled) return;
        if (sessionError) {
          console.error('[Login] getSession error:', sessionError);
          setAuthInitError(sessionError.message);
          setUser(null);
        } else if (session?.user) {
          setUser(session.user);
        } else {
          setUser(null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[Login] getSession threw:', err);
          setAuthInitError(err instanceof Error ? err.message : 'Could not restore session');
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setSessionReady(true);
        }
      }
    };

    void restoreSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user) {
      router.replace('/(tabs)/bandits');
    }
  }, [user, router]);

  const handleEmailLogin = async () => {
    setLoading(false);

    const v = validateSignInFields(email, password);
    if (!v.ok) {
      setError(v.message);
      return;
    }

    if (!isSupabaseConfigured()) {
      setError('Supabase is not configured.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const { data, error: signInError } = await withTimeout(
        supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        }),
        'Email sign in',
      );

      if (signInError) {
        setError(signInError.message);
        return;
      }

      if (!data?.session) {
        setError('Sign in failed: no session returned.');
      }
    } catch (err: any) {
      setError(err?.message ?? 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignup = async () => {
    setLoading(false);

    const v = validateSignUpFields(email, password);
    if (!v.ok) {
      setError(v.message);
      return;
    }

    if (!isSupabaseConfigured()) {
      setError('Supabase is not configured. Check EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const trimmedPassword = password.trim();
      const { error, data } = await withTimeout(
        supabase.auth.signUp({
          email: email.trim(),
          password: trimmedPassword,
          options: {
            emailRedirectTo: Platform.OS === 'web'
              ? `${window.location.origin}/auth/callback`
              : 'bandits://auth/callback',
          },
        }),
        'Email sign up',
      );

      if (error) {
        setError(error.message);
      } else if (data.user && !data.session) {
        setEmailSent(true);
        setError(null);
      } else if (data.user && data.session) {
        setError('Account created but email verification is required. Please check your email.');
        void supabase.auth.signOut();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    setLoading(false);

    if (!email.trim()) {
      setError('Please enter your email.');
      return;
    }

    if (!isSupabaseConfigured()) {
      setError('Supabase is not configured.');
      return;
    }

    setLoading(true);
    setResendSuccess(false);
    try {
      const { error: resendError } = await withTimeout(
        supabase.auth.resend({
          type: 'signup',
          email: email.trim(),
          options: {
            emailRedirectTo: Platform.OS === 'web'
              ? `${window.location.origin}/auth/callback`
              : 'bandits://auth/callback',
          },
        }),
        'Resend email',
      );
      if (resendError) {
        setError(resendError.message);
      } else {
        setError(null);
        setResendSuccess(true);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Failed to resend email.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleButtonPressIn = () => {
    Animated.spring(googleButtonScale, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handleGoogleButtonPressOut = () => {
    Animated.spring(googleButtonScale, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const handleGoogleSignIn = async () => {
    setLoading(false);
    if (!isSupabaseConfigured()) {
      setError('Supabase is not configured.');
      return;
    }
    try {
      setError(null);
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'bandits://auth/callback',
          skipBrowserRedirect: false,
        },
      });

      if (data?.session || data?.url) {
        setError(null);
      } else if (error) {
        setError(error.message);
        return;
      }

      if (data?.session) {
        return;
      }

      if (Platform.OS !== 'web' && data?.url) {
        if (typeof WebBrowser.openAuthSessionAsync !== 'function') {
          throw new Error('openAuthSessionAsync is unavailable on this runtime.');
        }

        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          'bandits://auth/callback',
        );

        if (result.type === 'success') {
          const url = result.url;

          const parsed = Linking.parse(url);
          const query = (parsed.queryParams ?? {}) as Record<string, any>;
          const accessToken = typeof query.access_token === 'string' ? query.access_token : null;
          const refreshToken = typeof query.refresh_token === 'string' ? query.refresh_token : null;
          const hashParams = new URLSearchParams((url.split('#')[1] ?? '').trim());
          const hashAccessToken = hashParams.get('access_token');
          const hashRefreshToken = hashParams.get('refresh_token');
          const finalAccessToken = accessToken ?? hashAccessToken;
          const finalRefreshToken = refreshToken ?? hashRefreshToken;

          if (finalAccessToken && finalRefreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: finalAccessToken,
              refresh_token: finalRefreshToken,
            });

            if (sessionError) {
              throw sessionError;
            }
          } else {
            throw new Error('OAuth callback did not include tokens.');
          }
        } else if (result.type === 'cancel') {
          /* user dismissed browser */
        } else {
          throw new Error(`OAuth failed with result type: ${result.type}`);
        }
      }
    } catch (err: any) {
      const { data: sessionProbe } = await supabase.auth.getSession();
      if (sessionProbe?.session) {
        setError(null);
        return;
      }
      if (err?.message) {
        setError(`Google Sign-In failed: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!sessionReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff0000" />
        <Text style={styles.loadingHint}>Checking session…</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image
            source={require('@/assets/icons/logobanditourapp.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {emailSent ? (
          // Email confirmation screen
          <View style={styles.formContainer}>
            <Text style={styles.confirmationTitle}>Check your email</Text>
            <Text style={styles.confirmationText}>
              We've sent a confirmation link to {email}
            </Text>
            <Text style={styles.confirmationSubtext}>
              Click the link in your email to complete your registration
            </Text>
            
            {/* Resend Email Button */}
            <TouchableOpacity 
              style={styles.resendButton}
              onPress={handleResendEmail}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#ff0000" />
              ) : (
                <Text style={styles.resendButtonText}>Resend email</Text>
              )}
            </TouchableOpacity>

            {/* Error Message */}
            {error && <Text style={styles.errorText}>{error}</Text>}
            
            {/* Success Message */}
            {resendSuccess && <Text style={styles.successText}>Email sent successfully!</Text>}

            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => {
                setEmailSent(false);
                setEmail('');
                setPassword('');
                setError(null);
                setResendSuccess(false);
              }}
            >
              <Text style={styles.backButtonText}>Back to sign up</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {authInitError ? (
              <View style={styles.configErrorBanner}>
                <Text style={styles.configErrorTitle}>Connection issue</Text>
                <Text style={styles.configErrorText}>{authInitError}</Text>
              </View>
            ) : null}
            {/* Tab Switcher */}
            <View style={styles.tabContainer}>
              <TouchableOpacity 
                style={[styles.tab, isSignIn && styles.activeTab]}
                onPress={() => setIsSignIn(true)}
              >
                <Text style={[styles.tabText, isSignIn && styles.activeTabText]}>
                  Sign in
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.tab, !isSignIn && styles.activeTab]}
                onPress={() => setIsSignIn(false)}
              >
                <Text style={[styles.tabText, !isSignIn && styles.activeTabText]}>
                  Sign up
                </Text>
              </TouchableOpacity>
            </View>

            {/* Form */}
            <View style={styles.formContainer}>
              {/* Email Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Enter Email</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter your email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholderTextColor="#777777"
                />
              </View>

              {/* Password Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Password</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={[styles.textInput, styles.passwordInput]}
                    placeholder="Enter your password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    placeholderTextColor="#777777"
                  />
                  <TouchableOpacity 
                    style={styles.eyeIcon}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Text style={styles.eyeIconText}>👁</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Sign In Button */}
              <TouchableOpacity 
                style={styles.signInButton}
                onPress={isSignIn ? handleEmailLogin : handleEmailSignup}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.signInButtonText}>
                    {isSignIn ? 'Sign in' : 'Sign up'}
                  </Text>
                )}
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.dividerContainer}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Google Sign In Button */}
              <TouchableOpacity
                onPress={handleGoogleSignIn}
                onPressIn={handleGoogleButtonPressIn}
                onPressOut={handleGoogleButtonPressOut}
                disabled={loading}
                activeOpacity={1}
              >
                <Animated.View
                  style={[
                    styles.googleButton,
                    { transform: [{ scale: googleButtonScale }] }
                  ]}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#333333" />
                  ) : (
                    <>
                      <Image
                        source={{ uri: 'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg' }}
                        style={styles.googleIcon}
                      />
                      <Text style={styles.googleButtonText}>Continue with Google</Text>
                    </>
                  )}
                </Animated.View>
              </TouchableOpacity>



              {/* Error Message */}
              {error && <Text style={styles.errorText}>{error}</Text>}
            </View>
          </>
        )}
      </ScrollView>
    );
  }

  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#ff0000" />
      <Text style={styles.loadingHint}>Opening app…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  loadingHint: {
    marginTop: 16,
    fontSize: 14,
    color: '#666666',
  },
  configErrorBanner: {
    backgroundColor: '#fff3f3',
    borderWidth: 1,
    borderColor: '#ffcccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  configErrorTitle: {
    fontWeight: '700',
    color: '#cc0000',
    marginBottom: 6,
  },
  configErrorText: {
    fontSize: 13,
    color: '#663333',
    lineHeight: 18,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 79,
    height: 79,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderRadius: 25,
    padding: 4,
    marginBottom: 40,
    alignSelf: 'center',
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 21,
    minWidth: 80,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#ff0000',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 4,
  },
  tabText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ff0000',
  },
  activeTabText: {
    color: '#ffffff',
  },
  formContainer: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    color: '#777777',
    marginBottom: 8,
    fontWeight: '300',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#adadad',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 15,
    fontSize: 16,
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 50,
  },
  eyeIcon: {
    position: 'absolute',
    right: 15,
    top: 15,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyeIconText: {
    fontSize: 16,
  },

  signInButton: {
    backgroundColor: '#ff0000',
    borderRadius: 25,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 30,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  signInButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },

  errorText: {
    color: '#ff0000',
    textAlign: 'center',
    marginTop: 20,
    fontSize: 14,
  },
  successText: {
    color: '#28a745',
    textAlign: 'center',
    marginTop: 20,
    fontSize: 14,
    fontWeight: 'bold',
  },
  confirmationTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333333',
  },
  confirmationText: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 10,
    color: '#555555',
  },
  confirmationSubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    color: '#777777',
  },
  backButton: {
    backgroundColor: '#f5f5f5',
    borderRadius: 25,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#adadad',
  },
  backButtonText: {
    color: '#ff0000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resendButton: {
    backgroundColor: '#ffffff',
    borderRadius: 25,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ff0000',
  },
  resendButtonText: {
    color: '#ff0000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#adadad',
  },
  dividerText: {
    marginHorizontal: 15,
    color: '#777777',
    fontSize: 14,
  },
  googleButton: {
    backgroundColor: '#ffffff',
    borderRadius: 25,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#dadce0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 12,
  },
  googleButtonText: {
    color: '#3c4043',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.25,
  },
  facebookButton: {
    backgroundColor: '#1877f2',
    borderRadius: 25,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 30,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  facebookButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
