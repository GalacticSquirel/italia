import { router, type Href } from 'expo-router';

import { formatBytes } from '@/features/models/format';
import { useModels } from '@/models';
import { useTutorModel, type TutorModelChoice } from '@/tutor';
import { Card, List, ListItem, Screen, Text } from '@/ui';

/** What the speech models give, for the models row. */
function modelStatus(sttReady: boolean, scorerReady: boolean): string {
  if (sttReady && scorerReady)
    return 'Speech recognition and pronunciation scoring run on this phone.';
  if (sttReady)
    return 'Speech recognition runs on this phone. Download pronunciation scoring for feedback on your sounds.';
  return "Using your phone's own speech recognition. Download the on-device models for offline recognition and pronunciation feedback.";
}

/** What the conversation row says about the tutor model. */
function conversationSubtitle(choice: TutorModelChoice): string {
  switch (choice.state) {
    case 'ready':
      return 'Pick any scene to role-play with the tutor';
    case 'needs_download':
      return `Role-play with an on-device tutor (${formatBytes(choice.model.bytesTotal)} download)`;
    case 'unsupported':
      return 'Needs a phone with more memory';
    case 'unavailable':
      return 'Not available yet';
  }
}

function Row({ title, subtitle, href }: { title: string; subtitle: string; href: Href }) {
  return (
    <ListItem
      title={title}
      subtitle={subtitle}
      onPress={() => {
        router.push(href);
      }}
    />
  );
}

/**
 * The Practice tab: every kind of practice and reference, for extra time or a
 * particular need. Today's path picks the next step; this is the free choice.
 */
export function PracticeScreen() {
  const models = useModels();
  const tutor = useTutorModel();
  const installed = (kind: string) =>
    models.some((m) => m.spec.kind === kind && m.status === 'installed');
  return (
    <Screen title="Practice" testID="practice-screen">
      <Text color="textMuted">
        {"Extra practice on your own terms. Today's path already picks the best next step for you."}
      </Text>

      <Text variant="heading">Listen and read</Text>
      <Card>
        <Row title="Story library" subtitle="Graded stories, with audio, by level" href="/read" />
      </Card>

      <Text variant="heading">Speak</Text>
      <Card>
        <List>
          <Row title="Conversation" subtitle={conversationSubtitle(tutor)} href="/speak/converse" />
          <Row
            title="Hands-free drill"
            subtitle="Audio only, for walks and commutes"
            href={{ pathname: '/speak/drill', params: { handsFree: '1' } }}
          />
          <Row
            title="Speaking drill"
            subtitle="Hear English, say it in Italian, hear the answer"
            href="/speak/drill"
          />
          <Row
            title="Ear training"
            subtitle="Tell apart words that sound alike"
            href="/speak/ear"
          />
          <Row title="Shadowing" subtitle="Repeat after a model and compare" href="/speak/shadow" />
        </List>
      </Card>

      <Text variant="heading">Look things up</Text>
      <Card>
        <List>
          <Row title="My words" subtitle="Browse and search every card you have" href="/words" />
          <Row title="Grammar guide" subtitle="Every grammar point from A1 to C2" href="/grammar" />
          <Row
            title="On-device models"
            subtitle={modelStatus(installed('stt'), installed('phonemes'))}
            href="/models"
          />
        </List>
      </Card>
    </Screen>
  );
}
