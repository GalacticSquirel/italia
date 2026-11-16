import journal from './meta/_journal.json';
import m0000 from './0000_init.sql';
import m0001 from './0001_data_layer_indexes_and_meta.sql';
import m0002 from './0002_review_log_append_only.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002
    }
  }
  