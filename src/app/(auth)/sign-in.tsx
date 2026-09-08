import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

import { Button, Input, Screen, Spacer, Stack, Text } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { space } from '@/lib/theme';

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const e = email.trim().toLowerCase();
    if (!e.includes('@')) {
      setError('Enter the email you want the sign-in code sent to.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({ email: e, options: { shouldCreateUser: true } });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.push({ pathname: '/(auth)/verify', params: { email: e } });
  }

  return (
    <Screen scroll={false} glow>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center' }}>
        <View style={{ gap: space.sm }}>
          <Text variant="label" color="accent">
            Huddle Up
          </Text>
          <Text variant="display" style={{ marginTop: space.sm }}>
            Who’s driving?
          </Text>
          <Text color="muted">One place for every kid’s schedule, carpools and snack duty. Free for the team, always.</Text>
        </View>
        <Spacer h={space.xxl} />
        <Stack>
          <Input
            label="Email"
            placeholder="you@example.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            value={email}
            onChangeText={setEmail}
            onSubmitEditing={send}
            returnKeyType="send"
          />
          {error ? (
            <Text variant="small" color="danger">
              {error}
            </Text>
          ) : null}
          <Button title="Send me a code" onPress={send} loading={busy} />
          <Text variant="small" color="muted" style={{ textAlign: 'center' }}>
            No passwords. We text or email a six-digit code. Adults only; kids never get accounts.
          </Text>
        </Stack>
        <Spacer h={space.xxxl} />
        <Text variant="small" color="faint" style={{ textAlign: 'center' }}>
          By continuing you agree to keep this app ad-free for kids, because we do.
        </Text>
      </KeyboardAvoidingView>
    </Screen>
  );
}
