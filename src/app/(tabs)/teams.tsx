import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { Avatar, Button, Empty, ListRow, Loading, Row, Screen, Stack, Text } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { space, sportLabel } from '@/lib/theme';
import type { Team, TeamRole } from '@/lib/types';

interface Membership {
  role: TeamRole;
  team: Team;
}

export default function Teams() {
  const router = useRouter();
  const [rows, setRows] = useState<Membership[] | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('team_members').select('role, team:teams(*)').order('created_at');
    setRows((data as unknown as Membership[]) ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <Screen>
      <Text variant="h1">Teams</Text>
      <Text color="muted" style={{ marginTop: 4 }}>
        Every team any of your kids plays on, in one list.
      </Text>
      <Row style={{ marginTop: space.lg }} gap={space.sm}>
        <View style={{ flex: 1 }}>
          <Button title="Enter a code" onPress={() => router.push('/team/join')} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Create a team" kind="secondary" onPress={() => router.push('/team/new')} />
        </View>
      </Row>
      <View style={{ marginTop: space.xl }}>
        {rows === null ? <Loading /> : null}
        {rows && rows.length === 0 ? (
          <Empty title="No teams yet" body="Ask the coach or team parent for the six-letter code. Or create the Team Space yourself and share the code by text." />
        ) : null}
        {rows && rows.length > 0 ? (
          <Stack gap={0}>
            {rows.map((r) => (
              <ListRow
                key={r.team.id}
                leading={<Avatar name={r.team.name} color={r.team.color} size={40} />}
                title={r.team.name}
                subtitle={`${sportLabel[r.team.sport]}${r.team.season ? ` · ${r.team.season}` : ''} · ${r.role === 'parent' ? 'Parent' : r.role === 'coach' ? 'Coach' : 'Manager'}`}
                onPress={() => router.push({ pathname: '/team/[id]', params: { id: r.team.id } })}
              />
            ))}
          </Stack>
        ) : null}
      </View>
    </Screen>
  );
}
