import { useLocalSearchParams } from 'expo-router';

import { WordScreen } from '@/features/review/WordScreen';

export default function WordRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <WordScreen lemmaId={Number(id)} />;
}
