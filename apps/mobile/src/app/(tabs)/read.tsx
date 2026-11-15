import { router } from 'expo-router';

import { ReadScreen } from '@/features/read/ReadScreen';

export default function ReadRoute() {
  return (
    <ReadScreen
      onOpenStory={(id) => {
        router.push({ pathname: '/story/[id]', params: { id } });
      }}
    />
  );
}
