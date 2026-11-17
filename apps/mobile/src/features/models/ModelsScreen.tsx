import { useState } from 'react';
import { Alert, View } from 'react-native';

import {
  deviceCapability,
  NotOnWifiError,
  TIER_DESCRIPTIONS,
  useModelManager,
  useModels,
  type DeviceCapability,
  type ModelView,
} from '@/models';
import { Button, Card, ProgressBar, Screen, Text, useTheme } from '@/ui';

import { formatBytes } from './format';

const TIER_NAMES = { minimal: 'Basic', low: 'Standard', mid: 'Plus', high: 'Full' } as const;

const STATUS_TEXT: Record<ModelView['status'], string> = {
  not_installed: 'Not downloaded',
  downloading: 'Downloading',
  paused: 'Paused',
  verifying: 'Checking the download',
  installed: 'Ready, works offline',
  failed: 'Download failed',
  unavailable: 'Not available yet',
  unsupported: 'Needs a phone with more memory',
};

/** Ask before deleting a download; resolves true when the learner agrees. */
function confirmDelete(title: string, size: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(`Delete ${title}?`, `It frees ${size}. You can download it again later.`, [
      {
        text: 'Keep',
        style: 'cancel',
        onPress: () => {
          resolve(false);
        },
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          resolve(true);
        },
      },
    ]);
  });
}

/** Ask before using mobile data; resolves true when the learner agrees. */
function confirmMobileData(title: string, size: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      'Not on Wi-Fi',
      `${title} is ${size}. Download it over mobile data?`,
      [
        {
          text: 'Wait for Wi-Fi',
          style: 'cancel',
          onPress: () => {
            resolve(false);
          },
        },
        {
          text: 'Use mobile data',
          onPress: () => {
            resolve(true);
          },
        },
      ],
      {
        cancelable: true,
        onDismiss: () => {
          resolve(false);
        },
      },
    );
  });
}

/** One model with its download controls (also used by the conversation screen). */
export function ModelCard({ model }: { model: ModelView }) {
  const manager = useModelManager();
  const { spacing } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const { spec, status } = model;
  const size = formatBytes(model.bytesTotal);

  const install = async (allowCellular = false): Promise<void> => {
    setError(null);
    try {
      await manager.install(spec.id, { allowCellular });
    } catch (e) {
      if (e instanceof NotOnWifiError) {
        if (await confirmMobileData(spec.title, size)) await install(true);
        return;
      }
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const busy = status === 'downloading' || status === 'verifying';
  return (
    <Card accessibilityLabel={`${spec.title}, ${STATUS_TEXT[status]}`}>
      <Text variant="heading">{spec.title}</Text>
      <Text color="textMuted">{spec.description}</Text>
      <Text variant="caption" color="textMuted">{`${size} · Licence ${spec.licence}`}</Text>
      <Text
        variant="label"
        color={status === 'failed' ? 'danger' : status === 'installed' ? 'success' : 'text'}
        accessibilityLiveRegion="polite"
      >
        {STATUS_TEXT[status]}
      </Text>
      {busy || status === 'paused' ? (
        <View style={{ gap: spacing.xxs }}>
          <ProgressBar
            value={model.bytesDone / Math.max(1, model.bytesTotal)}
            label={`${spec.title} download`}
          />
          <Text variant="caption" color="textMuted">
            {`${formatBytes(model.bytesDone)} of ${size}`}
          </Text>
        </View>
      ) : null}
      {(error ?? model.error) !== null ? (
        <Text color="danger" accessibilityRole="alert">
          {error ?? model.error}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {status === 'not_installed' || status === 'failed' || status === 'paused' ? (
          <Button
            label={status === 'paused' ? 'Resume' : status === 'failed' ? 'Try again' : 'Download'}
            accessibilityLabel={`Download ${spec.title}`}
            onPress={() => void install()}
          />
        ) : null}
        {status === 'downloading' ? (
          <Button
            label="Pause"
            variant="secondary"
            accessibilityLabel={`Pause ${spec.title}`}
            onPress={() => {
              manager.pause(spec.id);
            }}
          />
        ) : null}
        {status === 'installed' || status === 'paused' || status === 'failed' ? (
          <Button
            label="Delete"
            variant="secondary"
            accessibilityLabel={`Delete ${spec.title}`}
            onPress={() => {
              void confirmDelete(spec.title, size).then((yes) => {
                if (yes) void manager.remove(spec.id);
              });
            }}
          />
        ) : null}
      </View>
    </Card>
  );
}

/** Props for {@link ModelsScreen}. */
export interface ModelsScreenProps {
  /** Device capability; defaults to this device's. */
  capability?: DeviceCapability;
}

/** Settings > On-device models: download, pause, delete, storage and device tier. */
export function ModelsScreen({ capability = deviceCapability() }: ModelsScreenProps) {
  const models = useModels();
  const manager = useModelManager();
  const ram = capability.totalMemoryBytes;
  const audio = models.filter((model) => model.spec.kind === 'audio-pack');
  // Engine builds download with the model that needs them.
  const speech = models.filter((m) => m.spec.kind !== 'engine' && m.spec.kind !== 'audio-pack');
  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <Card>
        <Text variant="heading">This phone</Text>
        <Text>
          {`${TIER_NAMES[capability.tier]} tier${
            ram === null ? '' : ` · ${formatBytes(ram)} memory`
          }`}
        </Text>
        <Text color="textMuted">{TIER_DESCRIPTIONS[capability.tier]}</Text>
        <Text variant="caption" color="textMuted">
          {`Models use ${formatBytes(manager.storageUsedBytes())} of storage. Downloads use Wi-Fi, resume if interrupted and are checked before use. Everything runs on this phone.`}
        </Text>
      </Card>
      {audio.length > 0 ? (
        <>
          <Text variant="heading" accessibilityRole="header">
            Recorded audio
          </Text>
          <Text color="textMuted">
            Words, lesson sentences and stories read aloud, played without a connection once
            downloaded. Words are said by native speakers where a recording exists.
          </Text>
          {audio.map((model) => (
            <ModelCard key={model.spec.id} model={model} />
          ))}
          <Text variant="heading" accessibilityRole="header">
            Speech and conversation
          </Text>
        </>
      ) : null}
      {speech.map((model) => (
        <ModelCard key={model.spec.id} model={model} />
      ))}
    </Screen>
  );
}
