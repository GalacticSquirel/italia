// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_init.sql';
import m0001 from './0001_data_layer_indexes_and_meta.sql';
import m0002 from './0002_review_log_append_only.sql';
import m0003 from './0003_streak_progress.sql';
import m0004 from './0004_sentence_tokens.sql';
import m0005 from './0005_sync_markers.sql';
import m0006 from './0006_model_files.sql';
import m0007 from './0007_story_progress.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002,
m0003,
m0004,
m0005,
m0006,
m0007
    }
  }
  