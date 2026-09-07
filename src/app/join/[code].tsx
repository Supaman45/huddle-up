import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { Loading, Screen, Text } from '@/components/ui';
import { useSession } from '@/providers/session';
import JoinTeam from '../team/join';

// Deep link target: huddleup://join/A1B2C3 or https://huddleup.app/join/A1B2C3
export default function JoinByLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { ready, session, household } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!session) router.replace('/(auth)/sign-in');
    else if (!household) router.replace('/onboarding');
  }, [ready, session, household, router]);

  if (!ready || !session || !household) {
    return (
      <Screen scroll={false}>
        <Loading />
        <Text color="muted" style={{ textAlign: 'center' }}>
          Sign in first, then we will bring you back to team {code}.
        </Text>
      </Screen>
    );
  }
  return <JoinTeam initialCode={(code ?? '').toUpperCase()} />;
}
