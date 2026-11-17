import { router, Stack, useLocalSearchParams } from 'expo-router';

import { StoryScreen } from '@/features/read/StoryScreen';

export default function StoryRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <Stack.Screen options={{ title: 'Story' }} />
      <StoryScreen
        key={id}
        storyId={id}
        onOpenStory={(next) => {
          router.replace({ pathname: '/story/[id]', params: { id: next } });
        }}
        onOpenWord={(lemmaId) => {
          router.push({ pathname: '/word/[id]', params: { id: String(lemmaId) } });
        }}
        onClose={() => {
          router.back();
        }}
      />
    </>
  );
}
