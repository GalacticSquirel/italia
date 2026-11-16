import { useLocalSearchParams } from 'expo-router';

import { GrammarPointScreen } from '@/features/grammar/GrammarPointScreen';

export default function GrammarPointRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <GrammarPointScreen pointId={Number(id)} />;
}
