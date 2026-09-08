import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

import { Button, Input, Screen, Spacer, Stack, Text } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { space } from '@/lib/theme';

export default function Verify() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify() {
    if (code.trim().length < 6) {
      setError('Enter the six-digit code from your email.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.verifyOtp({ email: email!, token: code.trim(), type: 'email' });
    setBusy(false);
    if (err) setError(err.message);
    // the session listener in the root layout routes onward
  }

  async function resend() {
    await supabase.auth.signInWithOtp({ email: email! });
  }

  return (
    <Screen scroll={false} glow>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center' }}>
        <View style={{ gap: space.sm }}>
          <Text variant="h1">Check your email</Text>
          <Text color="muted">We sent a six-digit code to {email}.</Text>
        </View>
        <Spacer h={space.xxl} />
        <Stack>
          <Input
            label="Code"
            placeholder="123456"
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChangeText={setCode}
            onSubmitEditing={verify}
            style={{ fontSize: 28, letterSpacing: 6, textAlign: 'center' }}
          />
          {error ? (
            <Text variant="small" color="danger">
              {error}
            </Text>
          ) : null}
          <Button title="Sign in" onPress={verify} loading={busy} />
          <Button title="Resend code" kind="ghost" onPress={resend} />
          <Button title="Use a different email" kind="ghost" onPress={() => router.back()} />
        </Stack>
      </KeyboardAvoidingView>
    </Screen>
  );
}
