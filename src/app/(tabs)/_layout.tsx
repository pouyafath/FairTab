import { SymbolView } from 'expo-symbols';
import { Tabs } from 'expo-router/tabs';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

type SymbolName = ComponentProps<typeof SymbolView>['name'];

function icon(name: SymbolName) {
  function TabIcon({ color }: { color: ColorValue | null }) {
    return <SymbolView name={name} tintColor={color ?? undefined} size={24} />;
  }
  return TabIcon;
}

export default function TabsLayout() {
  const theme = useTheme();
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: theme.primary }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Groups', tabBarIcon: icon({ ios: 'person.3', android: 'groups', web: 'groups' }) }}
      />
      <Tabs.Screen
        name="friends"
        options={{ title: 'Friends', tabBarIcon: icon({ ios: 'person.2', android: 'group', web: 'group' }) }}
      />
      <Tabs.Screen
        name="activity"
        options={{ title: 'Activity', tabBarIcon: icon({ ios: 'list.bullet', android: 'receipt_long', web: 'receipt_long' }) }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: 'Account', tabBarIcon: icon({ ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' }) }}
      />
    </Tabs>
  );
}
